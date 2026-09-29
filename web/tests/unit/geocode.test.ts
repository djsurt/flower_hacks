import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geocode, resetGeocodeStateForTests } from "@/lib/services/geocode";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

const santaClaraGeographies = (place = false) => ({
  Counties: [{ GEOID: "06085", NAME: "Santa Clara County", BASENAME: "Santa Clara" }],
  ...(place ? { "Incorporated Places": [{ GEOID: "0668000", NAME: "San Jose city", BASENAME: "San Jose" }] } : {}),
  "Census Tracts": [{ GEOID: "06085511608", NAME: "Census Tract 5116.08", BASENAME: "5116.08" }],
});

describe("resilient address lookup", () => {
  beforeEach(() => resetGeocodeStateForTests());
  afterEach(() => vi.unstubAllGlobals());

  it("uses an exact Census address match first", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ result: { addressMatches: [{
      matchedAddress: "87 N SAN PEDRO ST, SAN JOSE, CA, 95110",
      coordinates: { x: -121.894, y: 37.336 },
      geographies: santaClaraGeographies(true),
    }] } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await geocode("87 N San Pedro St, San Jose, CA 95110");

    expect(result).toMatchObject({ ok: true, resolutionSource: "census", matchQuality: "exact", normalized: "87 N San Pedro St, San Jose, CA 95110" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to OpenStreetMap for a Stanford campus address, then asks Census for its boundary", async () => {
    const fetchMock = vi.fn().mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url.includes("/onelineaddress")) return Promise.resolve(json({ result: { addressMatches: [] } }));
      if (url.includes("nominatim.openstreetmap.org")) return Promise.resolve(json([{
        lat: "37.4299579", lon: "-122.1718247", display_name: "389, Jane Stanford Way, Stanford, California, 94305, United States",
        address: { house_number: "389", road: "Jane Stanford Way", village: "Stanford", county: "Santa Clara County", state: "California", postcode: "94305" },
      }]));
      if (url.includes("/coordinates")) return Promise.resolve(json({ result: { geographies: santaClaraGeographies(false) } }));
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await geocode("389 Jane Stanford Way, Stanford, CA");

    expect(result).toMatchObject({
      ok: true,
      resolutionSource: "openstreetmap",
      matchQuality: "exact",
      normalized: "389 Jane Stanford Way, Stanford, California 94305",
      lat: 37.4299579,
      lng: -122.1718247,
      jurisdiction: { kind: "unincorporated", county: "santa_clara", supported: true, censusTract: "06085511608" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("still returns a city-level plan when all address providers are unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await geocode("660 Stanford Shopping Center, Palo Alto, CA 94304");

    expect(result).toMatchObject({
      ok: true,
      resolutionSource: "text",
      matchQuality: "unverified",
      jurisdiction: { kind: "city", cityId: "palo_alto", cityName: "Palo Alto", supported: false },
    });
    if (result.ok) {
      expect(result.lat).toBeUndefined();
      expect(result.warning).toMatch(/couldn't verify/i);
    }
  });

  it("does not mistake a Santa Clara County label for the City of Santa Clara", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await geocode("123 Main St, Santa Clara County, CA");
    expect(result).toMatchObject({ ok: true, jurisdiction: { kind: "unincorporated", county: "santa_clara", countyName: "Santa Clara County", supported: true } });
  });

  it("keeps a California address in statewide coverage when providers are unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await geocode("1340 S Hill St, Los Angeles, CA 90015");
    expect(result).toMatchObject({
      ok: true,
      resolutionSource: "text",
      jurisdiction: { kind: "city", cityId: "los_angeles", cityName: "Los Angeles", supported: false },
    });
  });
});
