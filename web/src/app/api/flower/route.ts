import { spawn } from "node:child_process";
import path from "node:path";
import { BusinessProfile } from "@/lib/schemas";
import { EvidenceReport } from "@/lib/flower";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// This bridge intentionally serves only a local, single-user demo.
let busy = false;

export async function POST(request: Request) {
  // Next may normalize request.url to localhost even when opened on 127.0.0.1.
  let origin: URL;
  try { origin = new URL(request.headers.get("origin") ?? ""); }
  catch { return Response.json({ error: "A same-origin browser request is required." }, { status: 403 }); }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) || origin.host !== request.headers.get("host") ||
      !["http:", "https:"].includes(origin.protocol) ||
      request.headers.get("x-comply-evidence") !== "1") {
    return Response.json({ error: "Flower evidence is available only from this app on localhost." }, { status: 403 });
  }
  if (busy) return Response.json({ error: "An evidence check is already running. Please wait." }, { status: 409 });
  let profile;
  try {
    const body = await request.text();
    if (body.length > 32000) throw new Error("Too large");
    const parsed = BusinessProfile.parse(JSON.parse(body).profile);
    // Evidence needs location and permit-path facts, not budgets, rent or owner text.
    profile = { address: parsed.address, jurisdiction: parsed.jurisdiction,
      foodService: parsed.foodService, alcohol: parsed.alcohol, acquisition: parsed.acquisition };
  } catch {
    return Response.json({ error: "Invalid business profile." }, { status: 400 });
  }
  // Recheck after asynchronous body reading to avoid concurrent starts.
  if (busy) return Response.json({ error: "An evidence check is already running." }, { status: 409 });
  busy = true;
  const project = path.resolve(process.cwd(), "../flower-agent");
  const encoder = new TextEncoder();
  let cancel: () => void = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const child = spawn(path.join(project, ".venv/bin/python"), ["-u", path.join(project, "bridge.py")], {
        cwd: project, stdio: ["pipe", "pipe", "pipe"], shell: false,
      });
      let closed = false;
      let buffer = "";
      let reportSeen = false;
      let errorSeen = false;
      const send = (value: unknown) => { if (!closed) controller.enqueue(encoder.encode(JSON.stringify(value) + "\n")); };
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      const stop = () => {
        child.kill("SIGTERM");
        killTimer ??= setTimeout(() => child.kill("SIGKILL"), 15000);
      };
      cancel = () => { closed = true; stop(); };
      const timer = setTimeout(() => {
        send({ type: "error", message: "Flower timed out. Cancelling the run." });
        errorSeen = true; stop();
      }, 340000);
      const heartbeat = setInterval(() => send({ type: "waiting" }), 15000);
      const cleanup = () => {
        clearTimeout(timer); clearTimeout(killTimer); clearInterval(heartbeat);
        request.signal.removeEventListener("abort", cancel); busy = false;
      };
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        buffer += chunk;
        if (buffer.length > 250000) { stop(); return; }
        let end: number;
        while ((end = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
          try {
            const event = JSON.parse(line);
            if (event.type === "report") {
              const report = EvidenceReport.parse(event.report);
              reportSeen = true; send({ type: "report", report });
            } else if (["started", "node", "error"].includes(event.type)) {
              if (event.type === "error") errorSeen = true;
              send(event);
            }
          } catch {
            errorSeen = true; send({ type: "error", message: "Flower returned an invalid report." }); stop();
          }
        }
      });
      // Do not expose SDK diagnostics, auth details, or raw data to the client.
      child.stderr.resume();
      child.stdin.on("error", () => {});
      child.on("error", () => {
        errorSeen = true;
        send({ type: "error", message: "Flower bridge is not installed. Run `uv sync --project flower-agent` from the repository root." });
      });
      child.on("close", () => {
        cleanup();
        if (!reportSeen && !errorSeen) send({ type: "error", message: "Flower ended without a report. Check the nodes and your Flower login." });
        if (!closed) { controller.close(); closed = true; }
      });
      request.signal.addEventListener("abort", cancel, { once: true });
      if (request.signal.aborted) cancel();
      child.stdin.end(JSON.stringify({ profile }));
    },
    cancel() { cancel(); },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
