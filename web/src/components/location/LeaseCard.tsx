"use client";
import { MILE } from "@/lib/engine/geo";
import { USE_LABEL, type LeaseRec } from "@/lib/engine/leaseFit";
import { kmoney, money } from "@/lib/dates";

const SAT_STYLE = { low: "bg-good-soft text-good", medium: "bg-accent-soft text-accent", high: "bg-crit-soft text-crit" } as const;
const miles = (m: number) => `${(m / MILE).toFixed(1)} mi`;
const formerUse = (l: LeaseRec) => `Former ${USE_LABEL[l.previousUse]}`;

type CardProps = { lease: LeaseRec; plural: string; onSelect: (id: string) => void };

/** "See details" links out to the lease owner's listing in a new tab. */
function SeeDetails({ lease: l }: { lease: LeaseRec }) {
  return (
    <a href={l.listingUrl} target="_blank" rel="noopener noreferrer" aria-label={`See details for ${l.address} (opens the listing in a new tab)`} className="btn btn-primary inline-flex items-center gap-1.5 text-[13px] no-underline">
      See details<span aria-hidden>↗</span>
    </a>
  );
}

/** A lease that is not selected: tap the address to compare it, or use See details to open the listing. */
export function LeaseRow({ lease: l, plural, onSelect }: CardProps) {
  return (
    <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] border border-line bg-surface px-3.5 py-3">
      <button type="button" onClick={() => onSelect(l.id)} aria-label={`Compare lease ${l.rank}: ${l.address}`} className="grid min-w-0 grid-cols-[30px_minmax(0,1fr)] items-center gap-3 text-left">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-2 font-display font-bold num">{l.rank}</span>
        <span className="grid min-w-0 gap-px">
          <span className="font-semibold">{l.address}</span>
          <span className="text-[12.5px] text-ink-2">{l.area}, {l.cityName} · {miles(l.distanceMeters)} away · {formerUse(l)}</span>
          <span className="text-[12.5px] text-ink-2 num">{l.squareFeet.toLocaleString("en-US")} sq ft · ${l.rentPerSqFt.toFixed(2)}/sq ft/mo</span>
        </span>
      </button>
      <span className="grid justify-items-end gap-1">
        <span className="flex items-baseline gap-1.5"><span className="font-display text-2xl font-bold leading-none num">{l.competitors}</span><span className="text-[11px] text-ink-3">{plural} nearby</span></span>
        <span className={`pill ${SAT_STYLE[l.saturation]}`}>Saturation: {l.saturation}</span>
        <SeeDetails lease={l} />
      </span>
    </div>
  );
}

type SelectedProps = { lease: LeaseRec; plural: string; addressCompetitors: number; waitMonths: number; budgetUsd?: number };

/** The selected lease: how it compares with the owner's address and why it fits the plan. */
export function LeaseDetail({ lease: l, plural, addressCompetitors, waitMonths, budgetUsd }: SelectedProps) {
  const bar = Math.round((l.competitors / Math.max(addressCompetitors, 1)) * 100);
  return (
    <article aria-label={`Selected lease: ${l.address}`} className="grid gap-3.5 rounded-xl border-[1.5px] border-accent bg-surface p-4 shadow-[0_8px_24px_rgba(13,92,75,.12)]">
      <div className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-start gap-3">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-accent font-display font-bold text-accent-ink num">{l.rank}</span>
        <span className="grid min-w-0 gap-px">
          <span className="font-display text-[17px] font-bold">{l.address}</span>
          <span className="text-[12.5px] text-ink-2">{l.area}, {l.cityName} · {miles(l.distanceMeters)} from your address · {formerUse(l)}</span>
        </span>
        <span className="grid justify-items-end gap-1.5">
          <span className={`pill ${SAT_STYLE[l.saturation]}`}>Saturation: {l.saturation}</span>
          <SeeDetails lease={l} />
        </span>
      </div>

      <div className="grid gap-1.5">
        <span className="eyebrow">{plural} within a 10-min walk</span>
        <div className="grid grid-cols-[96px_minmax(0,1fr)_28px] items-center gap-2 text-[12.5px]">
          <span className="font-semibold">This space</span>
          <span className="block h-2 rounded bg-surface-2"><span className="block h-2 rounded bg-accent" style={{ width: `${bar}%` }} /></span>
          <span className="text-right font-semibold num">{l.competitors}</span>
          <span className="text-ink-2">Your address</span>
          <span className="block h-2 rounded bg-surface-2"><span className="block h-2 rounded bg-ink-3" style={{ width: "100%" }} /></span>
          <span className="text-right text-ink-2 num">{addressCompetitors}</span>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Tile label="Asking rent" value={`${money(l.monthlyRent)}/mo`} sub={`$${l.rentPerSqFt.toFixed(2)}/sq ft/mo · ${l.squareFeet.toLocaleString("en-US")} sq ft`} />
        <Tile label="Rent while waiting" value={kmoney(l.waitCost)} sub={`about ${waitMonths.toFixed(1)} months of permits`} />
        {l.budgetShare !== null && budgetUsd
          ? <Tile label="Of your budget" value={`${Math.round(l.budgetShare * 100)}%`} sub={`of ${kmoney(budgetUsd)} for rent while waiting`} />
          : <Tile label="From your address" value={miles(l.distanceMeters)} sub="straight-line distance" />}
      </div>

      <div className="grid gap-1.5">
        <span className="eyebrow">Why this fits your plan</span>
        <p>{l.why}</p>
        <div className="flex flex-wrap gap-1.5">
          {l.fits.map(f => (
            <span key={f.text} className={`pill ${f.ok ? "bg-good-soft text-good" : "bg-warn-soft text-warn"}`}><span aria-hidden className="font-bold">{f.ok ? "✓" : "!"}</span>{f.text}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="grid content-start gap-px rounded-lg bg-surface-2 px-3 py-2.5">
      <span className="eyebrow">{label}</span>
      <span className="font-display text-[19px] font-bold num">{value}</span>
      <span className="text-[11.5px] text-ink-2">{sub}</span>
    </div>
  );
}
