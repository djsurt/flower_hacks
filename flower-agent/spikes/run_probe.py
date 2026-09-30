"""Run the collaboration probe through the existing Flower Control bridge."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from bridge.app import FlowerRunner


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "operation",
        choices=("hub_connector", "hub_connector_model", "hub_model", "get_nodes", "dispatch"),
    )
    parser.add_argument("--federation", default="@niujiazhen/comply-cofounder")
    parser.add_argument("--node-id")
    parser.add_argument("--worker-operation", choices=("hello", "connector", "model", "delay"), default="hello")
    parser.add_argument("--model")
    parser.add_argument("--seconds", type=int)
    parser.add_argument("--timeout", type=int, default=45)
    args = parser.parse_args()
    if args.operation == "dispatch" and not args.node_id:
        parser.error("dispatch requires --node-id")
    prompt = {
        "protocol": "comply.probe.v1",
        "operation": args.operation,
        "node_id": args.node_id,
        "worker_operation": args.worker_operation,
        "model": args.model,
        "seconds": args.seconds,
        "timeout": args.timeout,
    }
    runner = FlowerRunner(
        connection_name="supergrid",
        federation=args.federation,
        agent_path=Path(__file__).parent / "probe-app",
    )
    for line in runner.stream(json.dumps(prompt, separators=(",", ":"))):
        item = json.loads(line)
        if item.get("type") == "event" and item.get("event") == "response.output_text.delta":
            print(item.get("data", {}).get("delta", ""), flush=True)
        elif item.get("type") in {"run", "error"}:
            print(json.dumps(item, sort_keys=True), flush=True)


if __name__ == "__main__":
    main()
