---
tags: [agentapp]
dataset: []
framework: []
---

# Comply Cofounder AgentApp (Flower)

A human-supervised team of agents that plans every permit a café, restaurant or boutique needs to open in San José / Santa Clara County. Every step carries a source, the Checker flags anything without an official `.gov` source, and nothing moves forward until the owner types **APPROVE**.

The same AgentApp also accepts the `comply.web.v1` envelope used by the Next.js demo. In that mode, Intake interprets the owner's message, Reviewer checks high-impact changes, and the AgentApp emits a profile patch for the deterministic TypeScript engine to apply.

## How it works

```
Owner message
  → Intake agent        profile JSON (asks one question if needed)
  → Jurisdiction agent  web_fetch → US Census geocoder: city, unincorporated county, or out of area
  → City agent          web_search + web_fetch → official city requirements
  → County Health agent web_search + web_fetch → County Environmental Health + Clerk-Recorder
  → State agent         web_search + web_fetch → SOS, CDTFA, EDD, ABC, IRS
  → Planner agent       fixes dependencies; planning.py computes order, critical path, opening date, fees
  → Checker             no official .gov source → "Needs verification"
  → Plan shown, run stops: "Reply APPROVE to confirm, or tell me what to change."
Owner: "Step 4: fee is $5,500, source https://…"  → Reviewer agent applies the fix, re-plans
Owner: "APPROVE"                                  → plan confirmed (read from conversation history)
Owner: "remind me"                                → start_automation schedules up to 3 deadline reminders
```

Safety:
- Each agent gets only the connectors it needs, and every tool call is checked against that list.
- Tool loops are capped at 5 iterations.
- Street addresses never go to web search (only city and county do).
- Logs and status events carry no personal data.
- Reminders are only possible after approval, and nothing is ever filed automatically.

`agent/rules.py` holds fallback permit rules (ported from the Launchpad AI web app) that are used when an agency search comes back empty.

## Files

- `agent/agent_app.py`: the roles, tool loop, approval and reminder flow
- `agent/planning.py`: deterministic merge, schedule, critical path, source check, plan formatting
- `agent/rules.py`: fallback permit rules with official source links
- `bridge/app.py`: loopback-only adapter from NDJSON to Flower's Control API
- `tests/`: offline AgentApp and bridge contract tests

## Build and test

```bash
uv sync
uv run pytest -q
uv run flwr build
```

## Run locally

### One-time setup

Create `flower-agent/.env.local` (it is ignored by Git) and keep the real key only on your machine:

```bash
FLWR_MODEL_API_ENDPOINT=https://api.tokenfactory.tf-ca1.nebius.com/v1/responses
FLWR_MODEL_API_KEY=<Kimi-K2.7-Code API key>
COMPLY_MODEL=dedicated/flowerai/Kimi-K2.7-Code-1OUHWL
```

Add the local connection to `~/.flwr/config.toml`:

```toml
[superlink.local-agent]
address = "127.0.0.1:8000"
insecure = true
```

### Start the three services

Terminal 1 — Flower SuperLink and Kimi runtime:

```bash
cd flower-agent
uv sync
set -a
source .env.local
set +a
uv run flower-superlink --insecure
```

Terminal 2 — loopback Web-to-Flower bridge:

```bash
cd flower-agent
uv run uvicorn bridge.app:app --host 127.0.0.1 --port 8787
```

Terminal 3 — Next.js demo:

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The bridge health check is available at [http://127.0.0.1:8787/health](http://127.0.0.1:8787/health).

If port 8000 is already in use, start SuperLink with `--port 8001 --fleet-api-address 127.0.0.1:9093`, add a separate `superlink.comply-local` entry pointing to port 8001, and launch the bridge with `FLOWER_BRIDGE_CONNECTION=comply-local`.

For Flower Chat instead of the web UI, set `FLWR_CHAT_SUPERLINK=local-agent`, run `uv run flwr chat`, then `/load .`.

`COMPLY_MODEL` overrides the packaged model for local development. Without that environment variable, the published app uses `[tool.flwr.app.config.agent] model = "openai/gpt-5.6-sol"` on SuperGrid.

## Try the demo

1. Choose **Café** and enter `87 N San Pedro St, San Jose, CA`, then click **Build my plan**.
2. Send `We'll serve beer and wine.` The trace should show **Intake agent** and **Reviewer agent**, then add two alcohol-related steps and update the date and cost.
3. Send `The rent is $6,000.` This is a low-impact update, so it should use the fast Intake-only path and recalculate costs.
4. Send `We'll sell some food.` The AgentApp should ask a clarification question and leave the plan unchanged.
5. Continue chatting in the same browser tab to verify that Flower reuses the same run series.

A successful run shows **Powered by a human-supervised Flower AgentApp**, a visible agent trace, a new plan version, and a deterministic change card. Flower interprets the message, but the TypeScript rules engine remains responsible for permits, dates, costs, and jurisdiction.

To stop the demo, press `Ctrl+C` once in each of the three terminals.

## Publish and run on SuperGrid

The app publishes as `@niujiazhen/comply-cofounder` and defaults to `@niujiazhen/personal`:
```bash
unset COMPLY_MODEL
uv run flwr login supergrid
uv run flwr app publish .
uv run flwr run . supergrid --stream
```

## Demo script (60 seconds)

1. `Café at 87 N San Pedro St, San Jose`: watch Intake, Jurisdiction, City, County, State, Planner and Checker run.
2. The Checker flags a step without a .gov source.
3. `Step N: fee is $5,500, source https://www.sanjoseca.gov/...`: the Reviewer fixes it and the plan is re-checked.
4. `APPROVE`
5. `remind me`: a reminder is scheduled.
6. Close: "Every claim has a source, and nothing happens without a human saying yes."
