# Flower collaboration spikes

`probe_app` is a disposable AgentApp used to verify Flower 1.39 capabilities
before the production multi-agent path is selected. It emits only boolean and
type metadata; it never returns connector contents, credentials or environment
values.

Run it with a JSON user prompt on `@niujiazhen/personal`. Supported hub
operations are `hub_connector`, `hub_model`, `get_nodes`, and `dispatch`.
Worker operations sent through `dispatch` are `hello`, `connector`, `model`,
and `delay`.
