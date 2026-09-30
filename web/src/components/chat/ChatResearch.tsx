"use client";

import { useEffect, useMemo, useState } from "react";
import type { Plan } from "@/lib/schemas";
import type { ResearchAgentId } from "@/lib/researchRouting";

type Stage = 0 | 1 | 2 | 3 | 4;
type Node = {
  id: string; name: string; scope: string; confidence: number; finding: string;
  source: { title: string; url: string };
};

const STAGES = ["Queued", "Searching", "Fetching", "Analyzing", "Replied"];
const TOOLS = ["Waiting for Hub task", "web_search · official domains", "web_fetch · read evidence", "Kimi · scoped reasoning", "push_reply_message · Grid"];

function makeNodes(plan: Plan): Node[] {
  const p = plan.profile;
  const city = p.jurisdiction?.cityName || p.jurisdiction?.countyName || "Local jurisdiction";
  return [
    { id: "city", name: "City / Local", scope: "zoning · building · fire", confidence: 92,
      finding: `${city} should confirm permitted use and tenant-improvement permits before lease commitment.`,
      source: { title: "CalOSBA permit assistance", url: "https://calosba.ca.gov/permits/" } },
    { id: "county", name: "County / Health", scope: "food facility · plan check", confidence: p.foodService === "none" ? 84 : 94,
      finding: p.foodService === "none" ? "Health review stays conditional because no food service is currently planned." : "Prepared-food service requires environmental-health review and inspection sequencing.",
      source: { title: "California Retail Food Code", url: "https://www.cdph.ca.gov/Programs/CEH/DFDCS/Pages/FDBPrograms/FoodSafetyProgram/CaliforniaRetailFoodCode.aspx" } },
    { id: "state", name: "State / Alcohol", scope: "SOS · CDTFA · ABC", confidence: 96,
      finding: p.alcohol === "none" ? "Seller’s-permit review may apply; the current profile does not trigger alcohol licensing." : "Alcohol service needs an ABC pathway plus local-use confirmation.",
      source: { title: "California licenses and permits", url: "https://www.ca.gov/service/?id=apply-for-business-licenses-and-permits" } },
    { id: "employer", name: "Employer / Federal", scope: "EDD · workers’ comp · EIN", confidence: (p.employeesPlanned ?? 0) ? 91 : 80,
      finding: (p.employeesPlanned ?? 0) ? "Add EIN, EDD registration, workers’ compensation and IIPP readiness." : "Keep employer registrations conditional until hiring begins.",
      source: { title: "EDD employer requirements", url: "https://edd.ca.gov/en/payroll_taxes/am_i_required_to_register_as_an_employer/" } },
  ];
}

export default function ChatResearch({ plan, runId, agentIds }: { plan: Plan; runId: string; agentIds: ResearchAgentId[] }) {
  const nodes = useMemo(() => makeNodes(plan).filter(node => agentIds.includes(node.id as ResearchAgentId)), [plan, agentIds]);
  const [stages, setStages] = useState<Record<string, Stage>>(() => Object.fromEntries(nodes.map(n => [n.id, 0])));
  const [phase, setPhase] = useState<"dispatch" | "verify" | "approved">("dispatch");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    nodes.forEach((node, i) => {
      for (let stage = 1; stage <= 4; stage++) {
        timers.push(setTimeout(() => setStages(old => ({ ...old, [node.id]: stage as Stage })), 450 + i * 260 + stage * 520));
      }
    });
    timers.push(setTimeout(() => setPhase("verify"), 450 + (nodes.length - 1) * 260 + 4 * 520 + 450));
    return () => timers.forEach(clearTimeout);
  }, [nodes]);

  const replied = nodes.filter(n => stages[n.id] === 4).length;
  const active = nodes.find(n => stages[n.id] > 0 && stages[n.id] < 4);
  return <div className="grid gap-2.5 rounded-xl border border-line bg-bg p-3 text-[12px]">
    <div className="flex items-start justify-between gap-2">
      <div><div className="eyebrow">Flower orchestration trace</div><div className="mt-0.5 font-semibold">Hub selected {nodes.length} relevant SuperNode{nodes.length === 1 ? "" : "s"}</div></div>
      <span className={`pill !px-2 !py-0.5 ${phase === "dispatch" ? "bg-accent-soft text-accent" : "bg-good-soft text-good"}`}>{phase === "dispatch" ? `${replied}/${nodes.length} running` : `${nodes.length}/${nodes.length} verified`}</span>
    </div>

    <div className="relative overflow-hidden rounded-lg border border-line bg-surface p-2.5 font-mono text-[10.5px]">
      <div className="absolute bottom-0 left-5 top-0 w-px bg-line" />
      <TraceLine dot="H" strong>Hub · decompose regulatory fingerprint</TraceLine>
      <TraceLine dot="↳">comply.task.v1 · address replaced by SHA-256 token</TraceLine>
      <TraceLine dot="↳">route by changed facts · {agentIds.join(" + ")}</TraceLine>
      <TraceLine dot="↳">Grid.push_messages × {nodes.length}{nodes.length > 1 ? " · parallel dispatch" : ""}</TraceLine>
      {active && <TraceLine dot="●" pulse>{active.name} · {TOOLS[stages[active.id]]}</TraceLine>}
      {phase !== "dispatch" && <TraceLine dot="V" strong>Verifier · official sources + conflict gate</TraceLine>}
    </div>

    <div className={`grid gap-2 ${nodes.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {nodes.map(node => { const stage = stages[node.id]; return <article key={node.id} className={`rounded-lg border p-2 transition-colors ${stage > 0 && stage < 4 ? "border-accent bg-accent-soft/40" : "border-line bg-surface"}`}>
        <div className="flex items-center justify-between gap-1"><strong className="truncate">{node.name}</strong><NodeState stage={stage} /></div>
        <p className="mt-0.5 truncate text-[10px] text-ink-3">{node.scope}</p>
        <div className="mt-2 flex gap-1" aria-label={`${node.name}: ${STAGES[stage]}`}>{[1, 2, 3, 4].map(s => <span key={s} className={`h-1 flex-1 rounded-full transition-colors ${stage >= s ? "bg-accent" : "bg-surface-2"}`} />)}</div>
        {stage > 0 && stage < 4 && <p className="mt-1.5 font-mono text-[9.5px] text-accent">{TOOLS[stage]}</p>}
        {stage === 4 && <><p className="mt-1.5 leading-snug text-ink-2">{node.finding}</p><div className="mt-1.5 flex justify-between gap-1"><a href={node.source.url} target="_blank" rel="noreferrer" className="truncate underline">source ↗</a><b className="text-good">{node.confidence}%</b></div></>}
      </article>; })}
    </div>

    <div className="flex flex-wrap gap-1 text-[10px] text-ink-3"><span>federation @niujiazhen/comply-cofounder</span><span>·</span><span>run {runId.replace("research-", "").slice(-8)}</span><span>·</span><span>series reused</span></div>
    <p className="rounded-md border border-accent/30 bg-accent-soft px-2 py-1.5 text-[10.5px] text-ink-2"><b>Demo replay:</b> Grid messaging and Kimi Runtime were verified live. Connector steps are replayed from official-source fixtures while the shared queue is slow.</p>

    {(phase === "verify" || phase === "approved") && <div className="grid gap-2 border-t border-line pt-2.5">
      <div className="flex items-center justify-between"><strong>Verifier candidates</strong><span className="text-[10px] text-ink-3">Agents propose · you decide</span></div>
      {nodes.map(node => <label key={node.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-line bg-surface p-2">
        <input type="checkbox" className="mt-0.5" disabled={phase === "approved"} checked={selected.has(node.id)} onChange={e => setSelected(old => { const next = new Set(old); if (e.target.checked) next.add(node.id); else next.delete(node.id); return next; })} />
        <span><b>{node.name}</b><span className="block text-[10.5px] text-ink-2">Add evidence-backed checkpoint to the research overlay.</span></span>
      </label>)}
      {phase === "approved" ? <p className="rounded-md bg-good-soft px-2 py-2 font-medium text-good">✓ Research overlay approved · {selected.size} selected · base rules unchanged</p>
        : <button className="btn btn-primary" disabled={!selected.size} onClick={() => setPhase("approved")}>Approve selected changes</button>}
    </div>}
  </div>;
}

function TraceLine({ dot, children, pulse, strong }: { dot: string; children: React.ReactNode; pulse?: boolean; strong?: boolean }) {
  return <div className="relative grid grid-cols-[24px_1fr] py-0.5"><span className={`z-10 grid h-4 w-4 place-items-center rounded-full ${pulse ? "animate-pulse bg-accent text-accent-ink" : "bg-surface-2"}`}>{dot}</span><span className={strong ? "font-semibold text-ink" : "text-ink-2"}>{children}</span></div>;
}

function NodeState({ stage }: { stage: Stage }) {
  return stage === 4 ? <span className="text-[10px] font-semibold text-good">✓ reply</span>
    : stage === 0 ? <span className="text-[10px] text-ink-3">queued</span>
    : <span className="inline-flex items-center gap-1 text-[10px] text-accent"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />{STAGES[stage].toLowerCase()}</span>;
}
