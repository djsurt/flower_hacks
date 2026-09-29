import { describe, expect, it } from "vitest";
import { applyPatch, completeProfile } from "@/lib/defaults";
import { researchAgentsForChange } from "@/lib/researchRouting";

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

  it("routes employee count to employer specialist", () => {
    const before = base();
    expect(researchAgentsForChange(before, applyPatch(before, { employeesPlanned: 12 }))).toEqual(["employer"]);
  });

  it("does not launch agents for rent, budget or target date", () => {
    const before = base();
    const after = applyPatch(before, { monthlyRentUsd: 6000, budgetUsd: 300000, targetOpenDate: "2027-06-01" });
    expect(researchAgentsForChange(before, after)).toEqual([]);
  });
});
