"use client";

import { useEffect, useRef, useState } from "react";
import type { BusinessProfile } from "@/lib/schemas";
import { EvidenceReport, NODE_LABELS, type ReviewedEvidence } from "@/lib/flower";

export default function FlowerEvidence({ profile, saved, onReview }: {
  profile: BusinessProfile; saved?: ReviewedEvidence; onReview: (report: EvidenceReport) => void;
}) {
  const [report, setReport] = useState<EvidenceReport | undefined>(saved?.report);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  async function check() {
    const controller = new AbortController(); abort.current = controller;
    setBusy(true); setError(""); setReviewed(false); setStatus("Starting Flower evidence check…");
    let received = false;
    try {
      const response = await fetch("/api/flower", { method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", "X-Comply-Evidence": "1" }, body: JSON.stringify({ profile }) });
      if (!response.ok) throw new Error((await response.json()).error || "Evidence check failed");
      if (!response.body) throw new Error("Flower returned no stream");
      const reader = response.body.getReader();
      const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        let end: number;
        while ((end = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === "started") setStatus(`Run ${event.runId} · waiting for the three nodes…`);
          if (event.type === "node") setStatus(`${NODE_LABELS[event.node as keyof typeof NODE_LABELS] ?? event.node}: ${event.status === "ok" ? "replied" : "unavailable"}. Waiting for the remaining results…`);
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "report") { setReport(EvidenceReport.parse(event.report)); received = true; }
        }
        if (done) break;
      }
      if (!received) throw new Error("The connection ended before a report arrived.");
      setStatus("");
    } catch (e) {
      controller.abort();
      setError(e instanceof Error && e.name === "AbortError" ? "Check cancelled. Any previous report is still shown below." : e instanceof Error ? e.message : "Evidence check failed");
    } finally {
      setBusy(false);
    }
  }

  const successes = report?.nodes.filter(n => n.status === "ok").length ?? 0;
  const isSaved = saved?.report.runId === report?.runId && !!report;
  return <section className="mb-5 rounded-xl border border-line bg-surface p-5" aria-labelledby="flower-heading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="flower-heading" className="font-display text-lg font-bold">Public data evidence</h2>
        <p className="text-sm text-ink-2">Three specialists connected through Flower</p></div>
      <button className="btn btn-primary" onClick={check} disabled={busy}>{busy ? "Checking…" : report ? "Refresh evidence" : "Check my address"}</button>
    </div>
    <p className="mt-3 text-sm text-ink-2">Check your address against San José permits, county food-facility plan checks, and California alcohol records. Your business profile is sent through Flower to your nodes; they return summaries from local public-data snapshots.</p>
    {busy && <div className="mt-3 flex items-center gap-3 text-sm"><p role="status">{status} This can take a few minutes.</p><button className="btn" onClick={() => abort.current?.abort()}>Cancel</button></div>}
    {error && <p role="alert" className="mt-3 text-sm text-crit">{error}</p>}
    {report && <>
      <div className="mt-4 text-xs text-ink-2">{successes}/3 nodes returned evidence · Checked {new Date(report.checkedAt).toLocaleString()} · Run {report.runId}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {report.nodes.map(node => <article key={node.node} className="rounded-lg border border-line p-3">
          <h3 className="font-semibold">{NODE_LABELS[node.node]}</h3>
          {node.status === "error" ? <p className="mt-2 text-sm text-crit">Unavailable: {node.error}</p> : <>
            <p className="mt-1 text-xs text-ink-2">{node.recordCount.toLocaleString()} real records · Snapshot {new Date(node.retrievedAt).toLocaleDateString()}</p>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-sm">{node.findings.map((text, i) => <li key={i}>{text.length > 350 ? <details><summary className="cursor-pointer">Published guidance for this project</summary><p className="mt-2">{text}</p></details> : text}</li>)}</ul>
            {!!node.recordIds.length && <p className="mt-3 break-words text-xs">Matched IDs (up to 12): {node.recordIds.join(", ")}</p>}
            {!!node.actions.length && <div className="mt-3"><h4 className="text-sm font-semibold">Suggested follow-up</h4><ul className="mt-1 list-disc space-y-1 pl-4 text-sm">{node.actions.map((text, i) => <li key={i}>{text}</li>)}</ul></div>}
            <details className="mt-3 text-xs"><summary className="cursor-pointer">Coverage and limitations</summary><ul className="mt-2 list-disc space-y-1 pl-4">{node.limitations.map((text, i) => <li key={i}>{text}</li>)}</ul></details>
            <div className="mt-3 grid gap-1 text-xs">{node.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="underline">{source.title} ↗</a>)}</div>
          </>}
        </article>)}
      </div>
      <p className="mt-3 text-xs text-ink-2">These findings do not establish permission to open or predict approval times. Review follow-up actions with the issuing agency. Saving records your review; it does not change your plan&apos;s costs or dates.</p>
      {isSaved ? <p className="mt-3 text-sm font-medium">Reviewed and saved with this plan version.</p> : successes > 0 && <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I reviewed the findings and limitations{successes < 3 ? ", including missing node results" : ""}.</label>
        <button className="btn" disabled={!reviewed || busy} onClick={() => onReview(report)}>Save reviewed evidence</button>
      </div>}
    </>}
  </section>;
}
