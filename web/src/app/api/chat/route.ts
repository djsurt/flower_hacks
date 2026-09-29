import {
  executeUpdate,
  inputSchema,
  planSnapshot,
  TOOL_DESCRIPTION,
  TOOL_NAME,
  type ChatEvent,
} from "@/lib/llm/chatAgent";
import { buildPlan } from "@/lib/engine/buildPlan";
import { nextQuestion } from "@/lib/nextQuestion";
import { BusinessProfile } from "@/lib/schemas";
import { z } from "zod";

const Body = z.object({
  message: z.string().trim().min(1).max(32000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(32000) })).max(80).default([]),
  profile: BusinessProfile,
  seriesId: z.string().regex(/^[1-9]\d*$/).max(20).nullish(),
});

type BridgeLine =
  | { type: "run"; runId: string; seriesId?: string }
  | { type: "event"; event: string; data: Record<string, unknown> }
  | { type: "error"; message: string }
  | { type: "done" };

const FLOWER_BRIDGE_URL = (process.env.FLOWER_BRIDGE_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const FLOWER_RUN_TIMEOUT_MS = Number(process.env.FLOWER_RUN_TIMEOUT_MS || 120_000);

/** Streams Flower AgentApp events while the deterministic web engine remains the plan authority. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid chat request." }, { status: 400 });
  const { message, history, profile, seriesId } = parsed.data;
  const upstream = new AbortController();
  let cancelled = false;

  const body = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (event: ChatEvent) => { if (!cancelled) controller.enqueue(enc.encode(`${JSON.stringify(event)}\n`)); };
      let workingProfile = profile;
      emit({ type: "mode", mode: "flower" });

      try {
        const prompt = JSON.stringify({
          protocol: "comply.web.v1",
          message: message.trim(),
          history: history.slice(-20),
          currentPlan: planSnapshot(buildPlan(profile)),
          patchTool: { name: TOOL_NAME, description: TOOL_DESCRIPTION, parameters: inputSchema },
        });
        const timeoutSignal = AbortSignal.timeout(FLOWER_RUN_TIMEOUT_MS);
        const response = await fetch(`${FLOWER_BRIDGE_URL}/v1/runs/stream`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt, ...(seriesId ? { seriesId } : {}) }),
          cache: "no-store",
          signal: AbortSignal.any([req.signal, timeoutSignal, upstream.signal]),
        });
        if (!response.ok || !response.body) {
          const detail = await response.text().catch(() => "");
          throw new Error(detail || `Flower Bridge returned HTTP ${response.status}.`);
        }

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        let terminal = false;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const item = JSON.parse(line) as BridgeLine;
            if (item.type === "done") terminal = true;
            if (item.type === "run" && item.seriesId) {
              emit({ type: "session", seriesId: item.seriesId });
            } else if (item.type === "error") {
              emit({ type: "error", message: item.message });
            } else if (item.type === "event") {
              if (["error", "response.failed", "response.incomplete"].includes(item.event)) {
                throw new Error("The Flower Agent run failed or was incomplete. Please try again.");
              }
              if (item.event === "response.output_text.delta" && typeof item.data.delta === "string") {
                emit({ type: "text", delta: item.data.delta });
              } else if (item.event === "comply.status") {
                const role = typeof item.data.role === "string" ? item.data.role : "Flower Agent";
                const rawState = typeof item.data.state === "string" ? item.data.state : "running";
                emit({
                  type: "status",
                  id: role.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
                  label: role,
                  detail: typeof item.data.detail === "string" && item.data.detail ? item.data.detail : undefined,
                  state: rawState === "done" ? "done" : rawState === "error" ? "error" : "active",
                });
              } else if (item.event === "comply.profile_patch") {
                const result = await executeUpdate(workingProfile, item.data.patch, emit);
                workingProfile = result.profile;
                if (result.isError) {
                  emit({ type: "error", message: "Flower proposed an invalid profile update. Please rephrase that detail." });
                  continue;
                }
                const detail = JSON.parse(result.content) as { whatChanged?: string };
                const followUp = nextQuestion(workingProfile);
                emit({ type: "text", delta: `${detail.whatChanged || "Your plan is updated."}${followUp ? ` ${followUp}` : ""}` });
              }
            }
          }
        }
        if (!terminal || buffer.trim()) throw new Error("The Flower Bridge stream ended unexpectedly. Please try again.");
      } catch (error) {
        if (req.signal.aborted) {
          emit({ type: "error", message: "The Flower run was cancelled." });
        } else if (error instanceof DOMException && error.name === "TimeoutError") {
          emit({ type: "error", message: "The Flower run timed out. Cancellation was requested; check Flower if it is still running." });
        } else {
          console.error("Flower chat failed:", error instanceof Error ? error.message : error);
          emit({ type: "error", message: friendlyError(error) });
        }
      } finally {
        upstream.abort();
        emit({ type: "done" });
        if (!cancelled) controller.close();
      }
    },
    cancel() { cancelled = true; upstream.abort(); },
  });

  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/fetch failed|ECONNREFUSED|Flower Bridge/i.test(message)) {
    return "Couldn't reach the local Flower Bridge. Start SuperLink and the bridge, then try again.";
  }
  return message || "The Flower Agent run failed. Check the bridge and SuperLink logs.";
}
