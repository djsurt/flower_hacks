# Flower multi-agent spike results

Validated on 2026-09-29 against Flower 1.39.0 and SuperGrid.

| Capability | Result | Evidence / decision |
| --- | --- | --- |
| S1 — Python/FAB compatibility | Pass | Python 3.12 tests and `flwr build` complete on the existing app. |
| S2 — Hub Connector | Deferred | The shared SuperGrid run remained queued beyond the hackathon demo time box. The UI labels Connector activity as a replay. |
| S3 — Hub ↔ SuperNode | Pass | `@niujiazhen/comply-cofounder` discovered the registered probe node and completed a hello/reply over Grid. |
| S4 — Connector on SuperNode | Fail closed | Direct `web_search` on the node returned a runtime error. Use the planned Hub Connector Gateway; do not claim node-direct search. |
| S5 — Kimi on SuperNode | Pass | The node called `dedicated/flowerai/Kimi-K2.7-Code-1OUHWL` through Flower Runtime and returned `MODEL_OK`. |
| S6 — role identity | Pass | The reply included the registered node configuration (`role=probe`, `name=comply-probe`). |
| S7–S10 | Deferred | Four-container production deployment, Web cancellation, source-conflict fixtures and live node-loss testing remain follow-up work. |

## Demo scope

The research trace inside Plan Copilot is a transparent demo replay built from official-source links. Regulatory changes automatically route to only the relevant specialists, and the chat demonstrates the event stream, specialist boundaries, confidence, verifier candidates and human approval. It does not claim that displayed Connector searches are live. The banner in the product states exactly which Flower capabilities were verified live.

No API keys, raw street addresses, model responses or Flower credentials are stored in this document or emitted by the probe.
