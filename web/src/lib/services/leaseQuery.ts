// Validates the /api/leases query string. Kept apart from the route so it can be tested without the server.
import { z } from "zod";
import { Acquisition, BusinessType, FoodService } from "@/lib/schemas";

const MAX_PERMIT_DAYS = 730;
const DEFAULT_PERMIT_DAYS = 120;

const LeaseQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  type: BusinessType,
  acquisition: Acquisition.default("second_generation"),
  foodService: FoodService.default("prepared_food"),
  cityId: z.string().optional(),
  budgetUsd: z.coerce.number().positive().optional(),
  days: z.coerce.number().int().min(1).max(MAX_PERMIT_DAYS).default(DEFAULT_PERMIT_DAYS),
});
export type LeaseQuery = z.infer<typeof LeaseQuery>;

/** Empty values count as absent, so a blank `budgetUsd=` does not become 0. */
export function parseLeaseQuery(q: URLSearchParams): { success: true; data: LeaseQuery } | { success: false; error: string } {
  const get = (k: string) => { const v = q.get(k); return v === null || v === "" ? undefined : v; };
  const parsed = LeaseQuery.safeParse({
    lat: get("lat"), lng: get("lng"), type: get("type"), acquisition: get("acquisition"), foodService: get("foodService"),
    cityId: get("cityId"), budgetUsd: get("budgetUsd"), days: get("days"),
  });
  return parsed.success ? { success: true, data: parsed.data } : { success: false, error: "lat, lng and type are required" };
}
