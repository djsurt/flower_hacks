// Ranks nearby leases by how good the competitive landscape is, then explains the fit with the owner's plan.
// Pure: no network. Fit uses only fields the plan already has (the same ones the Flower agent's Intake role produces).
import type { PreviousUse, SampleLease } from "@/data/sampleLeases";
import { countWithin, MILE, haversine, saturationOf, type Saturation } from "@/lib/engine/geo";
import type { BusinessProfile } from "@/lib/schemas";

export const LEASE_RADIUS_M = 3 * MILE;
export const WALK_RADIUS_M = 800; // 10-minute walk, the same radius the competitors panel opens with
export const MAX_RECOMMENDATIONS = 5;
const DAYS_PER_MONTH = 30.4; // matches estimateCosts' rent_until_open
const MAX_BUDGET_SHARE = 0.25; // rent paid while waiting on permits, as a share of the budget

export type LeaseFit = { text: string; ok: boolean };
export type LeaseRec = {
  id: string; rank: number; address: string; area: string; cityName: string; lat: number; lng: number;
  squareFeet: number; rentPerSqFt: number; monthlyRent: number; previousUse: PreviousUse;
  distanceMeters: number; competitors: number; saturation: Saturation;
  waitCost: number; budgetShare: number | null;
  why: string; fits: LeaseFit[]; listingUrl: string; sample: true;
};

export type RankInput = {
  profile: Pick<BusinessProfile, "businessType" | "acquisition" | "foodService" | "budgetUsd">;
  cityId?: string;
  waitDays: number; // typical days of permits, from the plan
  origin: { lat: number; lng: number };
  addressCompetitors: number;
  leases: readonly SampleLease[];
  competitors: readonly { lat: number; lng: number }[];
};

/** What the API returns: ranked leases, plus what the map and the empty states need. */
export type LeaseResponse = {
  nearbyCount: number; // sample leases inside the search radius, before ranking
  addressCompetitors: number;
  leases: LeaseRec[];
  competitors: { id: string; lat: number; lng: number }[];
  source: string;
  error?: string;
};

export const USE_LABEL: Record<PreviousUse, string> = { cafe: "café", restaurant: "restaurant", bakery: "bakery", retail: "retail space" };
const isFoodUse = (u: PreviousUse) => u !== "retail";

function spaceFit(input: RankInput["profile"], use: PreviousUse): { fit: LeaseFit; sentence: string } {
  const label = USE_LABEL[use];
  const food = input.businessType !== "retail_boutique";
  if (food && isFoodUse(use)) {
    const text = input.businessType === "cafe" && use === "cafe" ? "Second-generation café space" : "Existing food-service space";
    const sentence = input.acquisition === "second_generation"
      ? `A former ${label}, so it keeps the shorter second-generation build-out in your roadmap.`
      : `A former ${label}, so the space already suits your business type.`;
    return { fit: { text, ok: true }, sentence };
  }
  if (food) return { fit: { text: "New kitchen build-out needed", ok: false }, sentence: `A former ${label} means a new kitchen build-out: expect extra kitchen and health steps your roadmap does not include.` };
  if (use === "retail") return { fit: { text: "Existing retail space", ok: true }, sentence: "A former retail space, so it already suits a boutique." };
  return { fit: { text: "Retail fit-out needed", ok: false }, sentence: `A former ${label} needs a retail fit-out before a boutique can open.` };
}

function cityFit(cityId: string | undefined, lease: SampleLease): { fit: LeaseFit; sentence: string } | null {
  if (!cityId) return null;
  return cityId === lease.cityId
    ? { fit: { text: "Same city: roadmap unchanged", ok: true }, sentence: `It sits in ${lease.cityName}, so your permit steps stay the same.` }
    : { fit: { text: "Different city: permit steps change", ok: false }, sentence: `It is in ${lease.cityName}, so city permit steps and fees change and your opening date needs re-planning.` };
}

export function rankLeases(input: RankInput): LeaseRec[] {
  const { profile, cityId, waitDays, origin, addressCompetitors, leases, competitors } = input;
  const recs = leases.map(lease => {
    const count = countWithin(competitors, lease, WALK_RADIUS_M);
    const monthlyRent = Math.round(lease.squareFeet * lease.rentPerSqFt);
    const waitCost = Math.round((monthlyRent * waitDays) / DAYS_PER_MONTH);
    const budgetShare = profile.budgetUsd ? waitCost / profile.budgetUsd : null;
    const space = spaceFit(profile, lease.previousUse);
    const city = cityFit(cityId, lease);
    const budgetFit: LeaseFit | null = budgetShare === null ? null
      : budgetShare <= MAX_BUDGET_SHARE ? { text: "Within your budget", ok: true }
      : { text: `Uses ${Math.round(budgetShare * 100)}% of your budget`, ok: false };
    const fits = [budgetFit, space.fit, city?.fit ?? null].filter((f): f is LeaseFit => f !== null);
    return {
      lease, count, monthlyRent, waitCost, budgetShare, fits,
      okCount: fits.filter(f => f.ok).length,
      why: [space.sentence, city?.sentence].filter(Boolean).join(" "),
    };
  });
  return recs
    .filter(r => r.count < addressCompetitors)
    .sort((a, b) => a.count - b.count || a.monthlyRent - b.monthlyRent || b.okCount - a.okCount)
    .slice(0, MAX_RECOMMENDATIONS)
    .map((r, i): LeaseRec => ({
      id: r.lease.id, rank: i + 1, address: r.lease.address, area: r.lease.area, cityName: r.lease.cityName,
      lat: r.lease.lat, lng: r.lease.lng, squareFeet: r.lease.squareFeet, rentPerSqFt: r.lease.rentPerSqFt,
      monthlyRent: r.monthlyRent, previousUse: r.lease.previousUse,
      distanceMeters: Math.round(haversine(origin.lat, origin.lng, r.lease.lat, r.lease.lng)),
      competitors: r.count, saturation: saturationOf(r.count, WALK_RADIUS_M).level,
      waitCost: r.waitCost, budgetShare: r.budgetShare, why: r.why, fits: r.fits, listingUrl: r.lease.listingUrl, sample: true,
    }));
}
