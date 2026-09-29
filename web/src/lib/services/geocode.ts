// F02: resolve an address to the government that regulates it. Census is authoritative
// for jurisdiction; OpenStreetMap fills address coverage gaps such as campuses and malls.
import type { BusinessProfile, Jurisdiction } from "@/lib/schemas";

// Census place GEOID for San José (verified against the geocoder). Other cities use the Census name.
const SAN_JOSE_GEOID = "0668000";
const SUPPORTED = new Set(["san_jose", "sunnyvale"]);

export type GeocodeResult =
  | {
    ok: true;
    normalized: string;
    lat?: number;
    lng?: number;
    jurisdiction: Jurisdiction;
    resolutionSource: NonNullable<BusinessProfile["address"]["resolutionSource"]>;
    matchQuality: NonNullable<BusinessProfile["address"]["matchQuality"]>;
    warning?: string;
  }
  | { ok: false; error: string };

type CensusMatch = {
  matchedAddress: string;
  coordinates: { x: number; y: number };
  geographies: Record<string, { GEOID: string; NAME: string; BASENAME: string }[]>;
};

type NominatimAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country_code?: string;
};

type NominatimMatch = {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
};

const CENSUS_BASE = "https://geocoding.geo.census.gov/geocoder/geographies";
const NOMINATIM_BASE = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";
const LOOKUP_TIMEOUT_MS = 12_000;
const USER_AGENT = "ComplyCofounder/0.1 (+https://github.com/djsurt/flower_hacks)";
const geocodeCache = new Map<string, GeocodeResult>();
const nominatimCache = new Map<string, NominatimMatch | null>();
let nominatimQueue: Promise<void> = Promise.resolve();
let lastNominatimRequestAt = 0;

const SANTA_CLARA_CITIES = new Map([
  ["campbell", "Campbell"], ["cupertino", "Cupertino"], ["gilroy", "Gilroy"],
  ["los altos", "Los Altos"], ["los altos hills", "Los Altos Hills"], ["los gatos", "Los Gatos"],
  ["milpitas", "Milpitas"], ["monte sereno", "Monte Sereno"], ["morgan hill", "Morgan Hill"],
  ["mountain view", "Mountain View"], ["palo alto", "Palo Alto"], ["san jose", "San José"],
  ["san josé", "San José"], ["santa clara", "Santa Clara"], ["saratoga", "Saratoga"],
  ["sunnyvale", "Sunnyvale"],
]);

const cityId = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\W+/g, "_").replace(/^_|_$/g, "");
const cleanKey = (address: string) => address.trim().replace(/\s+/g, " ").toLowerCase();

export function jurisdictionFromGeographies(g: CensusMatch["geographies"]): Jurisdiction {
  const county = g["Counties"]?.[0];
  const place = g["Incorporated Places"]?.[0];
  const tract = g["Census Tracts"]?.[0]?.GEOID;
  const countyBase = county?.BASENAME;
  const countyKey = countyBase ? cityId(countyBase) : "unknown";
  const countyName = countyBase ? `${countyBase} County` : undefined;
  if (!county || !county.GEOID.startsWith("06"))
    return { kind: "out_of_area", county: countyKey, countyName, cityName: place?.BASENAME, censusTract: tract, supported: false };
  const santaClara = county.GEOID === "06085";
  if (!place) return {
    kind: "unincorporated", county: countyKey, countyName,
    cityName: `Unincorporated ${countyName}`, censusTract: tract, supported: santaClara,
  };
  const c = place.GEOID === SAN_JOSE_GEOID ? { id: "san_jose", name: "San José" } : { id: place.BASENAME.toLowerCase().replace(/\W+/g, "_"), name: place.BASENAME };
  return { kind: "city", cityId: c.id, cityName: c.name, county: countyKey, countyName, censusTract: tract, supported: santaClara && SUPPORTED.has(c.id) };
}

async function censusAddress(address: string): Promise<CensusMatch | null> {
  const url = new URL(`${CENSUS_BASE}/onelineaddress`);
  url.search = new URLSearchParams({
    address, benchmark: "Public_AR_Current", vintage: "Current_Current",
    layers: "Incorporated Places,Counties,Census Tracts", format: "json",
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
  if (!res.ok) return null;
  const body = (await res.json()) as { result?: { addressMatches?: CensusMatch[] } };
  return body.result?.addressMatches?.[0] ?? null;
}

async function censusGeographies(lat: number, lng: number): Promise<CensusMatch["geographies"] | null> {
  const url = new URL(`${CENSUS_BASE}/coordinates`);
  url.search = new URLSearchParams({
    x: String(lng), y: String(lat), benchmark: "Public_AR_Current", vintage: "Current_Current",
    layers: "Incorporated Places,Counties,Census Tracts", format: "json",
  }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
  if (!res.ok) return null;
  const body = (await res.json()) as { result?: { geographies?: CensusMatch["geographies"] } };
  return body.result?.geographies ?? null;
}

/** Public Nominatim requires no more than one request per second and cached results. */
async function nominatimAddress(address: string): Promise<NominatimMatch | null> {
  const key = cleanKey(address);
  if (nominatimCache.has(key)) return nominatimCache.get(key) ?? null;

  let release!: () => void;
  const previous = nominatimQueue;
  nominatimQueue = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try {
    const wait = Math.max(0, 1_000 - (Date.now() - lastNominatimRequestAt));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    const url = new URL("search", `${NOMINATIM_BASE.replace(/\/$/, "")}/`);
    url.search = new URLSearchParams({ q: address, format: "jsonv2", addressdetails: "1", limit: "1", countrycodes: "us" }).toString();
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.8" },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    lastNominatimRequestAt = Date.now();
    if (!res.ok) { nominatimCache.set(key, null); return null; }
    const body = (await res.json()) as NominatimMatch[];
    const match = body[0] ?? null;
    nominatimCache.set(key, match);
    return match;
  } finally {
    release();
  }
}

function placeFromAddress(address: NominatimAddress = {}) {
  return address.city ?? address.town ?? address.village ?? address.hamlet ?? address.municipality;
}

function countyParts(value?: string) {
  const base = value?.replace(/\s+County$/i, "").trim();
  return { county: base ? cityId(base) : "unknown", countyName: base ? `${base} County` : undefined };
}

function localityFromRaw(raw: string) {
  const parts = raw.split(",").map(p => p.trim()).filter(Boolean);
  const state = parts.findIndex(p => /^(?:ca|california)(?:\s+\d{5}(?:-\d{4})?)?$/i.test(p));
  return state > 1 ? parts[state - 1] : undefined;
}

function jurisdictionFromText(raw: string, address: NominatimAddress = {}): Jurisdiction {
  let locality = placeFromAddress(address) ?? localityFromRaw(raw);
  let { county, countyName } = countyParts(address.county);
  if (locality && /\s+county$/i.test(locality)) {
    ({ county, countyName } = countyParts(locality));
    locality = undefined;
  }
  const california = address.state?.toLowerCase() === "california" || /(?:,|\s)(?:ca|california)(?:\s+\d{5}(?:-\d{4})?)?\s*$/i.test(raw.trim());
  if (!california) return { kind: "out_of_area", county, countyName, cityName: locality, supported: false };

  const localKey = locality?.toLowerCase();
  const rawWithoutCounty = raw.toLowerCase().replace(/santa clara county/g, "");
  const found = (localKey && SANTA_CLARA_CITIES.has(localKey) ? [localKey, SANTA_CLARA_CITIES.get(localKey)!] as const : null)
    ?? [...SANTA_CLARA_CITIES].sort(([a], [b]) => b.length - a.length).find(([needle]) => rawWithoutCounty.includes(needle));
  if (found) {
    const [, name] = found;
    const id = cityId(name);
    return { kind: "city", cityId: id, cityName: name, county: "santa_clara", countyName: "Santa Clara County", supported: SUPPORTED.has(id) };
  }
  if (/\bstanford\b/i.test(`${locality ?? ""}, ${raw}`)) return { kind: "unincorporated", county: "santa_clara", countyName: "Santa Clara County", cityName: "Unincorporated Santa Clara County", supported: true };
  if (locality) return { kind: "city", cityId: cityId(locality), cityName: locality, county, countyName, supported: false };
  if (countyName) return { kind: "unincorporated", county, countyName, cityName: `Unincorporated ${countyName}`, supported: county === "santa_clara" };
  return { kind: "city", cityId: "california_location", cityName: "California location", county: "unknown", supported: false };
}

function tidyNominatimAddress(match: NominatimMatch, fallback: string) {
  const a = match.address ?? {};
  const street = [a.house_number, a.road ?? a.pedestrian].filter(Boolean).join(" ");
  const locality = placeFromAddress(a);
  const stateZip = [a.state, a.postcode].filter(Boolean).join(" ");
  const concise = [street, locality, stateZip].filter(Boolean).join(", ");
  return concise || match.display_name || fallback.trim();
}

export function unverifiedGeocode(address: string, detail?: string): Extract<GeocodeResult, { ok: true }> {
  return {
    ok: true,
    normalized: address.trim().replace(/\s+/g, " "),
    jurisdiction: jurisdictionFromText(address),
    resolutionSource: "text",
    matchQuality: "unverified",
    warning: detail ?? "We couldn't verify the exact map pin, so this plan uses the city or county named in your address.",
  };
}

export async function geocode(address: string): Promise<GeocodeResult> {
  const key = cleanKey(address);
  if (!key) return { ok: false, error: "Enter an address." };
  const cached = geocodeCache.get(key);
  if (cached) return cached;

  try {
    const match = await censusAddress(address);
    if (match) {
      const result: GeocodeResult = {
        ok: true,
        normalized: tidyAddress(match.matchedAddress),
        lat: match.coordinates.y,
        lng: match.coordinates.x,
        jurisdiction: jurisdictionFromGeographies(match.geographies),
        resolutionSource: "census",
        matchQuality: "exact",
      };
      geocodeCache.set(key, result);
      return result;
    }
  } catch { /* use the next provider */ }

  try {
    const match = await nominatimAddress(address);
    if (match) {
      const lat = Number(match.lat), lng = Number(match.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        let geographies: CensusMatch["geographies"] | null = null;
        try { geographies = await censusGeographies(lat, lng); } catch { /* infer below */ }
        const exact = Boolean(match.address?.house_number && (match.address.road || match.address.pedestrian));
        const result: GeocodeResult = {
          ok: true,
          normalized: tidyNominatimAddress(match, address),
          lat,
          lng,
          jurisdiction: geographies ? jurisdictionFromGeographies(geographies) : jurisdictionFromText(address, match.address),
          resolutionSource: "openstreetmap",
          matchQuality: exact ? "exact" : "approximate",
          ...(!geographies ? { warning: "The map pin was found, but its city/county boundary was inferred while the government boundary service was unavailable." } : {}),
        };
        geocodeCache.set(key, result);
        return result;
      }
    }
  } catch { /* fall through to a non-blocking city-level plan */ }

  const result = unverifiedGeocode(address);
  return result;
}

/** Keep provider throttling and caches isolated between unit tests. */
export function resetGeocodeStateForTests() {
  geocodeCache.clear();
  nominatimCache.clear();
  nominatimQueue = Promise.resolve();
  lastNominatimRequestAt = 0;
}

/** Census returns "87 N SAN PEDRO ST, SAN JOSE, CA, 95110"; show "87 N San Pedro St, San Jose, CA 95110". */
export function tidyAddress(a: string) {
  const parts = a.split(",").map(p => p.trim());
  const zip = /^\d{5}(-\d{4})?$/.test(parts[parts.length - 1] ?? "") ? parts.pop() : undefined;
  const state = parts.pop();
  const title = (p: string) => p.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\b(N|S|E|W|Ne|Nw|Se|Sw)\b/g, d => d.toUpperCase());
  return [...parts.map(title), [state, zip].filter(Boolean).join(" ")].join(", ");
}
