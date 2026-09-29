# Comply Cofounder — 3-Minute Demo Guide

This guide is written for any teammate presenting the hackathon demo. Follow the clicks, paste the exact sample answers, and use the suggested narration.

## Before you present

1. Start the website:

   ```bash
   cd web
   PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run dev
   ```

2. Open <http://localhost:3000>.
3. Click **New plan** so no previous conversation is visible.
4. Keep this guide open on a second screen.

If anything unexpected happens, click **New plan** and restart. Do not wait for a slow live SuperGrid run during the three-minute presentation; the visible research trace is intentionally a deterministic demo replay.

## The three-minute walkthrough

### 0:00–0:25 — Create the business plan

Enter this address:

```text
389 Jane Stanford Way, Stanford, CA 94305
```

Choose **Restaurant** and wait for the loading stages to finish.

Say:

> Comply Cofounder turns a business idea and location into an actionable opening plan. It first resolves the jurisdiction, then builds a deterministic baseline from public rules.

### 0:25–0:45 — Show the deterministic baseline

Point to the Overview cards: opening date, startup cost, permit count, and the five-stage journey.

Say:

> These dates, costs, and dependencies come from our deterministic rules engine. The language model does not invent compliance numbers. The same confirmed profile always produces the same plan.

### 0:45–1:20 — Confirm food and space; watch automatic routing

The Plan Copilot asks about food. Paste:

```text
We will prepare food on site in a former restaurant.
```

As the plan updates, point to the Flower trace appearing automatically in the chat.

Say:

> The owner never has to choose an agent. The Copilot recognizes that food and the prior use affect compliance, then routes narrow tasks to the County Health and local specialists. The trace shows the task envelope, Grid dispatch, search, fetch, Kimi analysis, and each reply.

Point out that the street address is replaced by a SHA-256 token before specialist dispatch.

### 1:20–1:55 — Add alcohol; show selective multi-agent execution

Paste:

```text
We will serve beer and wine.
```

Point to **State / Alcohol** and **City / Local** starting automatically.

Say:

> Alcohol crosses regulatory levels, so the Hub selects two specialists: the State agent checks the ABC pathway, while the local agent checks land-use implications. Unrelated agents are not called.

While they run, point out their independent Searching, Fetching, Analyzing, and Reply stages.

### 1:55–2:25 — Add employees; complete the four-agent story

Paste:

```text
The space is 2,000 square feet and we will hire 12 employees.
```

Point to **Employer / Federal** starting automatically. The City agent may also run because size can affect local review.

Say:

> Hiring activates the Employer specialist for EIN, EDD, workers’ compensation, and workplace-safety requirements. Across three answers, all four specialists have participated, but only when their domain became relevant.

### 2:25–2:50 — Show verification and human approval

When the trace shows all selected agents verified, point to each official-source link and confidence score. Select two candidates and click **Approve selected changes**.

Say:

> Agents can propose evidence-backed changes, but they cannot silently rewrite the plan. The Verifier checks sources and conflicts, and the owner decides which candidates enter the research overlay. The deterministic base rules remain unchanged.

### 2:50–3:00 — Close

Return attention to the Overview or Roadmap.

Say:

> Comply Cofounder combines a trustworthy deterministic plan with Flower-powered collaborative research: automatic agent routing, transparent execution, official evidence, and human control.

## What the white-box trace means

| UI label | What to say |
| --- | --- |
| Hub · decompose regulatory fingerprint | The Hub decides which regulatory domains changed. |
| `comply.task.v1` | A bounded, structured task is created for each selected specialist. |
| Address replaced by SHA-256 token | Raw street addresses are not sent in Grid task payloads. |
| `Grid.push_messages` | Flower Grid dispatches tasks to independently identified SuperNodes. |
| `web_search` / `web_fetch` | The architecture obtains official evidence through Flower Connectors. |
| Kimi · scoped reasoning | The specialist interprets only its assigned domain. |
| `push_reply_message` | Each node returns one structured reply, independently of the others. |
| Verifier | Unsupported or conflicting candidates are blocked before approval. |

## Required honesty statement

If a judge asks whether every animation is live, say:

> Flower Grid messaging, node discovery, role identity, and Kimi calls through Flower Runtime were verified live. Because the shared SuperGrid queue is slow today, the Connector portion of this three-minute demo uses a replay of official-source fixtures. The product labels this clearly; we do not present replayed searches as live results.

## Quick recovery

- **An agent does not appear:** Continue to the next exact sample answer; routing occurs only after a regulatory fact is confirmed or changed.
- **The chat is unavailable:** Explain the baseline plan, then show the white-box architecture using the last completed trace if it is still visible.
- **A previous demo is visible:** Click **New plan** and restart with the Stanford address.
- **You are short on time:** Skip the employee answer. Food plus alcohol still demonstrates County, State, and City specialists, automatic routing, and human approval.
