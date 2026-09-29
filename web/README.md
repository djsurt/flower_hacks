# Comply Cofounder (web app)

Tell it what you're opening and where. It returns every city, county, state and federal step in order, a realistic opening date, a startup budget, nearby competitors and grants, all written for a first-time owner. Change anything by chatting and see exactly what changed.

## Run it

```bash
cp .env.example .env.local
npm install                 # Node 22+
npm run dev        # http://localhost:3000
npm test           # engine unit tests
```

The chat always uses the local Flower Bridge. The default is:

```
FLOWER_BRIDGE_URL=http://127.0.0.1:8787
FLOWER_RUN_TIMEOUT_MS=120000
```

Start SuperLink and the bridge from `flower-agent/` before sending a chat message. Model credentials belong in the SuperLink shell and are never read by Next.js.

## How it fits together

- `src/rules/*.json`: permits, costs, incentives. **All plan facts live here.** Each permit has a plain-language name, phase, "what to do" steps, contact, official source link and `verified`/`lastVerified`.
- `src/lib/engine/buildPlan.ts`: pure `buildPlan(profile)`. Selects rules by jurisdiction + json-logic, schedules by dependencies (fast/typical/slow), finds the critical path, estimates costs (rent while waiting comes from the timeline), matches incentives.
- `src/lib/engine/diff.ts`: `diffPlans` + `humanSummary` for the "What changed" card. Numbers always come from here.
- `src/lib/services/geocode.ts`: US Census geocoder → city / unincorporated / out-of-area.
- `src/lib/services/places.ts`, `neighborhood.ts`: OpenStreetMap places and Census Reporter demographics.
- `src/lib/llm/chatAgent.ts`: the `update_profile` schema, deterministic executor and plan snapshot sent to Flower.
- `src/app/api/chat/route.ts`: proxies the Flower event stream, validates emitted patches, and rebuilds the plan.
- `src/lib/defaults.ts`: fills everything the owner didn't say and records it as `assumed`.

## Minimal intake, then chat

The owner gives two things: business type and address. Everything else starts as a typical default for that type (shown read-only as "Assuming for now") and gets filled in by talking.

`/api/chat` streams NDJSON events from a Flower AgentApp. Flower interprets the owner's message and emits a candidate `comply.profile_patch`; high-impact changes pass through a second Reviewer role. The web route validates every patch with zod, applies it (including geocoding when the address changes), and rebuilds the deterministic plan. Flower never writes permit, cost or timeline facts directly.

## Data status (checked 2026-09-28)

Checked against official pages: San José business tax rates and 90-day registration rule, County DEH plan review process and inspections, change-of-ownership rule, Streamlined Restaurant Program criteria and timeline, ABC 2026 application fees and process, CDTFA seller's permit, EDD registration, County FBN fee, the 60-day food safety certificate rule, and the Vacant/Existing Storefront grants. Rules not yet checked, and fees that are estimates (DEH plan check and permit fees, building permit fees), are marked **Needs verification** or carry a `feeNote` in the UI.

Some official sites (sanjoseca.gov, santaclaracounty.gov) block automated downloads; they were read via the Internet Archive or search. Re-check the DEH fee schedule by hand: https://deh.santaclaracounty.gov/environmental-health-fee-adjustment-2026

## Location data (F06)

`/api/neighborhood` and `/api/competitors` read OpenStreetMap (Overpass API) and Census Reporter at request time and cache per location. The busy-hours chart is a model built from nearby places, not a measured count. County health inspection scores are the next data source to add.
