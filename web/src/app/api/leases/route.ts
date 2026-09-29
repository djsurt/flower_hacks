import { competitorsAround } from "@/lib/services/places";
import { leasesNear } from "@/lib/services/leases";
import { parseLeaseQuery } from "@/lib/services/leaseQuery";
import { countWithin } from "@/lib/engine/geo";
import { LEASE_RADIUS_M, WALK_RADIUS_M, rankLeases, type LeaseResponse } from "@/lib/engine/leaseFit";

const SOURCE = "© OpenStreetMap contributors";

// Lease ideas within 3 miles that have fewer direct competitors than the owner's address. Listings are samples
// (see lib/services/leases.ts); competitor counts come from the same OpenStreetMap places as "Who you'd compete with".
export async function GET(req: Request) {
  const q = parseLeaseQuery(new URL(req.url).searchParams);
  if (!q.success) return Response.json({ error: q.error }, { status: 400 });
  const { lat, lng, type, acquisition, foodService, cityId, budgetUsd, days } = q.data;
  const leases = leasesNear(lat, lng, LEASE_RADIUS_M);
  if (!leases.length) return Response.json({ nearbyCount: 0, addressCompetitors: 0, leases: [], competitors: [], source: SOURCE } satisfies LeaseResponse);
  try {
    const places = await competitorsAround(lat, lng, LEASE_RADIUS_M + WALK_RADIUS_M, type);
    const origin = { lat, lng };
    const addressCompetitors = countWithin(places, origin, WALK_RADIUS_M);
    const ranked = rankLeases({ profile: { businessType: type, acquisition, foodService, budgetUsd }, cityId, waitDays: days, origin, addressCompetitors, leases, competitors: places });
    return Response.json({
      nearbyCount: leases.length, addressCompetitors, leases: ranked,
      competitors: places.map(p => ({ id: p.id, lat: p.lat, lng: p.lng })),
      source: SOURCE,
    } satisfies LeaseResponse);
  } catch (e) {
    return Response.json({ error: `Couldn't load nearby businesses right now (${(e as Error).message}).` }, { status: 502 });
  }
}
