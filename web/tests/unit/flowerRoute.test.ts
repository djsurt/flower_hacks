import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { POST } from "@/app/api/chat/route";
import { completeProfile } from "@/lib/defaults";

const profile = {
  ...completeProfile({ businessType: "cafe", address: { raw: "87 N San Pedro St, San Jose" } }, "test"),
  jurisdiction: { kind: "city" as const, cityId: "san_jose", cityName: "San José", county: "santa_clara", supported: true },
};

const request = () => new Request("http://localhost/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ message: "We'll serve beer and wine", history: [], profile }),
});

const ndjson = (...items: object[]) => `${items.map(item => JSON.stringify(item)).join("\n")}\n`;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Flower chat route", () => {
  it("maps a Flower patch into a deterministic plan update", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(ndjson(
      { type: "run", runId: "1", seriesId: "2" },
      { type: "event", event: "comply.status", data: { role: "Reviewer agent", state: "done", detail: "confirmed" } },
      { type: "event", event: "comply.profile_patch", data: { patch: { alcohol: "beer_wine" } } },
      { type: "event", event: "response.completed", data: {} },
      { type: "done" },
    ), { status: 200, headers: { "content-type": "application/x-ndjson" } })));

    const response = await POST(request());
    const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));

    expect(events).toContainEqual({ type: "mode", mode: "flower" });
    expect(events).toContainEqual({ type: "session", seriesId: "2" });
    expect(events.some(event => event.type === "status" && event.label === "Reviewer agent")).toBe(true);
    expect(events.some(event => event.type === "update" && event.profile.alcohol === "beer_wine")).toBe(true);
    expect(events.some(event => event.type === "text" && /Beer|wine|plan/i.test(event.delta))).toBe(true);
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("reports an unavailable bridge without silently falling back", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));

    const response = await POST(request());
    const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));

    expect(events.some(event => event.type === "error" && /Flower Bridge/.test(event.message))).toBe(true);
    expect(events.some(event => event.type === "mode" && event.mode !== "flower")).toBe(false);
  });

  it("reports an explicit timeout without falling back", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new DOMException("The operation timed out", "TimeoutError");
    }));

    const response = await POST(request());
    const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));

    expect(events.some(event => event.type === "error" && /timed out and was stopped/i.test(event.message))).toBe(true);
    expect(events.at(-1)).toEqual({ type: "done" });
  });
});
