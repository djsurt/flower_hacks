# Comply Cofounder SuperNodes

Three local Docker containers connect to the deployment federation
`@djsurti3003/comply-cofounder`. Their registered IDs are in `deployment.json`.
These are project-operated nodes using public government evidence, not official
government-operated services. All three currently run on the same machine.

Verified on 2026-09-29: all three nodes were online in SuperGrid and the official
collaborative agent queried `/data/catalog.json` on every node. Each replied with
the correct dataset count, source URL, timestamp and limitation. Successful
inventory smoke-test run: `5638251375236786138`. This verifies remote delegation,
local model access, filesystem access and replies; it does not evaluate the
accuracy of substantive permit advice. The initial test exposed an unwritable
dependency cache, fixed by the `UV_CACHE_DIR` and `UV_PYTHON_INSTALL_DIR` settings.

## Data and capabilities

| Node | Initial snapshot, 2026-09-29 | Supported analysis |
| --- | --- | --- |
| sanjose | 10,000 most recently issued records from a 17,184-record active permit layer | Look up related permit activity, locations, project descriptions and available dates. This is a subset, not a full historic archive. |
| county-health | 2,356 public plan-check tracker rows plus two sourced guidance summaries | Look up plan-check milestones, identify missing/revision/approval dates, calculate descriptive elapsed times for complete records, and explain food-facility application steps. |
| abc | 5,077 license/application rows with Santa Clara County premises | Filter by location, license type and status; distinguish applications from issued licenses and multiple types at one premises. |

The data is real, not synthetic. Counts are initial snapshot counts; refreshes
can change them. `catalog.json` in each node's `/data` directory lists its
source, retrieval time, checksum, coverage and limitations. API refreshes are
manual; Docker does not automatically fetch new records.

Sources:
- San Jose: https://geo.sanjoseca.gov/server/rest/services/PLN/PLN_Geocortex_Public_PRD/MapServer/341
- County tracker: https://data.sccgov.org/stories/s/awpi-tuz7
- County tracker JSON: https://data.sccgov.org/resource/skd7-7ix3.json
- County guidance: URLs and review date are recorded in `county-guidance.json`.
- ABC: https://www.abc.ca.gov/licensing/licensing-reports/

An active permit layer is not a representative completion cohort. County
received-to-approved elapsed time can include applicant revisions and is not
agency processing time alone. Do not treat a due date as approval. Existing
licenses do not guarantee eligibility or approval of a new application.
Contractor availability, actual buildout costs and private owner documents
require additional partner/user data (or explicitly labeled demo fixtures).

## Start, stop and inspect

From the repository root:

```bash
docker compose -f flower-nodes/compose.yaml up -d
docker compose -f flower-nodes/compose.yaml ps
docker compose -f flower-nodes/compose.yaml logs --tail 30
uvx --from flwr==1.39.0 flwr supernode list supergrid --verbose
```

Stop the nodes without deleting their keys or data:

```bash
docker compose -f flower-nodes/compose.yaml stop
```

Docker Desktop must remain running and the machine must stay awake for nodes
to remain online. Each service restarts automatically unless explicitly stopped.
There are no published host ports. Each container gets one private key and one
read-only data directory. The model API key is passed through its environment;
avoid printing expanded Compose configuration or container environments.

## Refresh and verify data

```bash
python3 flower-nodes/refresh_data.py
python3 flower-nodes/verify_data.py
```

The refresh script needs Python 3 and curl. It downloads public records without
an API key, validates source schemas where applicable, and preserves existing
dataset files if download/parsing fails. `--only sanjose`, `--only county-health`
or `--only abc` selects one source. `--limit 20000` raises the API record cap.
ABC always filters the full export to Santa Clara County. County guidance
summaries require manual review; their date is not changed by a data refresh.

## Query the federation

Use Flower Chat with the official `@flwrlabs/collaborative-agent`, which supplies
Grid messaging and filesystem tools:

```bash
uvx --from flwr==1.39.0 flwr chat
```

At its prompt:

```text
/federation @djsurti3003/comply-cofounder
@flwrlabs/collaborative-agent Contact all three SuperNodes. Ask each to read /data/catalog.json and report its dataset name, row count, source date and limitations. Return summaries only, with each node identified.
```

If the app is not listed in the federation, download the official template:

```bash
uvx --from flwr==1.39.0 flwr new @flwrlabs/collaborative-agent
```

Then use `/load <path-to-downloaded-app>` inside Flower Chat. The official
hackathon starter is https://github.com/jafermarq/flower-collaborative-agent-hackathon.

Sample follow-up:

> I am considering a cafe in San Jose with prepared food and beer/wine. Ask the
> city node about related permit activity, the county node about the plan-review
> workflow and available milestones, and the ABC node about local license types
> and statuses. Cite sources, identify unknowns and propose questions for a human
> reviewer. Do not infer an opening date from incomplete records.

## Integrated web app

The plan now includes **Public data evidence → Check my address**. This starts
the local Comply AgentApp on your federation, sends one task to each registered
node through Flower Grid, and streams the results back to the page.

```bash
uv sync --project flower-agent
cd web
npm install
npm run dev -- --hostname 127.0.0.1
```

Open http://127.0.0.1:3000, build a plan, and click **Check my address**.
Keep Docker Desktop running. If authentication expires, run
`uvx --from flwr==1.39.0 flwr login supergrid` and retry.

The three specialists execute Python beside their own read-only snapshots.
They verify checksums, match conservative street addresses (retaining units),
and return bounded summaries, record IDs, provenance and limitations. The
coordinator verifies the replying node IDs. No model invents counts or decides
whether a worker responded. Node failures remain explicit partial results.
Web chat uses the local HTTP bridge and SuperLink described in
[the AgentApp setup](../flower-agent/README.md#run-locally); start those services
as well to use chat alongside evidence checks. The original conversational
planner also remains available in Flower Chat.

Current web capabilities:
- San José: matched permit IDs and recorded work types.
- County: matched plan-check IDs and recorded approval-date presence; sourced
  food-facility guidance selected for a new review or ownership change.
- ABC: matched license/file IDs, license types and application/status codes.
- Agency follow-up suggestions, official source links and snapshot dates.
- Human review checkbox and **Save reviewed evidence**, persisted in localStorage
  with this plan version. New profile versions need their own evidence check;
  switching versions or resetting the plan cancels an in-flight check.

Saving review does **not** change costs, permit requirements or opening dates.
These snapshots cannot justify automatic timing adjustments. No-match results
do not prove absence of records. Sunnyvale addresses receive county/state
coverage; the San José node marks its city data out of scope. Datasets are
snapshots refreshed manually, not live government database connections.

Architecture: browser → local Next.js `/api/flower` → `flower-agent/bridge.py`
→ authenticated SuperGrid run → three Docker SuperNodes → summarized evidence.
The bridge uses your existing Flower CLI login, not a browser API key. It pins
Flower 1.39.0 because its CLI transport helpers are version-specific. Node IDs
and run IDs remain strings to preserve uint64 precision in JavaScript.

This adapter is for a **single-user localhost demo**. Requests require a local
Host, matching Origin and custom header; the dev server binds to loopback.
One evidence run is allowed per server process. Cancellation/disconnect attempts
to stop the remote run, and runs have a bounded timeout. Public deployment needs
application authentication, per-user authorization, a server credential strategy
and durable job/concurrency management before exposing this endpoint.

Verified browser run on 2026-09-29: `8414225277552098248` returned all three
node reports and found San José permit `2026-139846-CI` at the public test address
950 W Julian St. Reviewed evidence survived a page reload. A disconnected check
(`86067665373654266`) was confirmed `finished:stopped` in Flower. This verifies
connectivity and matching, not property suitability. See
`flower-agent/tests/test_evidence.py` and `web/tests/unit/flower.test.ts` for
matching, provenance and failure tests. TypeScript, ESLint, Python tests and web
tests passed. Production build passed with `npm run build -- --webpack`;
Turbopack hit a worker-port permission error in this environment.

## Reconfigure on this machine

```bash
python3 flower-nodes/configure.py
docker compose -f flower-nodes/compose.yaml up -d
```

`configure.py` prompts for the model API key without echoing it, saves `.env`
with owner-only permissions, and preserves existing node identities. Keys,
credentials and downloaded datasets are ignored by Git. Never regenerate an
existing node key casually; its public key is already registered with Flower.

For a new machine, create a new node identity there and register its public key
in SuperGrid. Add it to this Deployment federation. Use the same Compose pattern
with that machine's data directory and UID/GID; run each identity on one machine.
