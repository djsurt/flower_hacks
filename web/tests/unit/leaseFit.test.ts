import { describe, expect, it } from "vitest";
import { countWithin, saturationOf } from "@/lib/engine/geo";
import { MAX_RECOMMENDATIONS, rankLeases, type RankInput } from "@/lib/engine/leaseFit";
import type { SampleLease } from "@/data/sampleLeases";

const ORIGIN = { lat: 37.337, lng: -121.894 };

const lease = (id: string, o: Partial<SampleLease> = {}): SampleLease => ({
  id, address: `${id} Test St`, area: "Test Area", cityId: "san_jose", cityName: "San José",
  lat: 37.33, lng: -121.89, squareFeet: 1000, rentPerSqFt: 4, previousUse: "cafe", listingUrl: `https://example.com/leases/${id}`, ...o,
});
const cafesAt = (l: SampleLease, n: number) => Array.from({ length: n }, () => ({ lat: l.lat, lng: l.lng }));

const base: Omit<RankInput, "leases" | "competitors"> = {
  profile: { businessType: "cafe", acquisition: "second_generation", foodService: "prepared_food", budgetUsd: 150000 },
  cityId: "san_jose", waitDays: 128, origin: ORIGIN, addressCompetitors: 14,
};

describe("geo helpers", () => {
  it("saturation follows the same thresholds as the competitors panel", () => {
    expect(saturationOf(5, 800).level).toBe("low");
    expect(saturationOf(6, 800).level).toBe("medium");
    expect(saturationOf(10, 800).level).toBe("medium");
    expect(saturationOf(11, 800).level).toBe("high");
  });
  it("counts only points inside the radius", () => {
    const pts = [{ lat: 37.337, lng: -121.894 }, { lat: 37.338, lng: -121.894 }, { lat: 37.40, lng: -121.894 }];
    expect(countWithin(pts, ORIGIN, 800)).toBe(2);
  });
});

describe("rankLeases", () => {
  it("keeps only leases with fewer competitors than the owner's address", () => {
    const a = lease("a"), b = lease("b", { lat: 37.34 }), c = lease("c", { lat: 37.35 });
    const recs = rankLeases({ ...base, addressCompetitors: 3, leases: [a, b, c], competitors: [...cafesAt(a, 2), ...cafesAt(b, 3), ...cafesAt(c, 5)] });
    expect(recs.map(r => r.id)).toEqual(["a"]);
  });

  it("orders by fewer competitors, then lower rent", () => {
    const a = lease("a", { lat: 37.30, rentPerSqFt: 5 }), b = lease("b", { lat: 37.31, rentPerSqFt: 3 }), c = lease("c", { lat: 37.32, rentPerSqFt: 4 });
    const recs = rankLeases({ ...base, leases: [a, b, c], competitors: [...cafesAt(a, 2), ...cafesAt(b, 2), ...cafesAt(c, 1)] });
    expect(recs.map(r => r.id)).toEqual(["c", "b", "a"]);
    expect(recs.map(r => r.rank)).toEqual([1, 2, 3]);
  });

  it("caps the list and labels every lease as a sample", () => {
    const many = Array.from({ length: 8 }, (_, i) => lease(`l${i}`, { lat: 37.30 + i * 0.005 }));
    const recs = rankLeases({ ...base, leases: many, competitors: [] });
    expect(recs).toHaveLength(MAX_RECOMMENDATIONS);
    expect(recs.every(r => r.sample === true)).toBe(true);
  });

  it("computes rent, rent while waiting and budget share from the plan", () => {
    const l = lease("a", { squareFeet: 1350, rentPerSqFt: 3.85 });
    const [rec] = rankLeases({ ...base, leases: [l], competitors: cafesAt(l, 5) });
    expect(rec.monthlyRent).toBe(5198);
    expect(rec.waitCost).toBe(Math.round((5198 * 128) / 30.4));
    expect(rec.budgetShare).toBeCloseTo(rec.waitCost / 150000, 5);
    expect(rec.competitors).toBe(5);
    expect(rec.saturation).toBe("low");
  });

  it("has no budget share when the owner gave no budget", () => {
    const l = lease("a");
    const [rec] = rankLeases({ ...base, profile: { ...base.profile, budgetUsd: undefined }, leases: [l], competitors: [] });
    expect(rec.budgetShare).toBeNull();
    expect(rec.fits.map(f => f.text)).not.toContain("Within your budget");
  });

  it("flags a different city and a retail space that needs a kitchen", () => {
    const sv = lease("sv", { cityId: "sunnyvale", cityName: "Sunnyvale" });
    const retail = lease("re", { lat: 37.31, previousUse: "retail" });
    const recs = rankLeases({ ...base, leases: [sv, retail], competitors: [] });
    const bySv = recs.find(r => r.id === "sv")!, byRe = recs.find(r => r.id === "re")!;
    expect(bySv.fits).toContainEqual({ text: "Different city: permit steps change", ok: false });
    expect(bySv.why).toContain("Sunnyvale");
    expect(byRe.fits).toContainEqual({ text: "New kitchen build-out needed", ok: false });
  });

  it("marks a former café as second-generation for a café and the same city as unchanged", () => {
    const l = lease("a");
    const [rec] = rankLeases({ ...base, leases: [l], competitors: [] });
    expect(rec.fits).toEqual(expect.arrayContaining([
      { text: "Second-generation café space", ok: true },
      { text: "Same city: roadmap unchanged", ok: true },
      { text: "Within your budget", ok: true },
    ]));
    expect(rec.why).toContain("San José");
  });

  it("carries each lease's listing link through so the card can link out", () => {
    const l = lease("a", { listingUrl: "https://example.com/owner/a" });
    const [rec] = rankLeases({ ...base, leases: [l], competitors: [] });
    expect(rec.listingUrl).toBe("https://example.com/owner/a");
  });

  it("does not mutate its inputs", () => {
    const a = lease("a"), b = lease("b", { lat: 37.31 });
    const leases = [a, b];
    const competitors = cafesAt(b, 1);
    rankLeases({ ...base, leases, competitors });
    expect(leases.map(l => l.id)).toEqual(["a", "b"]);
    expect(competitors).toHaveLength(1);
  });
});
