import { z } from "zod";

const NodeName = z.enum(["sanjose", "county-health", "abc"]);
const Source = z.object({ title: z.string().max(300), url: z.url().refine(url => {
  const u = new URL(url);
  return u.protocol === "https:" && ["geo.sanjoseca.gov", "data.sccgov.org", "www.abc.ca.gov", "deh.santaclaracounty.gov"].includes(u.hostname);
}) });
const strings = z.array(z.string().max(4000)).max(30);
export const NodeReport = z.discriminatedUnion("status", [
  z.object({ node: NodeName, status: z.literal("ok"), recordCount: z.number().int().nonnegative(),
    retrievedAt: z.string(), matchedCount: z.number().int().nonnegative(), recordIds: strings,
    findings: strings, actions: strings, sources: z.array(Source).max(5), limitations: strings, synthetic: z.literal(false) }),
  z.object({ node: NodeName, status: z.literal("error"), error: z.string().max(1000) }),
]);
export const EvidenceReport = z.object({
  runId: z.string().regex(/^\d+$/), federation: z.string().max(200), checkedAt: z.string(),
  nodes: z.array(NodeReport).length(3).refine(nodes => new Set(nodes.map(n => n.node)).size === 3),
});
export type EvidenceReport = z.infer<typeof EvidenceReport>;
export type ReviewedEvidence = { report: EvidenceReport; reviewedAt: string };
export const NODE_LABELS = { sanjose: "San José permits", "county-health": "County food facilities", abc: "California ABC" };
