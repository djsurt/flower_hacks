import { describe, expect, it } from "vitest";
import { EvidenceReport } from "../../src/lib/flower";

describe("Flower evidence contract", () => {
  const report = {
    runId: "18446744073709551615", federation: "@demo/comply", checkedAt: "2026-09-29T12:00:00Z",
    nodes: ["sanjose", "county-health", "abc"].map(node => ({ node, status: "error", error: "Unavailable" })),
  };
  it("preserves uint64 IDs and explicit partial failures", () => {
    expect(EvidenceReport.parse(report).runId).toBe("18446744073709551615");
  });
  it("rejects duplicate node results", () => {
    expect(EvidenceReport.safeParse({ ...report, nodes: [report.nodes[0], report.nodes[0], report.nodes[2]] }).success).toBe(false);
  });
  it("rejects untrusted citation links and synthetic evidence", () => {
    const node = { node: "sanjose", status: "ok", recordCount: 1, retrievedAt: report.checkedAt, matchedCount: 0,
      recordIds: [], findings: [], actions: [], sources: [{ title: "Source", url: "https://geo.sanjoseca.gov/example" }], limitations: [], synthetic: false };
    const candidate = { ...report, nodes: [node, ...report.nodes.slice(1)] };
    expect(EvidenceReport.safeParse(candidate).success).toBe(true);
    node.sources[0].url = "javascript:alert(1)";
    expect(EvidenceReport.safeParse(candidate).success).toBe(false);
    node.sources[0].url = "https://geo.sanjoseca.gov/example";
    node.synthetic = true;
    expect(EvidenceReport.safeParse(candidate).success).toBe(false);
  });
});
