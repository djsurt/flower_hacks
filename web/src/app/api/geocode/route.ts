import { geocode, unverifiedGeocode } from "@/lib/services/geocode";

export async function POST(req: Request) {
  const { address } = (await req.json()) as { address?: string };
  if (!address?.trim()) return Response.json({ ok: false, error: "Enter an address." }, { status: 400 });
  try { return Response.json(await geocode(address)); }
  catch { return Response.json(unverifiedGeocode(address, "Address services are temporarily unavailable, so this plan uses the city or county named in your address.")); }
}
