# Agent Architecture — Comply Cofounder on Flower SuperGrid

> Build spec for the Main Agent and its subagents. Companion to `data-model.md`, `data-sources.md` and `flower-agent/README.md`.
> Target: Flower Collaborative Agent Hackathon, Stanford, 2026-09-29.

---

## 0. The design decision that drives everything

The naive reading of "Main Agent + RoadMap + Cost + Location" is three parallel lookups stapled to a summary. That is orchestration, and it scores poorly on the hackathon's first criterion ("how much does the project use Flower Agents and SuperGrid") because it would work just as well as three functions in one process.

This spec instead makes the subagents **mutually dependent**, so the answer emerges from their interaction:

```
Location finds 5 candidate spaces
  → each space has a DIFFERENT address
    → each address has a DIFFERENT jurisdiction (city vs. unincorporated county)
      → RoadMap returns a DIFFERENT permit set per space
        → Cost returns a DIFFERENT cost-and-time-to-open per space
          → Main Agent ranks spaces by TOTAL COST TO OPEN, not by rent
```

That last line is the product. A storefront that is \$800/month cheaper but sits in a jurisdiction where the building permit takes eleven extra weeks is the more expensive space. **No single agent can compute that** — which is precisely the collaboration the hackathon asks to see.

It is also the literal meaning of the tagline: _know before you sign the lease._

---

## 1. Topology

Each subagent is its own **AgentApp published to SuperGrid**, not a function call. The Main Agent holds no domain knowledge; it holds the contract, the fan-out, the merge and the human gate.

```
                        ┌──────────────────────────┐
     owner ────────────►│      MAIN AGENT          │
                        │  (orchestrator AgentApp) │
                        │  intake · fan-out ·      │
                        │  merge · rank · approve  │
                        └───┬──────┬──────┬────────┘
                            │      │      │      fan-out, parallel
              ┌─────────────┘      │      └─────────────┐
              ▼                    ▼                    ▼
      ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐
      │  LOCATION     │   │   ROADMAP     │   │      COST         │
      │  AgentApp     │   │   AgentApp    │   │      AgentApp     │
      └───────┬───────┘   └───────┬───────┘   └─────────┬─────────┘
              │                   │                     │
        ┌─────▼─────┐       ┌─────▼─────┐         ┌─────▼─────┐
        │ REAL-     │       │ City /    │         │ Public    │
        │ ESTATE    │       │ County /  │         │ fee       │
        │ SUPERNODE │       │ State     │         │ schedules │
        │ (federated│       │ sub-roles │         │     +     │
        │  brokers) │       │ (parallel)│         │ FEDERATED │
        └───────────┘       └───────────┘         │ QUOTE     │
                                                  │ NODES     │
                                                  └───────────┘
                            ▼
                    ┌───────────────┐
                    │   CHECKER     │  provenance gate — runs on every
                    │  (deterministic)│  fact before the owner sees it
                    └───────────────┘
                            ▼
                    HUMAN APPROVAL GATE
```

Reuse what already exists in `flower-agent/agent/`: `run_role()` for the capped tool loop, `planning.py` for the deterministic schedule and `check_sources()`, `rules.py` as offline fallback. Those are assets — the Checker and the APPROVE gate are already stronger than most hackathon entries.

---

## 2. Main Agent

### 2.1 Role

```
You are the Main Agent of Comply Cofounder. You help a first-time owner open a
physical business. You coordinate three specialist agents; you never produce a
permit, a fee, a duration or a listing yourself.

Your four jobs:
  1. Turn the owner's message into a validated MerchantProfile.
  2. Fan out to Location, RoadMap and Cost, in the right order, in parallel
     where they do not depend on each other.
  3. Merge their answers into ranked OpeningOptions and explain the ranking in
     plain language a first-time owner understands.
  4. Stop, present, and wait for a human to approve. Never act without APPROVE.

Hard rules:
  - You state no fact that did not arrive from a subagent with a source.
  - When subagents disagree, you surface the disagreement. You do not average it.
  - You say "we don't know" rather than filling a gap. An unknown is a finding.
  - You never send the owner's street address to a web search. City and county only.
  - You speak to someone signing a lease for the first time. No agency jargon
    without a plain-language gloss.
```

### 2.2 Input

Widen the original two fields — they underdetermine the plan, and both RoadMap and Cost branch hard on the extras.

```jsonc
MerchantProfile {
  // required
  "merchant_type":  "CAFE" | "RESTAURANT" | "RETAIL_BOUTIQUE",
  "address":        string,        // full address, OR...
  "search_area":    string | null, // ...a neighborhood/city when the owner has no space yet

  // high-impact optional — ask at most ONE, pick the one that changes the plan most
  "food_service":   "none" | "prepackaged_only" | "prepared_food",
  "alcohol":        "none" | "beer_wine" | "full_bar",
  "acquisition":    "new_buildout" | "second_generation" | "change_of_ownership",
  "square_feet":    number | null,
  "seats":          number | null,
  "employees":      number | null,
  "entity_type":    "llc" | "sole_prop" | "corporation" | "partnership",
  "exterior_sign":  boolean,
  "budget_usd":     number | null,
  "target_open_date": "YYYY-MM-DD" | null,

  // provenance of the profile itself
  "assumed":        string[]       // fields filled by default, shown to the owner as chips
}
```

**Defaults** (never block on a question you can default): CAFE/RESTAURANT → `prepared_food`, `none` alcohol, `second_generation`, 4 employees; RETAIL_BOUTIQUE → `none` food, `new_buildout`, 1 employee. Everything defaulted goes in `assumed[]` so the UI can show it and the owner can correct it conversationally.

**Two entry modes.** `address` present → _plan mode_ (score one space). `search_area` present, no address → _discovery mode_ (find and rank spaces). Discovery mode is the better demo.

### 2.3 Orchestration

```
STEP 0  Intake          → MerchantProfile (one question max, else defaults)
STEP 1  Location        → up to 5 CandidateSpace (discovery mode)
                          or 1 CandidateSpace (plan mode)
STEP 2  FAN OUT — for each candidate, in parallel:
           RoadMap(profile, candidate) ─┐
                                        ├─► per-candidate plan
           Cost(profile, candidate) ────┘   (Cost needs RoadMap's permit list,
                                             so within a candidate these are
                                             sequential; ACROSS candidates all
                                             candidates run in parallel)
STEP 3  Checker         → flag every fact lacking an official source
STEP 4  Rank            → OpeningOption[] sorted by total cost to open
STEP 5  Present + STOP  → "Reply APPROVE to confirm, or tell me what to change."
STEP 6  (post-APPROVE)  → reminders via start_automation; nothing is ever filed
```

**SuperGrid has a 5-minute task timeout.** This is the main engineering constraint. Mitigations, in order of importance:

1. Fan out across candidates concurrently — never loop serially over 5 addresses.
2. Cap discovery at **3 candidates** for the live demo; 5 offline.
3. Each subagent must return partial results on timeout, tagged `"partial": true`, rather than failing the whole run.
4. `rules.py` fallback fires the moment an agency search comes back empty — a degraded answer beats a dead run on stage.
5. Emit `comply.status` events continuously so the UI shows motion during the slow stretch. Your existing demo already does this well; keep it.

### 2.4 Output

```jsonc
OpeningOption {
  "candidate":        CandidateSpace,
  "jurisdiction":     { "kind": "city"|"unincorporated"|"out_of_area",
                        "city": string, "county": string, "supported": boolean },
  "permits":          PermitStep[],          // from RoadMap
  "costs":            CostBreakdown,         // from Cost
  "projected_open":   "YYYY-MM-DD",
  "months_of_rent_before_revenue": number,
  "total_cost_to_open": { "low": number, "typical": number, "high": number },
  "critical_path":    string[],              // permit step ids
  "confidence":       "sourced" | "mixed" | "needs_verification",
  "why_this_rank":    string,                // one sentence, plain language
  "watch_out_for":    string[]               // e.g. "ABC census tract is over-concentrated"
}
```

The headline the Main Agent says out loud is **not** rent and **not** permit count. It is:

> "150 S Murphy is \$600/month cheaper, but Sunnyvale's building permit path adds about 4 weeks — so it costs roughly \$7K more to actually open. San Pedro opens Feb 27; Murphy opens Mar 29."

---

## 3. Subagent — LOCATION

### 3.1 Role

```
You are the Location agent. You find physical spaces a specific kind of business
could actually occupy, and you describe what surrounds them.

You return candidate spaces. You never judge whether the business is ALLOWED
there — that is RoadMap's job — but you DO flag anything you can see that would
obviously block it, so RoadMap can check it first.

You never invent a listing. A space you cannot source is a space you do not return.
```

### 3.2 The Real-Estate SuperNode — federated, and this is the point

Commercial listings are the classic non-shareable dataset. Brokers will not upload their pre-market inventory to a startup's server, and the good spaces never reach public portals.

So don't ask them to. Each broker/landlord runs a **node holding their own listings locally**. The Location agent broadcasts a _query_ across the federation; each node matches against its own inventory and returns only what fits, or refuses. Raw books never move.

```
Location agent
   │  query: { merchant_type, area, sq_ft range, budget, must_allow_food }
   ├──► Broker node A   → 2 matches (returns listing summaries only)
   ├──► Broker node B   → 0 matches (refuses: outside area)
   ├──► Landlord node C → 1 match
   └──► Public fallback → OSM vacant/retail + city vacancy data
                                │
                          merge, dedupe by address, rank
```

For the hackathon, run 2–3 broker nodes as separate processes with small seeded JSON inventories. That is enough to demonstrate real federation — it is exactly the shape [PreventNet](https://github.com/UtkarshMidha/PreventNet) used (four processes, institutional separation, runs identically on SuperGrid).

Say the line out loud in the demo: **"we never see their book."**

### 3.3 Output

```jsonc
CandidateSpace {
  "id": string,
  "address": string,              // full, normalized
  "lat": number, "lng": number,
  "source": "broker_node:<id>" | "public:<dataset>",
  "square_feet": number | null,
  "monthly_rent_usd": number | null,
  "prior_use": string | null,     // "former pizza place" → second_generation, big cost signal
  "has_hood": boolean | null,     // presence of a Type I hood swings buildout by $8–25K
  "grease_interceptor": boolean | null,
  "vacant_months": number | null, // drives vacant-storefront grant eligibility
  "neighborhood": {
    "transit_within_400m": number, "parking_spaces": number,
    "same_type_within_800m": number,     // competitor saturation
    "median_income": number, "residents": number,
    "busiest_hour_weekday": number
  },
  "obvious_blockers": string[],   // "no ventilation shaft", "residential zone adjacent"
  "sources": string[]
}
```

`prior_use`, `has_hood` and `grease_interceptor` matter more than anything else on this list. They flip `acquisition` between `second_generation` and `new_buildout`, which is the single largest swing in both the permit set and the cost estimate. Location earns its place by surfacing them.

### 3.4 Tools allowed

`web_search`, `web_fetch` (public listings, OSM, Census), `query_realestate_federation`. **Not** `start_automation`. City and county only in searches — never the owner's address.

---

## 4. Subagent — ROADMAP

### 4.1 Role

```
You are the RoadMap agent. Given a business and ONE specific address, you return
every permit, license and registration needed to open legally, in dependency
order, each with its issuing agency and an official source.

You are pessimistic by construction. A step you are unsure about is included and
marked "needs verification", never dropped. Omitting a required permit costs the
owner months; including a spurious one costs them a phone call.
```

### 4.2 Internal fan-out

RoadMap is itself a small federation — four sub-roles that run **in parallel**, not in series. This is where most of the 5-minute budget goes, so parallelism is not optional.

| Sub-role          | Scope                                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Jurisdiction**  | US Census geocoder → city / unincorporated / out-of-area + tract. Runs first; everything else depends on it.                 |
| **City**          | Business license or tax certificate, zoning clearance, building, fire, sign, sidewalk/outdoor seating                        |
| **County**        | DEH food facility plan check, health permit, change-of-ownership (**not transferable** — a classic trap), Clerk-Recorder FBN |
| **State/Federal** | SOS entity, CDTFA seller's permit, EDD employer, ABC alcohol, food-manager cert, IRS EIN                                     |

Then a deterministic **Planner** (`planning.py`, already written) fixes dependencies, computes topological order, critical path and projected opening date. The LLM proposes edges; arithmetic is never done by a model.

### 4.3 Non-negotiable dependency rules

Hard-code these; do not let a model rediscover them per run:

- zoning clearance **before** building permit
- County health plan approval **before** building permit, for any food business
- building permit **before** construction **before** final inspection
- final inspection **before** health permit to operate
- EIN **before** seller's permit and **before** employer registration
- ABC application may run in parallel, but **issuance** gates opening day
- change of ownership: the prior owner's health permit **does not transfer**

### 4.4 Output

```jsonc
PermitStep {
  "id": string,                    // snake_case
  "name": string,                  // plain language: "Get your kitchen plans approved"
  "agency": string,
  "level": "city" | "county" | "state" | "federal",
  "phase": "before_lease" | "register" | "build" | "before_open" | "after_open",
  "depends_on": string[],
  "duration_days": { "min": number, "typical": number, "max": number },
  "fee_usd":       { "min": number, "typical": number, "max": number },
  "what_to_do":    string[],       // numbered, concrete
  "required_docs": string[],
  "source_url":    string,         // MUST be official; Checker enforces
  "last_verified": "YYYY-MM-DD",
  "verified":      boolean,
  "gates_opening": boolean,        // false = can finish after opening day
  "warnings":      string[]        // "Does NOT grant zoning approval"
}
```

The `warnings` field carries the highest-value content in the product. San José's Business Tax Certificate granting neither zoning nor fire nor health approval is the exact misunderstanding that costs first-time owners months.

---

## 5. Subagent — COST

### 5.1 Role

```
You are the Cost agent. You estimate what it costs to open — and you are ruthless
about the difference between a PUBLISHED FEE and an ESTIMATE.

Every line you return carries a `basis`. There is no third option:
  "published"  — a government fee schedule, cited
  "federated"  — an aggregate over real jobs from the quote federation, with n
  "assumption" — our model. Labelled as such, in the UI, always.

You never present an assumption as if it were sourced.
```

This rule exists for a concrete reason. Today `costs.json` holds **34 rules, none verified, none with a source URL** — and that number is the headline of the demo. A judge who clicks it finds nothing behind it. Adding `basis` is a few hours of work and converts the product's weakest claim into a display of rigor.

### 5.2 The two halves

**Public and citable** — permit and license fees. City master fee schedules, County DEH fee schedule, CA ABC fee schedule, SOS filing fees. These should reach ~100% `basis: "published"`. No excuse for a guess here.

**Private and federated** — contractor quotes, architect fees, expediter retainers, hood installs, equipment. No public source exists, and the firms holding the data will not upload it. Same federation pattern as Location: **quote nodes** run by expediters, GCs and SBDCs answer aggregate queries over their own job history.

```
Cost agent asks the federation:
  "café · 1,500 sq ft · second-generation · San José · County plan check"

  Expediter node  → n=11, median $2,400, p10–p90 $1,500–$3,800
  GC node         → n=7,  median $2,600
  SBDC node       → refuses (insufficient n, privacy floor)

  → returned: "$2,400 typical, from 18 real jobs across 2 firms"
```

Enforce a **minimum-n floor** (n ≥ 5) before any aggregate is released — a node with two jobs is disclosing a customer's price. The refusal is a feature; make the demo show one.

### 5.3 Output

```jsonc
CostLine {
  "category": "permits_fees" | "deposits" | "buildout" | "equipment" |
              "inventory" | "professional_services" | "carrying_costs" | "contingency",
  "label": string,
  "low": number, "typical": number, "high": number,
  "basis": "published" | "federated" | "assumption",
  "source_url": string | null,        // required when basis = "published"
  "sample_size": number | null,       // required when basis = "federated"
  "note": string | null
}

CostBreakdown {
  "lines": CostLine[],
  "total": { "low": number, "typical": number, "high": number },
  "rent_carry_until_open": number,    // months_to_open × monthly_rent — usually the
                                      // largest single line, and the one owners forget
  "pct_sourced": number,              // share of total backed by published/federated
  "over_budget_by": number | null
}
```

`pct_sourced` is a one-number honesty meter. Put it on screen. _"71% of this estimate is backed by published fees or real jobs"_ is a far stronger claim than a confident total with nothing behind it.

---

## 6. The Checker — provenance gate

Runs **deterministically** (no model) on every fact before the owner sees it. Already implemented as `check_sources()`; extend it:

| Check                                                              | Action on failure                         |
| ------------------------------------------------------------------ | ----------------------------------------- |
| `source_url` present and on an official domain (`.gov`, `.ca.gov`) | mark `needs_verification`                 |
| `basis: "published"` has a `source_url`                            | reject the line                           |
| `basis: "federated"` has `sample_size ≥ 5`                         | suppress, return "insufficient data"      |
| `last_verified` within 180 days                                    | mark stale                                |
| Two subagents give conflicting fees for the same step              | surface both, do not average              |
| Any step lacking `depends_on` resolution                           | block the plan, ask the Planner to re-run |

A model cannot be allowed to talk its way past this. That is the lesson from both winning projects: deterministic verification beneath the reasoning layer, so a sabotaged or hallucinating agent cannot influence the outcome through fluent prose.

---

## 7. Human approval gate

Unchanged from the current implementation, because it already works:

1. Plan is presented. The run **stops**.
2. `"Reply APPROVE to confirm, or tell me what to change."`
3. A correction — _"step 4 fee is \$5,500, source https://…"_ — routes to the **Reviewer**, which applies only what the human stated, then re-plans and re-checks.
4. Only an explicit `APPROVE`, read from run-series history, confirms.
5. Only after approval can reminders be scheduled. **Nothing is ever filed with any agency automatically.**

A human correction should also be offered back to the federation as a verified data point. That is the flywheel: every expert correction makes every future plan better, and the correction is a _judgement_, not a record — safe to share.

---

## 8. Safety envelope

Carry forward what `agent_app.py` already enforces, and extend to the new nodes:

- **Per-agent tool allow-lists.** Every call validated against the agent's list. Location cannot schedule reminders; RoadMap cannot query the quote federation.
- **Tool loop cap** of 5 iterations per role.
- **No street address in web search.** City and county only. This must hold across all three subagents now, not just one.
- **No PII in logs or status events** — counts and role names only.
- **Federation privacy floor:** n ≥ 5, aggregates only, refusal always permitted and always shown.
- **No automated filing, ever.** The product produces a plan; a human acts on it.

---

## 9. Demo script (5 minutes)

1. `"I want to open a café somewhere in downtown San José, around 1,500 sq ft, budget $250K."` — no address. Discovery mode.
2. Location fans out to three broker nodes. **One refuses.** Say: _"that broker's inventory never left their machine."_
3. Three candidates come back. RoadMap and Cost fan out across all three **in parallel** — the status feed shows nine agents working at once.
4. Results ranked. The cheapest rent is **not** first. Read the reason out loud: _"\$600/month cheaper, but a different jurisdiction and four more weeks of permits — \$7K more to actually open."_
5. Checker has flagged one step with no `.gov` source. Correct it live: _"step 4 fee is \$5,500, source https://www.sanjoseca.gov/…"_ — plan re-computes.
6. `APPROVE` → reminders scheduled.
7. Close: **"Three federations, none of them shared their data, and every number on this screen has a source or says it doesn't."**

---

## 10. Build order for the remaining hours

| #   | Task                                                               | Why first                                   |
| --- | ------------------------------------------------------------------ | ------------------------------------------- |
| 1   | Switch `model` to **Endeavor** in `pyproject.toml`                 | One line, explicit bonus points             |
| 2   | Split RoadMap's City/County/State sub-roles to run **in parallel** | Buys the time budget everything else needs  |
| 3   | Add `basis` to every `CostLine` + `pct_sourced`                    | Highest credibility-per-hour in the repo    |
| 4   | Stand up 2–3 broker nodes with seeded JSON                         | Makes the federation real and visible       |
| 5   | Fan out RoadMap+Cost across candidates; rank by total cost to open | **The feature.** Do not cut this one.       |
| 6   | Wire one quote node with the n ≥ 5 refusal                         | The refusal is the most memorable demo beat |
| 7   | Rehearse the script                                                | Demo & Delivery is a third of the score     |

If time runs short, cut #6 before #5. The ranking is the idea; the quote federation is the proof.

---

## 11. Open questions

- Do broker nodes return rent figures, or only ranges? Real brokers would resist exact numbers pre-market — a range may be both safer and more realistic.
- When two candidates sit in different cities, do we run the full RoadMap per candidate, or diff against a cached base plan? Full run is correct and slower; caching is the fallback if the timeout bites.
- Should `pct_sourced` be visible to the owner, or only to brokers and partners? Arguments both ways — it is honest, and it is also an admission.

# Data Sources — what the product runs on, and what it still needs

> Owner: product. Companion to `product-overview.md` and `data-model.md`.
> Status date: 2026-09-29. Assessed against `web/src/rules/*.json`, `web/src/lib/services/*`, `web/src/data/helpers.ts` and the demo.

## 1. The one-line finding

Everything the demo shows about **the place** is live public data. Everything it shows about **the rules** — 42 permits, 34 cost lines, 6 incentives — is hand-researched JSON verified once, by hand, on 2026-09-28. That asymmetry is the product's central risk and its central moat opportunity: the rules are what customers pay for, and today they are a manually maintained artifact for two cities.

## 2. What is live today

| Source                                                                                                    | Feeds                                                                 | Key  | Status                                                                |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---- | --------------------------------------------------------------------- |
| [US Census Geocoder](https://geocoding.geo.census.gov/)                                                   | Address → city / unincorporated / out-of-area, census tract (F02)     | none | Live, working                                                         |
| [Census Reporter](https://censusreporter.org/) (ACS 5-yr: B01003, B11001, B19013, B01002, B25003, B08301) | Demographics on Location tab                                          | none | Live. Third-party mirror of the ACS — single point of failure         |
| [OpenStreetMap / Overpass](https://overpass-api.de/)                                                      | Transit, parking, bike share, nearby businesses, competitor map (F06) | none | Live. Shared public server, retries on 429/504 — not production-grade |
| OpenAI / Anthropic API                                                                                    | Chat → `ProfilePatch` only. Never writes plan facts                   | yes  | Live, correctly firewalled from plan facts                            |

## 3. What looks live but is not

| Shown as                                                                 | Actually                                                                   | Where                      |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------- |
| 42 permits with durations, fees, dependencies                            | Hand-written JSON. 26/42 verified, 16 unverified with empty `lastVerified` | `rules/permits.json`       |
| "Startup cost $237K–$301K" — the headline number in the demo             | 34 cost rules, **0 verified**, no `sourceUrl` on any of them               | `rules/costs.json`         |
| Grants & help                                                            | 6 rules, 3 verified. No status feed — a paused program still shows         | `rules/incentives.json`    |
| "Who can help" vendor listings                                           | Fictional names, 555 phone numbers                                         | `data/helpers.ts`          |
| Competitor health scores (in `data-model.md` as `Competitor.inspection`) | Field exists, never populated. UI says so in small print                   | `api/competitors/route.ts` |
| Timeline "~42 days, 28–70 days"                                          | Expert estimate, not measured                                              | `rules/permits.json`       |

The cost estimate is the weakest link relative to its prominence. It is the number a broker or owner will quote back at you, and it currently has no citation at all.

## 4. Priority data sources to add

### Tier 1 — makes the core claim defensible

**1. Santa Clara County DEH food facility inspections + facility registry**

- [`SCC_DEH_Food_Data_INSPECTIONS`](https://data.sccgov.org/Health/SCC_DEH_Food_Data_INSPECTIONS/2u2d-8jej) and [`SCC_DEH_Food_Data_FEED_INFO`](https://data.sccgov.org/Health/SCC_DEH_Food_Data_FEED_INFO/itys-r3sp) — Socrata, free, SoQL API.
- Unblocks: `Competitor.inspection` (placard + score), already in the data model and already promised in the README. Also gives a **real, address-matched list of operating food facilities** — better than OSM for competitor counts and saturation, and it carries permit dates.
- Effort: low. Socrata API, no key needed for modest volume.

**2. San José building permit data — for measured, not estimated, durations**

- [Active Building Permits](https://data.sanjoseca.gov/dataset/active-building-permits) (daily), [Permits Under Inspection](https://data.sanjoseca.gov/dataset/building-permits-under-inspection), [Expired Building Permits](https://data.sanjoseca.gov/dataset/expired-building-permits). CKAN API.
- Unblocks: replacing `durationDays: {min, typical, max}` guesses with distributions from actual applied→issued→finaled dates, filtered to commercial TI / food service. This is the difference between "a planner's estimate" and "in this city, 8 of 10 cafés got there in 6–14 weeks."
- Also unblocks F19 property-first mode and broker-facing analytics.
- Effort: medium. Verify column names and whether all three date stamps are present before committing to it — the portal's preview was unavailable at time of writing.
- **Do this before scaling cities.** It defines the ingestion pattern every other city's Accela/Tyler portal will follow.

**3. A rule-verification pipeline (source monitoring), not a dataset**

- The rules are the asset. They need `lastVerified` to mean something.
- Minimum viable: store a content hash of each `sourceUrl`, re-fetch weekly, flag drift for human review. This is F15 pulled forward from "Roadmap" to now.
- Without it, `verified: true` decays silently and the disclaimer becomes the only defence.

**4. Cost evidence — anything at all**

- Fee schedules are published and citable: City of San José and Sunnyvale master fee schedules, County DEH fee schedule, CA ABC fee schedule. Those cover `permits_fees` outright.
- Buildout/equipment: no clean public source. Options are (a) label them explicitly as planning assumptions with a stated basis, (b) RSMeans-style commercial data (paid), (c) the marketplace flywheel — real quotes from real jobs.
- Short term, (a) is a credibility fix that costs a day: give every cost rule a `basis` string and stop showing an uncited dollar figure as if it were sourced.

### Tier 2 — makes it a business

**5. CalGOLD** ([calgold.ca.gov](https://calgold.ca.gov)) — completeness check for permit lists per city × business type. Use as an audit against `permits.json`, not as a runtime source; its output is generic, which is precisely the gap you are selling against.

**6. CA ABC license data** — [License Query System](https://maps.gis.ca.gov/abc/lqs/) and [issued-license reports](https://www.abc.ca.gov/licensing/licensing-reports/issued-licenses/). Gives real ABC processing times by type and district, and whether a census tract is over-concentrated (which drives whether a Type 41/47 needs a public convenience finding — a genuine "know before you sign the lease" moment the product currently misses).

**7. Licence registries for marketplace trust** — CSLB (contractors), State Bar of California, CA Board of Accountancy. The README already commits to verifying against these. Needed before the first real vendor listing ships; the 555 numbers are fine for a demo and indefensible in a pilot.

**8. Grant/program status** — SBA local assistance directory, San José OEDCA program pages, grants.gov. `IncentiveRule.status` exists and is currently set by hand. Showing an expired grant is a trust-killer for the exact user who most needs the money.

### Tier 3 — expansion and defensibility

**9. Business registration / tax certificate data** ([San José business tax certificates](https://opendatasanjose.com/business-tax-certificate)) — new-business formation rates by NAICS and tract; feeds F19 ranking and broker pitch.

**10. Zoning layers** — city GIS parcel/zoning services. `Jurisdiction.zoningCode` is in the data model and unfilled. "Check the address allows your business" is step #1 of the roadmap and is currently advice to go ask, not an answer. Answering it automatically is the single biggest upgrade to the core promise.

**11. Commercial rent benchmarks** — `monthlyRentUsd` defaults from sq ft today. Broker partnerships (F18) are the natural source and align with the business model.

**12. Proprietary outcome data** — the marketplace flywheel in the README. Every completed job is a duration and cost observation nobody else has. This is the only datasource here that competitors cannot also buy.

## 5. Recommended sequence

1. Give every cost rule a citation or an explicit "assumption" label. _(credibility, ~1 day)_
2. Wire SCC DEH inspections into competitors. _(ships a promised feature, low effort)_
3. Build the source-monitoring job for `sourceUrl` drift. _(protects the asset)_
4. Ingest San José permit durations; replace estimates where n is large enough, keep estimates where it isn't and say which is which.
5. Zoning layer for San José + Sunnyvale.
6. Audit `permits.json` against CalGOLD, then use that audit as the checklist for city #3.

## 6. Open questions for the team

- Who owns rule freshness once the hackathon ends, and at what cadence?
- Do we show a cost number at all until it has a basis, or show a range labelled as an assumption?
- Is the third city chosen by market size or by open-data availability? (These give different answers, and #4 above is much cheaper in a Socrata/CKAN city.)
- OSM vs. County facility registry for competitor counts — County data is authoritative for food, OSM covers retail. Probably both, with provenance shown per item.

---

Sources for the datasets named above: [SCC DEH inspections](https://data.sccgov.org/Health/SCC_DEH_Food_Data_INSPECTIONS/2u2d-8jej), [SCC DEH feed info](https://data.sccgov.org/Health/SCC_DEH_Food_Data_FEED_INFO/itys-r3sp), [SCC placarding program](https://deh.santaclaracounty.gov/food-and-retail/compliance-retail-food-operations/food-facility-placarding-and-scoring-program), [San José open data portal](https://data.sanjoseca.gov/dataset), [Active Building Permits](https://data.sanjoseca.gov/dataset/active-building-permits), [CA ABC License Query System](https://maps.gis.ca.gov/abc/lqs/), [CA ABC issued licenses](https://www.abc.ca.gov/licensing/licensing-reports/issued-licenses/).
