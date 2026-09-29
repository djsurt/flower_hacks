# Plan: Better-Located Leases

**Source PRD**: `.claude/prds/better-located-leases.prd.md`
**Selected Milestone**: 1. Sample lease recommendations (with the "why this fits" line from milestone 2 folded in, since the design shows both together)
**Complexity**: Medium
**Branch**: `feat/better-located-leases`
**Design**: https://claude.ai/artifact/T1dPXEnvWQeJG7zRiXBeZi

## Summary
Add a "Better-located leases" panel to the Location tab, directly below "Who you'd compete with". It shows up to 5 sample leases within 3 miles of the owner's address, ranked by fewer direct competitors, then rent, then fit with the plan. Leases come from a swappable data source seeded with 10 labelled sample listings, no scraping. Competitor counts reuse the existing OpenStreetMap places service, and fit is derived only from the plan's existing profile (the same fields the Flower agent's Intake role produces).

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Sample data | `web/src/data/helpers.ts:1-2` | Sample listings are typed, fictional, and commented as SAMPLE (fictional names, 555 phones) |
| Service layer | `web/src/lib/services/places.ts` | `"server-only"` module, in-memory cache with TTL, one shared inflight request per location |
| API route | `web/src/app/api/competitors/route.ts` | `GET` reads query params, validates with zod `safeParse`, returns `400` for bad input and `502` with a friendly message on upstream failure |
| Distance | `web/src/lib/engine/geo.ts` | `haversine` and `MILE` constants; no new distance code |
| Types | `web/src/lib/schemas.ts:28-56` | `BusinessProfile` and `Plan` types; profile fields match the Flower agent's Intake JSON (`business_type`, `food_service`, `alcohol`, `acquisition`, `budget_usd`, `target_open_date`) |
| Cost math | `web/src/lib/engine/buildPlan.ts:125` | `rent_until_open` = rent × days ÷ 30.4; reuse this formula, don't restate it |
| UI section | `web/src/components/location/Competitors.tsx` | Client component, `Section` wrapper, fetch in `useEffect` with a `live` flag, `chip` and `pill` classes, loading and error copy |
| Wiring | `web/src/components/plan/PlanView.tsx:73` | Location tab renders `<NeighborhoodView/><Competitors/>` |
| Tests | `web/tests/unit/engine.test.ts` | vitest, `describe`/`it`, small profile factories, pure functions tested without network |

No existing lease or listing code exists, so the data-source interface is new. It mirrors the shape of the `Helper` sample data and does not introduce a new architecture.

## Files to Change
| File | Action | Why |
|---|---|---|
| `web/src/data/sampleLeases.ts` | CREATE | 10 typed sample leases, labelled sample, around San José and Sunnyvale |
| `web/src/lib/services/leases.ts` | CREATE | `LeaseSource` interface, sample-backed implementation, radius filter (3 mi) |
| `web/src/lib/engine/leaseFit.ts` | CREATE | Pure ranking and fit logic: competitor comparison, rent while waiting, budget share, fit flags |
| `web/src/app/api/leases/route.ts` | CREATE | `GET` returns ranked recommendations for `lat`, `lng`, `type` and the profile fields fit needs |
| `web/src/components/location/LeaseRecommendations.tsx` | CREATE | The panel: map, ranked list, selected card, states |
| `web/src/components/location/LeaseMap.tsx` | CREATE | Leaflet map with 3-mile ring, competitor dots and numbered lease pins (mirrors `LocationMap.tsx`) |
| `web/src/components/plan/PlanView.tsx` | UPDATE | Render the new panel after `<Competitors/>` on the Location tab |
| `web/src/lib/services/places.ts` | UPDATE | Add a wide-radius competitor lookup so one request covers all leases (see Risks) |
| `web/tests/unit/leaseFit.test.ts` | CREATE | Unit tests for ranking and fit |
| `web/tests/unit/leases.test.ts` | CREATE | Radius filter and route validation tests |
| `.claude/prds/better-located-leases.prd.md` | UPDATE | Set milestone 1 to in-progress and link this plan |

## Tasks
### Task 0: Read the framework docs first
- **Action**: `web/AGENTS.md` says this Next.js version has breaking changes. Read the relevant guides in `web/node_modules/next/dist/docs/` (route handlers, client and server components) before writing code.
- **Mirror**: n/a
- **Validate**: Notes on any differences from the patterns above are captured before Task 1.

### Task 1: Sample leases and the source interface
- **Action**: Write the 10 samples (address, area, city id, lat, lng, square feet, asking rent per sq ft, previous use, listing placeholder) and a `LeaseSource` with `leasesNear(lat, lng, miles)`. The sample source is the only implementation.
- **Mirror**: `web/src/data/helpers.ts` (sample-labelled, fictional data) and `haversine` for distance.
- **Validate**: `cd web && npx vitest run tests/unit/leases.test.ts` — only samples within 3 miles are returned, sorted by distance.

### Task 2: Ranking and fit logic (test first)
- **Action**: Write failing tests, then implement the pure function `rankLeases(profile, plan, leases, competitorCounts)`. Ranking order is fewer competitors, then lower rent, then better fit. A lease is shown only if it has fewer competitors than the owner's address. Fit flags come from profile fields only: within budget, same city as the plan's jurisdiction, previous use vs `acquisition` and `foodService`. Rent while waiting uses `plan.days.typical`.
- **Mirror**: `web/tests/unit/engine.test.ts` factories; `buildPlan.ts:125` formula.
- **Validate**: `cd web && npx vitest run tests/unit/leaseFit.test.ts`

### Task 3: Competitor counts per lease
- **Action**: Add one wide-radius café lookup to `places.ts` (3 mi plus a walk radius) and count competitors around each lease and the owner's address from that single result. Do not call `placesNear` once per lease.
- **Mirror**: `placesNear` caching and inflight sharing; `competitorPlaces` for type filtering.
- **Validate**: Unit test with a fixed places array; manual check that only one Overpass request is made per address.

### Task 4: API route
- **Action**: `GET /api/leases?lat&lng&type&...` validates with zod, returns ranked leases plus the address's own count, and `400`/`502` errors in the existing style. Every lease carries `sample: true`.
- **Mirror**: `web/src/app/api/competitors/route.ts`.
- **Validate**: Route test for bad input (400) and a normal response shape.

### Task 5: UI panel and states
- **Action**: Build `LeaseRecommendations` and `LeaseMap` to match the design: header with "Sample listings" pill and "Within 3 miles" chip, plan-match chips, map, ranked list with one expanded card. Include the loading, no-results and out-of-area states, and the "Sample listing. Not a live offer." label on every card and in the footnote. Wire it into `PlanView.tsx` after `<Competitors/>`.
- **Mirror**: `Competitors.tsx` (fetch and `live` flag, `Section`), `LocationMap.tsx` (dynamic Leaflet import), `chip` and `pill` classes from `globals.css`.
- **Validate**: `cd web && npm run lint && npx tsc --noEmit`, then run the app and walk through desktop and phone widths.

### Task 6: Verification and docs
- **Action**: Run the full test suite, check coverage on new files (80% target), and add one line to the `web/` README layout listing the new pieces. Update the PRD milestone row.
- **Validate**: `cd web && npm test && npm run build`

## Validation
```bash
cd web
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run dev   # open a plan, Location tab, confirm the panel appears below "Who you'd compete with"
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| One Overpass call per lease overloads the shared public server | High | Single wide-radius lookup, cached and shared (Task 3) |
| Sample data mistaken for live listings | Medium | `sample: true` on every record, pill on the panel, label on each card, footnote |
| The web app's plan and the Flower agent's plan drift apart | Medium | Fit uses only fields both share; no agent code changes in this milestone. Whether the web app should call the agent is an open question. |
| Street address vs the agent's no-street-address rule | Medium | This feature only uses coordinates the web app already geocodes; resolve the PRD open question before any agent integration |
| Next.js version differs from the usual APIs | Medium | Task 0 reads the bundled docs first |
| A lease in another city needs a different permit plan | Medium | Show "Different city: permit steps change" and don't re-plan in this milestone |
| Working tree already has unrelated changes (`package.json`, `package-lock.json`, `tsconfig.json`) | Low | Keep them out of feature commits; stage only feature files |

## Acceptance
- [ ] All tasks complete
- [ ] Validation passes
- [ ] Every lease is labelled as a sample; no scraping code exists
- [ ] Every recommendation shows fewer competitors than the owner's address
- [ ] Patterns mirrored, not reinvented
- [ ] Desktop, phone, loading, empty and out-of-area states match the design
