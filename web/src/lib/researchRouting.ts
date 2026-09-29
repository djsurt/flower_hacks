import type { BusinessProfile } from "@/lib/schemas";

export type ResearchAgentId = "city" | "county" | "state" | "employer";

/** Route only changed regulatory facts. Financial/date edits stay in the deterministic engine. */
export function researchAgentsForChange(before: BusinessProfile, after: BusinessProfile): ResearchAgentId[] {
  const changed = (key: keyof BusinessProfile) => JSON.stringify(before[key]) !== JSON.stringify(after[key])
    || before.assumed.includes(String(key)) !== after.assumed.includes(String(key));
  const selected = new Set<ResearchAgentId>();
  if (["address", "businessType", "acquisition", "squareFeet", "outdoorSeating", "exteriorSign"].some(k => changed(k as keyof BusinessProfile))) selected.add("city");
  if (["address", "businessType", "foodService", "acquisition"].some(k => changed(k as keyof BusinessProfile))) selected.add("county");
  if (["businessType", "alcohol", "entityType"].some(k => changed(k as keyof BusinessProfile))) selected.add("state");
  if (["entityType", "employeesPlanned"].some(k => changed(k as keyof BusinessProfile))) selected.add("employer");
  if (changed("alcohol")) selected.add("city");
  return [...selected];
}
