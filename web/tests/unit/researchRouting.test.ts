import { describe, expect, it } from "vitest";
import { applyPatch, completeProfile } from "@/lib/defaults";
import { researchAgentsForChange } from "@/lib/researchRouting";
import { buildPlan } from "@/lib/engine/buildPlan";
import { diffPlans } from "@/lib/engine/diff";

const base = () => completeProfile({ businessType: "restaurant", address: { raw: "389 Jane Stanford Way, Stanford, CA" } }, "routing");

describe("automatic research routing", () => {
  it("routes alcohol to state and local specialists", () => {
    const before = base();
    expect(researchAgentsForChange(before, applyPatch(before, { alcohol: "beer_wine" }))).toEqual(["state", "city"]);
  });

  it("routes prepared food to county health only", () => {
    const before = { ...base(), foodService: "prepackaged_only" as const };
    expect(researchAgentsForChange(before, applyPatch(before, { foodService: "prepared_food" }))).toEqual(["county"]);
  });

  it("routes a confirmed default because it is no longer an assumption", () => {
    const before = base();
    expect(before.assumed).toContain("foodService");
    expect(researchAgentsForChange(before, applyPatch(before, { foodService: "prepared_food" }))).toEqual(["county"]);
  });

  it("routes employee count to employer specialist", () => {
    const before = base();
    expect(researchAgentsForChange(before, applyPatch(before, { employeesPlanned: 12 }))).toEqual(["employer"]);
  });

  it("does not launch agents for rent, budget or target date", () => {
    const before = base();
    const after = applyPatch(before, { monthlyRentUsd: 6000, budgetUsd: 300000, targetOpenDate: "2027-06-01" });
    expect(researchAgentsForChange(before, after)).toEqual([]);
  });

  it("the three-minute demo produces a visible plan diff and relevant agents on every turn", () => {
    const p0 = base();
    const p1 = applyPatch(p0, { foodService: "prepackaged_only", acquisition: "new_buildout" });
    const p2 = applyPatch(p1, { alcohol: "beer_wine" });
    const p3 = applyPatch(p2, { squareFeet: 3500, employeesPlanned: 12 });
    const visibleChange = (before: typeof p0, after: typeof p0) => {
      const d = diffPlans(buildPlan(before), buildPlan(after));
      return d.added.length + d.removed.length + Math.abs(d.costDelta) + Math.abs(d.openDeltaDays);
    };
    expect(visibleChange(p0, p1)).toBeGreaterThan(0);
    expect(researchAgentsForChange(p0, p1)).toEqual(["city", "county"]);
    expect(visibleChange(p1, p2)).toBeGreaterThan(0);
    expect(researchAgentsForChange(p1, p2)).toEqual(["state", "city"]);
    expect(visibleChange(p2, p3)).toBeGreaterThan(0);
    expect(researchAgentsForChange(p2, p3)).toEqual(["city", "employer"]);
  });
});
