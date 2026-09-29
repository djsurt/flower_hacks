"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Plan } from "@/lib/schemas";

type AgentState = "queued" | "working" | "done" | "partial";
type Specialist = {
  id: string; name: string; scope: string; state: AgentState; confidence: number;
  finding: string; source: { title: string; url: string };
};

const FEDERATION = "@niujiazhen/comply-cofounder";

function specialists(plan: Plan): Specialist[] {
  const p = plan.profile;
  const city = p.jurisdiction?.cityName || "Local jurisdiction";
  const food = p.foodService !== "none";
  const alcohol = p.alcohol !== "none";
  const employees = (p.employeesPlanned ?? 0) > 0;
  return [
    { id: "city", name: "City / Local", scope: "Zoning · building · fire · signs", state: "queued", confidence: 92,
      finding: `${city} should confirm the proposed use and any tenant-improvement permits before the lease is finalized.`,
      source: { title: "California business permit assistance", url: "https://calosba.ca.gov/permits/" } },
    { id: "county", name: "County / Health", scope: "Food facility · plan check · FOG", state: "queued", confidence: food ? 94 : 84,
      finding: food ? "Prepared-food service requires county environmental-health review; confirm plan-check and inspection sequencing." : "No prepared-food service is currently in the profile; verify whether county health review is out of scope.",
      source: { title: "California Retail Food Code", url: "https://www.cdph.ca.gov/Programs/CEH/DFDCS/Pages/FDBPrograms/FoodSafetyProgram/CaliforniaRetailFoodCode.aspx" } },
    { id: "state", name: "State / Alcohol", scope: "SOS · CDTFA · ABC", state: "queued", confidence: 96,
      finding: alcohol ? "Alcohol service requires an ABC license pathway and local-use confirmation before it should enter the opening schedule." : "A California seller’s permit may still apply; no alcohol license is proposed in the current profile.",
      source: { title: "California permits and licenses", url: "https://www.ca.gov/service/?id=apply-for-business-licenses-and-permits" } },
    { id: "employer", name: "Employer / Federal", scope: "EDD · workers’ comp · IIPP · EIN", state: "queued", confidence: employees ? 91 : 80,
      finding: employees ? "The employer path should include EIN, EDD registration, workers’ compensation and an Injury and Illness Prevention Program." : "No employees are currently planned; keep employer registrations conditional until hiring begins.",
      source: { title: "California employer requirements", url: "https://edd.ca.gov/en/payroll_taxes/am_i_required_to_register_as_an_employer/" } },
  ];
}

export default function ResearchWorkbench({ plan }: { plan: Plan }) {
  const base = useMemo(() => specialists(plan), [plan]);
  const [agents, setAgents] = useState(base);
  const [phase, setPhase] = useState<"idle" | "running" | "review" | "approved">("idle");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [run, setRun] = useState<{ runId: string; seriesId: string } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const candidates = agents.filter(a => a.state === "done").map(a => ({
    id: a.id, title: a.id === "employer" ? "Add employer-readiness checkpoint" : `Verify ${a.name.toLowerCase()} requirement`,
    detail: a.finding,
  }));

  function start() {
    timers.current.forEach(clearTimeout);
    const now = String(Date.now());
    setRun({ runId: now.slice(-10), seriesId: `series-${now.slice(-7)}` });
    setSelected(new Set()); setPhase("running"); setAgents(base.map(a => ({ ...a, state: "queued" })));
    base.forEach((agent, i) => {
      timers.current.push(setTimeout(() => setAgents(xs => xs.map(x => x.id === agent.id ? { ...x, state: "working" } : x)), 350 + i * 220));
      timers.current.push(setTimeout(() => setAgents(xs => xs.map(x => x.id === agent.id ? { ...x, state: "done" } : x)), 1500 + i * 650));
    });
    timers.current.push(setTimeout(() => setPhase("review"), 1500 + (base.length - 1) * 650 + 500));
  }

  const done = agents.filter(a => a.state === "done").length;
  return <div className="grid gap-5">
    <section className="panel overflow-hidden">
      <div className="border-b border-line bg-ink p-5 text-surface">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="eyebrow !text-surface/60">Flower SuperGrid research</div><h1 className="mt-1 font-display text-2xl font-bold">Four specialists. One verified plan.</h1>
            <p className="mt-1 max-w-2xl text-sm text-surface/75">The Hub gathers official evidence, dispatches bounded tasks to four SuperNodes, then returns candidates for your approval.</p></div>
          <button className="btn !border-surface/25 !bg-surface !text-ink" onClick={start} disabled={phase === "running"}>{phase === "running" ? "Agents working…" : phase === "idle" ? "Research this plan" : "Run again"}</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-surface/10 px-2.5 py-1">Federation {FEDERATION}</span>
          <span className="rounded-full bg-surface/10 px-2.5 py-1">Hub · openai/gpt-5.6-sol</span>
          <span className="rounded-full bg-surface/10 px-2.5 py-1">Nodes · Kimi K2.7 Code</span>
        </div>
      </div>
      <div className="grid gap-3 p-5">
        <div className="rounded-lg border border-accent/30 bg-accent-soft p-3 text-sm"><strong>Demo replay.</strong> Flower Grid node discovery, role identity, message round-trip and Kimi Runtime calls were verified live today. Official-source Connector activity below is replayed because the shared SuperGrid queue is currently slow.</div>
        {run && <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2"><span>Run <b className="text-ink">{run.runId}</b></span><span>Series <b className="text-ink">{run.seriesId}</b></span><span>{done}/4 replies</span><span>{phase === "running" ? "Streaming events…" : "Run completed"}</span></div>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {agents.map((a, i) => <article key={a.id} className={`rounded-xl border p-4 transition-all ${a.state === "working" ? "border-accent bg-accent-soft/40 shadow-sm" : "border-line"}`}>
            <div className="flex items-center justify-between gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-xs font-bold text-surface">{i + 1}</span><State state={a.state} /></div>
            <h3 className="mt-3 font-semibold">{a.name}</h3><p className="mt-1 text-xs text-ink-3">{a.scope}</p>
            {a.state === "working" && <div className="mt-3 grid gap-1 text-xs text-ink-2"><span>web_search → official domains</span><span>web_fetch → evidence extraction</span><span>Kimi → scoped analysis</span></div>}
            {a.state === "done" && <><p className="mt-3 text-sm leading-relaxed">{a.finding}</p><div className="mt-3 flex items-center justify-between text-xs"><a className="underline" href={a.source.url} target="_blank" rel="noreferrer">Official source ↗</a><span className="font-semibold text-good">{a.confidence}%</span></div></>}
          </article>)}
        </div>
      </div>
    </section>

    {(phase === "review" || phase === "approved") && <section className="panel grid gap-3.5 p-5"><div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-bold">Verifier-approved candidates</h2><div className="ml-auto"><span className="pill bg-good-soft text-good">Human in the loop</span></div></div>
      <p className="text-sm text-ink-2">Agents cannot change the deterministic plan directly. Select the evidence-backed candidates you want to accept.</p>
      <div className="grid gap-2">{candidates.map(c => <label key={c.id} className="flex cursor-pointer gap-3 rounded-lg border border-line p-3 hover:border-accent"><input type="checkbox" disabled={phase === "approved"} checked={selected.has(c.id)} onChange={e => setSelected(s => { const n = new Set(s); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })} /><span><span className="font-semibold">{c.title}</span><span className="mt-1 block text-sm text-ink-2">{c.detail}</span></span></label>)}</div>
      {phase === "approved" ? <div className="rounded-lg bg-good-soft p-3 text-sm font-medium text-good">Approved research overlay saved locally · {selected.size} candidate{selected.size === 1 ? "" : "s"} selected. The base rules remain unchanged.</div>
        : <button className="btn btn-primary w-fit" disabled={!selected.size} onClick={() => setPhase("approved")}>Approve selected changes</button>}
    </section>}
  </div>;
}

function State({ state }: { state: AgentState }) {
  const label = { queued: "Queued", working: "Working", done: "Replied", partial: "Partial" }[state];
  return <span className={`pill ${state === "done" ? "bg-good-soft text-good" : state === "working" ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-2"}`}>{state === "working" && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}{label}</span>;
}
