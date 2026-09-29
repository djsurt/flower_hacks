# Launchpad AI

**Comply Cofounder: know before you sign the lease.**

▶ **[Watch the 2-minute demo (demo.mp4)](demo.mp4)**

A planner for people opening a physical business (café, restaurant or retail boutique) in California. The owner enters a business type and an address; everything else comes from a conversation. The app returns:

- **Who regulates the address**: city, unincorporated county, or out of state (US Census geocoder with OpenStreetMap fallback)
- **A roadmap** of applicable California and federal steps, detailed verified local rules where loaded, and a clearly labeled local estimate everywhere else—grouped into waves you can work on in parallel
- **A realistic opening date** and critical path
- **A startup cost estimate**, including rent paid while waiting on permits
- **The neighborhood**: Census demographics, transit, parking, bike share, nearby businesses and real competitors on an interactive map
- **Grants and free help** the owner may qualify for
- **A chat** that updates the plan live and shows each planning step and what changed
- **Flower evidence checks** across three Docker SuperNodes: real permit, food-facility and alcohol records, with sources and human-reviewed reports saved per plan version

Every California address receives state and federal requirements plus a clearly marked estimate for local city/county work. San José, Sunnyvale and unincorporated Santa Clara County have detailed local rules; other jurisdictions point owners to CalGOLD and the correct local agencies without presenting placeholder fees or timing as verified facts. Each detailed rule links to its official source; values checked against the source are marked with the check date.

## Repository layout

```
web/                       Next.js app (the product)
  src/app/                 pages and API routes (chat, geocode, neighborhood, competitors)
  src/components/          UI by area: layout, plan, location, chat, ui
  src/lib/engine/          pure planning engine: buildPlan, diff, waves, geo
  src/lib/services/        outside data: Census geocoder, OpenStreetMap places, Census Reporter
  src/lib/llm/             Flower web protocol, update_profile schema and deterministic executor
  src/rules/               permits, costs and incentives as JSON rules (all plan facts live here)
  src/data/                directory of free help and sample local vendors
  tests/unit/              engine and chat-agent tests (vitest)
flower-agent/              Flower AgentApp plus local Web-to-Flower bridge (see flower-agent/README.md)
flower-nodes/              Docker SuperNodes with real permit, county health and ABC data (see flower-nodes/README.md)
docs/                      product overview, shared data model, feature specs F01–F20
prototypes/                earlier Streamlit food-truck demo (TruckComply)
```

## Run it

The full chat needs three local processes: Flower SuperLink, the loopback bridge, and Next.js. Follow the exact commands in [`flower-agent/README.md`](flower-agent/README.md#run-locally). Node 22+ and Python 3.11+ are required.

For a quick walkthrough after the services are running, follow [`Try the demo`](flower-agent/README.md#try-the-demo). It covers a Reviewer-confirmed alcohol update, a fast rent update, and an ambiguity that should trigger clarification without changing the plan.

For the connected data nodes, run `uv sync --project flower-agent` from the root,
keep Docker Desktop and the three containers running, and use **Public data
evidence → Check my address** on your plan. The bridge uses your Flower CLI
login. See [node setup and capabilities](flower-nodes/README.md#integrated-web-app).
This integration is for localhost; evidence review does not automatically change
permit requirements, costs or estimated dates.

## Future plan: marketplace

Every step in the roadmap already knows what the owner needs next: plans drawn, a contractor, an alcohol license consultant, a CPA for payroll. The marketplace turns the "Who can help" tab (sample listings today) into real, bookable local pros, matched to the exact step and moment.

**How it works**
1. **Matched to the step.** Opening "Get your kitchen plans approved" shows food-service designers and permit expediters who have done County health plan checks in this city, not a generic directory.
2. **Request quotes in one tap.** The owner's plan (business type, size, address, timeline, what's already done) is shared with their permission, so pros can quote without a discovery call.
3. **Book, track, finish.** Accepted work shows on the roadmap; when the pro marks it done, the step completes and the opening date updates.
4. **Reviews tied to outcomes.** Owners rate pros on what matters here: on-time approvals, resubmittals needed, final cost against the quote.

**Who's in it**
| Step | Pros |
|---|---|
| Zoning, use permits, building permits | Permit expediters, architects, food-service designers |
| Construction and inspections | General contractors, hood and fire-suppression installers, sign companies |
| Entity, tax and payroll | Business attorneys, CPAs, bookkeepers |
| Alcohol | ABC license consultants, license brokers |
| Opening | Insurance brokers, food safety trainers, POS and equipment vendors |

**Trust**
- Licenses checked against public registries: CA Contractors State License Board, State Bar of California, CA Board of Accountancy.
- Free public help (Permit Centers, Small Business Allies, SBDCs, County health) always appears first and is never ranked behind paid listings.
- Sponsored placements are always labeled.

**Business model**
- Referral fee on booked jobs, or a flat fee per qualified quote request
- Subscription for pros who want a verified profile and plan-aware leads
- Broker and property-owner partnerships: sponsored plans for tenants in their vacant storefronts

**Flywheel.** Every completed job adds real local data (how long approvals took, what things cost), which makes the timelines and cost estimates more accurate, which brings more owners, which brings more pros.

**Milestones**
1. **Pilot:** 20–30 hand-picked San José pros across the top five categories; quotes by email.
2. **Launch:** in-app quote requests, license verification, reviews; add Sunnyvale.
3. **Scale:** booking and payments, job status updates the roadmap, expand across Santa Clara County.

## Data sources

- Permits, fees and processes: City of San José, City of Sunnyvale, County of Santa Clara (Environmental Health, Clerk-Recorder), CA Secretary of State, CDTFA, EDD, ABC, IRS. Links are in `web/src/rules/permits.json`.
- Address to jurisdiction: US Census Geocoder, with OpenStreetMap fallback for campuses, shopping centers and other coverage gaps.
- Demographics: US Census Bureau American Community Survey, via Census Reporter.
- Places, transit, parking and competitors: © OpenStreetMap contributors.

This is guidance based on public sources, not legal advice. Confirm with the issuing agency before acting.

## Built with

This project was built with the help of AI coding assistants: **AdaL** and **Claude** (Anthropic), working alongside the team on research, code and design.
