// SAMPLE lease listings. Addresses, rents and sizes are fictional and NOT live offers; they show how a real
// lease feed (Crexi partner API, CoStar license) would look. Swap the source in lib/services/leases.ts.
export type PreviousUse = "cafe" | "restaurant" | "bakery" | "retail";

export type SampleLease = {
  id: string; address: string; area: string;
  cityId: "san_jose" | "sunnyvale" | "mountain_view"; cityName: string;
  lat: number; lng: number;
  squareFeet: number; rentPerSqFt: number; // asking rent, dollars per sq ft per month
  previousUse: PreviousUse;
  listingUrl: string; // where "See details" sends the owner: the lease owner's / broker's listing
};

const SJ = { cityId: "san_jose", cityName: "San José" } as const;
const SV = { cityId: "sunnyvale", cityName: "Sunnyvale" } as const;
const MV = { cityId: "mountain_view", cityName: "Mountain View" } as const;
const CITY_SLUG = { san_jose: "san-jose-ca", sunnyvale: "sunnyvale-ca", mountain_view: "mountain-view-ca" } as const;

// Placeholder listing links: a public for-lease search for the lease's city and space type. A real feed supplies each owner's own URL.
const listingUrlFor = (l: Omit<SampleLease, "listingUrl">) =>
  `https://www.loopnet.com/search/${l.previousUse === "retail" ? "retail-space" : "restaurants"}/${CITY_SLUG[l.cityId]}/for-lease/`;

const RAW: readonly Omit<SampleLease, "listingUrl">[] = [
  { id: "sl-01", address: "1180 Lincoln Ave", area: "Willow Glen", ...SJ, lat: 37.3055, lng: -121.9020, squareFeet: 1350, rentPerSqFt: 3.85, previousUse: "cafe" },
  { id: "sl-02", address: "402 W Santa Clara St", area: "Downtown", ...SJ, lat: 37.3360, lng: -121.8990, squareFeet: 1600, rentPerSqFt: 4.40, previousUse: "restaurant" },
  { id: "sl-03", address: "2210 Meridian Ave", area: "Cambrian", ...SJ, lat: 37.3000, lng: -121.9150, squareFeet: 1200, rentPerSqFt: 3.60, previousUse: "retail" },
  { id: "sl-04", address: "1620 Alum Rock Ave", area: "East San José", ...SJ, lat: 37.3555, lng: -121.8570, squareFeet: 1100, rentPerSqFt: 3.10, previousUse: "bakery" },
  { id: "sl-05", address: "640 N 13th St", area: "Japantown", ...SJ, lat: 37.3480, lng: -121.8865, squareFeet: 1250, rentPerSqFt: 3.95, previousUse: "cafe" },
  { id: "sl-06", address: "1420 The Alameda", area: "The Alameda", ...SJ, lat: 37.3330, lng: -121.9145, squareFeet: 1500, rentPerSqFt: 4.10, previousUse: "restaurant" },
  { id: "sl-07", address: "3055 Stevens Creek Blvd", area: "Stevens Creek", ...SJ, lat: 37.3235, lng: -121.9410, squareFeet: 1800, rentPerSqFt: 3.75, previousUse: "retail" },
  { id: "sl-08", address: "210 E Taylor St", area: "Northside", ...SJ, lat: 37.3495, lng: -121.8910, squareFeet: 1050, rentPerSqFt: 3.55, previousUse: "cafe" },
  { id: "sl-09", address: "355 S Murphy Ave", area: "Downtown Sunnyvale", ...SV, lat: 37.3760, lng: -122.0305, squareFeet: 1500, rentPerSqFt: 4.75, previousUse: "cafe" },
  { id: "sl-10", address: "128 S Mathilda Ave", area: "Downtown Sunnyvale", ...SV, lat: 37.3720, lng: -122.0310, squareFeet: 1400, rentPerSqFt: 4.90, previousUse: "restaurant" },

  // Mountain View: ten spaces each for a café, a restaurant and a store.
  { id: "sl-11", address: "198 Castro St", area: "Downtown", ...MV, lat: 37.3942, lng: -122.0793, squareFeet: 1100, rentPerSqFt: 5.20, previousUse: "cafe" },
  { id: "sl-12", address: "520 Showers Dr", area: "San Antonio", ...MV, lat: 37.4010, lng: -122.1100, squareFeet: 1250, rentPerSqFt: 4.60, previousUse: "cafe" },
  { id: "sl-13", address: "2580 California St", area: "California Street", ...MV, lat: 37.4002, lng: -122.1035, squareFeet: 980, rentPerSqFt: 4.35, previousUse: "cafe" },
  { id: "sl-14", address: "1040 Grant Rd", area: "Grant Road", ...MV, lat: 37.3765, lng: -122.0870, squareFeet: 1300, rentPerSqFt: 3.95, previousUse: "cafe" },
  { id: "sl-15", address: "405 Mercy St", area: "Downtown", ...MV, lat: 37.3925, lng: -122.0805, squareFeet: 900, rentPerSqFt: 5.05, previousUse: "cafe" },
  { id: "sl-16", address: "1900 Miramonte Ave", area: "Miramonte", ...MV, lat: 37.3810, lng: -122.0990, squareFeet: 1150, rentPerSqFt: 3.85, previousUse: "cafe" },
  { id: "sl-17", address: "2310 Rengstorff Ave", area: "Rengstorff", ...MV, lat: 37.4020, lng: -122.0985, squareFeet: 1050, rentPerSqFt: 4.10, previousUse: "cafe" },
  { id: "sl-18", address: "350 Bryant St", area: "Downtown", ...MV, lat: 37.3960, lng: -122.0770, squareFeet: 1200, rentPerSqFt: 4.80, previousUse: "cafe" },
  { id: "sl-19", address: "1785 W El Camino Real", area: "El Camino Real", ...MV, lat: 37.3835, lng: -122.0910, squareFeet: 1400, rentPerSqFt: 4.00, previousUse: "cafe" },
  { id: "sl-20", address: "640 Middlefield Rd", area: "Middlefield", ...MV, lat: 37.3960, lng: -122.0640, squareFeet: 1000, rentPerSqFt: 4.25, previousUse: "cafe" },

  { id: "sl-21", address: "250 Castro St", area: "Downtown", ...MV, lat: 37.3938, lng: -122.0790, squareFeet: 2200, rentPerSqFt: 5.40, previousUse: "restaurant" },
  { id: "sl-22", address: "866 W Dana St", area: "Downtown", ...MV, lat: 37.3925, lng: -122.0815, squareFeet: 2000, rentPerSqFt: 4.90, previousUse: "restaurant" },
  { id: "sl-23", address: "1990 W El Camino Real", area: "El Camino Real", ...MV, lat: 37.3830, lng: -122.0945, squareFeet: 2600, rentPerSqFt: 3.90, previousUse: "restaurant" },
  { id: "sl-24", address: "1220 Villa St", area: "Old Mountain View", ...MV, lat: 37.3910, lng: -122.0755, squareFeet: 1800, rentPerSqFt: 4.45, previousUse: "restaurant" },
  { id: "sl-25", address: "2500 Charleston Rd", area: "North Bayshore", ...MV, lat: 37.4180, lng: -122.0870, squareFeet: 2400, rentPerSqFt: 4.20, previousUse: "restaurant" },
  { id: "sl-26", address: "1600 Shoreline Blvd", area: "Shoreline", ...MV, lat: 37.4000, lng: -122.0800, squareFeet: 2100, rentPerSqFt: 4.70, previousUse: "restaurant" },
  { id: "sl-27", address: "101 E El Camino Real", area: "El Camino Real", ...MV, lat: 37.3905, lng: -122.0740, squareFeet: 2300, rentPerSqFt: 4.30, previousUse: "restaurant" },
  { id: "sl-28", address: "470 Escuela Ave", area: "San Antonio", ...MV, lat: 37.3990, lng: -122.1075, squareFeet: 1700, rentPerSqFt: 4.05, previousUse: "restaurant" },
  { id: "sl-29", address: "720 N Shoreline Blvd", area: "Shoreline", ...MV, lat: 37.4055, lng: -122.0795, squareFeet: 1950, rentPerSqFt: 4.15, previousUse: "restaurant" },
  { id: "sl-30", address: "2015 Landings Dr", area: "North Bayshore", ...MV, lat: 37.4130, lng: -122.0720, squareFeet: 3000, rentPerSqFt: 3.80, previousUse: "restaurant" },

  { id: "sl-31", address: "210 Castro St", area: "Downtown", ...MV, lat: 37.3935, lng: -122.0790, squareFeet: 1300, rentPerSqFt: 5.10, previousUse: "retail" },
  { id: "sl-32", address: "143 Castro St", area: "Downtown", ...MV, lat: 37.3948, lng: -122.0796, squareFeet: 900, rentPerSqFt: 5.35, previousUse: "retail" },
  { id: "sl-33", address: "590 Showers Dr", area: "San Antonio", ...MV, lat: 37.4005, lng: -122.1090, squareFeet: 1800, rentPerSqFt: 4.50, previousUse: "retail" },
  { id: "sl-34", address: "1160 W El Camino Real", area: "El Camino Real", ...MV, lat: 37.3850, lng: -122.0885, squareFeet: 1500, rentPerSqFt: 3.85, previousUse: "retail" },
  { id: "sl-35", address: "2020 Rengstorff Ave", area: "Rengstorff", ...MV, lat: 37.4010, lng: -122.1000, squareFeet: 1400, rentPerSqFt: 4.00, previousUse: "retail" },
  { id: "sl-36", address: "875 E El Camino Real", area: "El Camino Real", ...MV, lat: 37.3835, lng: -122.0680, squareFeet: 1600, rentPerSqFt: 3.70, previousUse: "retail" },
  { id: "sl-37", address: "465 Mercy St", area: "Downtown", ...MV, lat: 37.3928, lng: -122.0798, squareFeet: 1100, rentPerSqFt: 4.90, previousUse: "retail" },
  { id: "sl-38", address: "1470 Grant Rd", area: "Grant Road", ...MV, lat: 37.3770, lng: -122.0850, squareFeet: 1750, rentPerSqFt: 3.75, previousUse: "retail" },
  { id: "sl-39", address: "2660 California St", area: "California Street", ...MV, lat: 37.3998, lng: -122.1042, squareFeet: 1250, rentPerSqFt: 4.20, previousUse: "retail" },
  { id: "sl-40", address: "1350 Shoreline Blvd", area: "Shoreline", ...MV, lat: 37.4020, lng: -122.0793, squareFeet: 1500, rentPerSqFt: 4.60, previousUse: "retail" },
];

export const SAMPLE_LEASES: readonly SampleLease[] = RAW.map(l => ({ ...l, listingUrl: listingUrlFor(l) }));
