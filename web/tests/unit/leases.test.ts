import { describe, expect, it } from "vitest";
import { SAMPLE_LEASES } from "@/data/sampleLeases";
import { LEASE_RADIUS_M } from "@/lib/engine/leaseFit";
import { haversine } from "@/lib/engine/geo";
import { leasesNear } from "@/lib/services/leases";
import { parseLeaseQuery } from "@/lib/services/leaseQuery";

const DOWNTOWN_SJ = { lat: 37.337, lng: -121.894 };
const MOUNTAIN_VIEW = { lat: 37.3943, lng: -122.079 }; // Castro Street
const params = (o: Record<string, string>) => new URLSearchParams(o);

describe("sample leases", () => {
  it("has forty uniquely identified samples", () => {
    expect(SAMPLE_LEASES).toHaveLength(40);
    expect(new Set(SAMPLE_LEASES.map(l => l.id)).size).toBe(40);
  });

  it("has ten Mountain View leases each for cafés, restaurants and stores", () => {
    const mv = SAMPLE_LEASES.filter(l => l.cityId === "mountain_view");
    expect(mv).toHaveLength(30);
    for (const use of ["cafe", "restaurant", "retail"] as const) expect(mv.filter(l => l.previousUse === use)).toHaveLength(10);
    expect(mv.every(l => l.cityName === "Mountain View")).toBe(true);
  });

  it("finds Mountain View leases near Castro Street and none from San José", () => {
    const near = leasesNear(MOUNTAIN_VIEW.lat, MOUNTAIN_VIEW.lng, LEASE_RADIUS_M);
    expect(near.length).toBeGreaterThanOrEqual(15);
    expect(near.every(l => l.cityId === "mountain_view" || l.cityId === "sunnyvale")).toBe(true);
  });

  it("returns only leases within the radius, nearest first", () => {
    const near = leasesNear(DOWNTOWN_SJ.lat, DOWNTOWN_SJ.lng, LEASE_RADIUS_M);
    expect(near.length).toBeGreaterThan(0);
    const d = near.map(l => haversine(DOWNTOWN_SJ.lat, DOWNTOWN_SJ.lng, l.lat, l.lng));
    expect(d.every(m => m <= LEASE_RADIUS_M)).toBe(true);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
  });

  it("gives every lease an https link to its listing", () => {
    expect(SAMPLE_LEASES.every(l => l.listingUrl.startsWith("https://"))).toBe(true);
  });

  it("returns nothing far from the sample area", () => {
    expect(leasesNear(34.05, -118.24, LEASE_RADIUS_M)).toEqual([]);
  });
});

describe("parseLeaseQuery", () => {
  const ok = { lat: "37.337", lng: "-121.894", type: "cafe" };

  it("accepts a minimal query and fills defaults", () => {
    const r = parseLeaseQuery(params(ok));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ lat: 37.337, lng: -121.894, type: "cafe", days: 120 });
  });

  it("rejects a missing coordinate or an unknown business type", () => {
    expect(parseLeaseQuery(params({ lng: "-121.894", type: "cafe" })).success).toBe(false);
    expect(parseLeaseQuery(params({ ...ok, type: "casino" })).success).toBe(false);
  });

  it("treats empty optional values as absent and keeps a real budget", () => {
    const r = parseLeaseQuery(params({ ...ok, budgetUsd: "", cityId: "" }));
    expect(r.success && r.data.budgetUsd).toBeUndefined();
    const withBudget = parseLeaseQuery(params({ ...ok, budgetUsd: "150000" }));
    expect(withBudget.success && withBudget.data.budgetUsd).toBe(150000);
  });

  it("rejects an out-of-range number of permit days", () => {
    expect(parseLeaseQuery(params({ ...ok, days: "9999" })).success).toBe(false);
  });
});
