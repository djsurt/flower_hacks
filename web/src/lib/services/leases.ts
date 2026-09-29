// Where lease listings come from. Today: fictional sample listings. To go live, add a LeaseSource backed by a
// licensed feed (Crexi partner API, CoStar) and pass it in; nothing else changes. No listing site is scraped.
import { SAMPLE_LEASES, type SampleLease } from "@/data/sampleLeases";
import { haversine } from "@/lib/engine/geo";

export type LeaseSource = { all: () => readonly SampleLease[] };

export const sampleLeaseSource: LeaseSource = { all: () => SAMPLE_LEASES };

/** Leases within `meters` of a point, nearest first. */
export function leasesNear(lat: number, lng: number, meters: number, source: LeaseSource = sampleLeaseSource): SampleLease[] {
  return source.all()
    .map(lease => ({ lease, d: haversine(lat, lng, lease.lat, lease.lng) }))
    .filter(x => x.d <= meters)
    .sort((a, b) => a.d - b.d)
    .map(x => x.lease);
}
