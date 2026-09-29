"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Plan } from "@/lib/schemas";
import { Section } from "@/components/plan/PlanView";
import { PLURAL } from "@/components/location/Competitors";
import { LeaseDetail, LeaseRow } from "@/components/location/LeaseCard";
import { fmtShort, kmoney } from "@/lib/dates";
import type { LeaseResponse } from "@/lib/engine/leaseFit";

const LeaseMap = dynamic(() => import("@/components/location/LeaseMap"), { ssr: false, loading: () => <div className="h-[420px] w-full rounded-xl bg-surface-2 md:h-[640px]" /> });
const DAYS_PER_MONTH = 30.4;

const BUSINESS = { cafe: "Café", restaurant: "Restaurant", retail_boutique: "Retail boutique" } as const;
const FOOD = { none: "No food service", prepackaged_only: "Prepackaged food only", prepared_food: "Prepared food" } as const;
const ALCOHOL = { none: "no alcohol", beer_wine: "beer & wine", full_bar: "full bar" } as const;
const SPACE = { second_generation: "Second-generation space", new_buildout: "New build-out", change_of_ownership: "Change of ownership" } as const;

type Result = { query: string; data?: LeaseResponse; failed?: boolean };

/** Lease ideas near the owner's address with fewer competitors, matched to the plan (samples until a licensed feed is connected). */
export default function LeaseRecommendations({ plan }: { plan: Plan }) {
  const p = plan.profile;
  const { lat, lng } = p.address;
  const outOfArea = p.jurisdiction?.kind === "out_of_area";
  const query = lat == null || lng == null || outOfArea ? null : new URLSearchParams({
    lat: String(lat), lng: String(lng), type: p.businessType, acquisition: p.acquisition, foodService: p.foodService, days: String(plan.days.typical),
    ...(p.jurisdiction?.cityId ? { cityId: p.jurisdiction.cityId } : {}),
    ...(p.budgetUsd ? { budgetUsd: String(p.budgetUsd) } : {}),
  }).toString();
  const [result, setResult] = useState<Result | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!query) return;
    let live = true;
    fetch(`/api/leases?${query}`)
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j as LeaseResponse; })
      .then(data => live && setResult({ query, data }))
      .catch(() => live && setResult({ query, failed: true }));
    return () => { live = false; };
  }, [query]);

  if (lat == null || lng == null) return null;
  const plural = PLURAL[p.businessType];
  const right = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="chip" aria-pressed="true">Within 3 miles</span>
    </div>
  );

  if (outOfArea) return <Section title="Better-located leases"><Notice title="Lease ideas cover Santa Clara County" body="This address is outside the county, so we can't suggest spaces or match them to your permit plan. Change the address to see options near it." /></Section>;

  const current = result?.query === query ? result : null;
  const data = current?.data;
  if (!current) return <Section title="Better-located leases" right={right}><p className="text-ink-3">Finding spaces within 3 miles of your address…</p><div className="grid gap-2.5" aria-hidden><div className="h-24 rounded-[10px] bg-surface-2" /><div className="h-16 rounded-[10px] bg-surface-2" /><div className="h-16 rounded-[10px] bg-surface-2" /></div></Section>;
  if (current.failed || !data) return <Section title="Better-located leases" right={right}><p className="text-ink-3">Couldn&apos;t load lease ideas right now. Try again in a moment.</p></Section>;
  if (!data.nearbyCount) return <Section title="Better-located leases" right={right}><Notice title="No leases within 3 miles" body="We don't have listings for this part of the county yet." /></Section>;
  if (!data.leases.length) return <Section title="Better-located leases" right={right}><Notice title="No lower-competition spaces within 3 miles" body={`Every available space nearby has as many or more ${plural} around it than your address (${data.addressCompetitors}). Your address may already be the best option in this area.`} /></Section>;

  const selected = data.leases.find(l => l.id === selectedId) ?? data.leases[0];
  return (
    <Section title="Better-located leases" right={right}>
      <div className="flex flex-wrap items-center gap-3 rounded-[10px] bg-surface-2 px-3.5 py-3">
        <div className="grid min-w-0 gap-0.5">
          <span className="eyebrow">Matched to your plan</span>
          <span className="text-[13px] text-ink-2">Fewer {plural} than your address ({data.addressCompetitors}), matched to your budget and permit plan.</span>
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {[BUSINESS[p.businessType], p.jurisdiction?.cityName, `${FOOD[p.foodService]} · ${ALCOHOL[p.alcohol]}`, SPACE[p.acquisition], p.budgetUsd ? `Budget ${kmoney(p.budgetUsd)}` : null, p.targetOpenDate ? `Open by ${fmtShort(p.targetOpenDate)}` : null]
            .filter((c): c is string => Boolean(c)).map(c => <span key={c} className="chip">{c}</span>)}
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[540px_minmax(0,1fr)]">
        <LeaseMap lat={lat} lng={lng} leases={data.leases} competitors={data.competitors} selectedId={selected.id} onSelect={setSelectedId} />
        <div className="grid min-w-0 gap-2.5">
          <div className="grid gap-0.5">
            <h3 className="text-[15px] font-bold">{data.leases.length} {data.leases.length === 1 ? "space" : "spaces"} with a better landscape</h3>
            <p className="text-xs text-ink-3">Ranked by fewer direct {plural}, then rent, then fit with your permit plan. Tap a space to compare it with your address; See details opens the listing.</p>
          </div>
          {data.leases.map(l => l.id === selected.id
            ? <LeaseDetail key={l.id} lease={l} plural={plural} addressCompetitors={data.addressCompetitors} waitMonths={plan.days.typical / DAYS_PER_MONTH} budgetUsd={p.budgetUsd} />
            : <LeaseRow key={l.id} lease={l} plural={plural} onSelect={setSelectedId} />)}
        </div>
      </div>
      <p className="border-t border-line pt-2.5 text-xs text-ink-3">Competitor counts use the same source as &quot;Who you&apos;d compete with&quot; ({data.source}). Fit is based on your plan: business type, city, budget and space type.</p>
    </Section>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid gap-1.5 rounded-[10px] bg-surface-2 p-4">
      <span className="font-display text-[17px] font-bold">{title}</span>
      <p className="text-ink-2">{body}</p>
    </div>
  );
}
