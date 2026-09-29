// Distance helpers shared by the location services.
export const MILE = 1609.34;

export type Saturation = "low" | "medium" | "high";
type Point = { lat: number; lng: number };

/** How crowded a radius is, from the number of competitors inside it (per square mile). */
export function saturationOf(count: number, radiusMeters: number): { perSqMile: number; level: Saturation } {
  const miles = radiusMeters / MILE;
  const perSqMile = Math.round((count / (Math.PI * miles * miles)) * 10) / 10;
  return { perSqMile, level: perSqMile >= 14 ? "high" : perSqMile >= 7 ? "medium" : "low" };
}

/** How many points sit within `meters` of `center`. */
export function countWithin(points: readonly Point[], center: Point, meters: number): number {
  return points.filter(p => haversine(center.lat, center.lng, p.lat, p.lng) <= meters).length;
}

/** Great-circle distance in meters. */
export function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(bLat - aLat), dLng = toR(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
