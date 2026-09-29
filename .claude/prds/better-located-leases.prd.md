# Better-Located Leases (Location section)

## Problem
Owners opening a café, restaurant or boutique in Santa Clara County see who they'd compete with at their chosen address, but not where else nearby they could lease a space with a better competitive landscape. Without that, a crowded address is either accepted or replaced by a manual search on listing sites that know nothing about the owner's business type, budget or permit plan. The cost is a weaker site choice made before the owner signs a lease.

## Evidence
- Assumption — needs validation via user research (interviews with prospective café/restaurant/boutique owners) or a prototype test.

## Users
- **Primary**: TBD — needs validation via user research. Working assumption: a prospective café, restaurant or boutique owner in Santa Clara County who is choosing or comparing sites.
- **Not for**: owners outside Santa Clara County; business types other than café, restaurant and retail boutique.

## Hypothesis
We believe **a "better-located leases" section, showing available leases within 3 miles of the owner's address ranked by competition and aligned to the Flower agent's profile**, will **help owners find a lower-competition site for their business type** for **café, restaurant and boutique owners planning a Santa Clara County opening**.
We'll know we're right when **{measurable outcome — TBD, candidates: share of users who open a recommended lease's detail; share who switch their address to a recommendation}**.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| Recommendation engagement (opens a lease detail) | TBD | Product analytics |
| Address switch to a recommended lease | TBD | Product analytics |
| Recommendations consistent with the agent's profile (business type, budget, city) | 100% of shown leases | Automated tests against the agent's profile output |

## Scope
**MVP** — A section placed directly below "Who you'd compete with" in the Location section. It shows the top 3–5 available leases within 3 miles of the owner's address. Each lease shows the address, size, asking rent, previous use, a competitor count compared with the owner's address, and a short "why this fits" line based on the Flower agent's profile (business type, budget, target open date, city). Listings come from **10 sample leases**, labelled "Sample listing" in the UI, behind a swappable data source so a licensed feed can replace them later.

**Out of scope**
- Scraping LoopNet or any commercial listing site — terms of service prohibit it and the sites block bots.
- A licensed lease feed (Crexi partner API, CoStar) — deferred until the concept is validated.
- Contacting landlords or brokers — outside the planning product.
- Saving or comparing leases — not needed to test the hypothesis.
- Re-running the permit plan for a recommended address — depends on the open question below.

## Delivery Milestones
<!-- Business outcomes, not engineering tasks. /plan turns each into a plan. -->
<!-- Status: pending | in-progress | complete -->

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Sample lease recommendations | Owners see up to 5 labelled sample leases within 3 miles, ranked by competition, under "Who you'd compete with" | in-progress | `.claude/plans/better-located-leases.plan.md` |
| 2 | Agent-aligned "why this fits" | Each recommendation explains its fit using the Flower agent's profile and plan | pending | — |
| 3 | Real lease data source | Sample listings replaced by a licensed feed | pending | — |

## Open Questions
- [ ] Which licensed lease source (Crexi partner API, CoStar license, other) replaces the samples, and at what cost?
- [ ] Can the feature use the street address, given the Flower agent currently keeps street addresses out of web searches?
- [ ] How is a "better competition landscape" defined: fewest competitors, lowest density, or highest demand-to-competitor ratio?
- [ ] Do recommendations outside the owner's city need a different permit plan? San José and Sunnyvale are covered in detail.
- [ ] Who is the primary user, what pain do they observe, and why now? (Skipped in framing.)
- [ ] What measurable outcome and targets define success?

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Scraping LoopNet or similar sites breaches terms of service and gets blocked | High | High | Do not scrape; use labelled sample data, then a licensed feed |
| Sample data mistaken for real listings | Medium | High | Label every listing "Sample listing" in the UI |
| Competitor counts are wrong or stale, so recommendations mislead | Medium | Medium | Use the same competitor source as the existing section; show the count basis |
| Recommendations disagree with the agent's plan (city, budget, business type) | Medium | Medium | Derive fit only from the agent's profile; test for consistency |
| Address use conflicts with the agent's no-street-address rule | Medium | Medium | Resolve the open question before implementation |
| Recommended site is outside covered cities, so no detailed permit plan | Medium | Medium | Flag out-of-coverage leases or limit to covered cities |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*
