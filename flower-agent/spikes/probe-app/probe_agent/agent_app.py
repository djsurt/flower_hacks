"""Minimal live probes for Flower Agent collaboration capabilities.

The probe deliberately returns only capability metadata. Connector contents,
model credentials, environment values and user data are never emitted.
"""
from __future__ import annotations

import json
import os
import time
from typing import Any
from uuid import uuid4

from flwr.agentapp import AgentApp, AgentSession
from flwr.app import Context
from openai import OpenAI

app = AgentApp()


def grid_call(agent: AgentSession, name: str, **arguments: Any) -> dict[str, Any]:
    result = agent.grid.call({
        "type": "function_call",
        "call_id": str(uuid4()),
        "name": name,
        "arguments": json.dumps(arguments),
    })
    output = json.loads(result["output"])
    if not isinstance(output, dict):
        raise TypeError(f"Grid tool {name} returned a non-object")
    return output


def connector_probe(agent: AgentSession) -> dict[str, Any]:
    tools = agent.connectors.tools(["web_search"])
    if not tools:
        raise RuntimeError("web_search returned no tool schemas")
    tool = tools[0]
    name = tool.get("name")
    if not isinstance(name, str):
        raise RuntimeError("web_search schema has no tool name")
    result = agent.connectors.call({
        "type": "function_call",
        "call_id": str(uuid4()),
        "name": name,
        "arguments": json.dumps({"query": "site:ca.gov California seller permit official"}),
    })
    return {"ok": isinstance(result, dict), "tool": name, "result_type": result.get("type") if isinstance(result, dict) else None}


def connector_model_probe(agent: AgentSession, model: str) -> dict[str, Any]:
    """Exercise the documented model -> connector call path without returning source content."""
    tools = agent.connectors.tools(["web_search"])
    if not tools:
        raise RuntimeError("web_search returned no tool schemas")
    allowed = {tool["name"] for tool in tools}
    client = OpenAI(
        base_url=os.environ["FLWR_RUNTIME_BASE_URL"],
        api_key=os.environ["FLWR_RUNTIME_API_KEY"],
        max_retries=0,
    )
    response = client.responses.create(
        model=model,
        instructions="Use web_search once. Search only an official California government source.",
        input="Find the official California seller's permit page.",
        tools=tools,
    )
    calls = [item for item in response.output if getattr(item, "type", "") == "function_call"]
    if not calls:
        raise RuntimeError("model did not request a connector")
    call = calls[0]
    if call.name not in allowed:
        raise RuntimeError("model requested a connector outside the allowlist")
    json.loads(call.arguments or "{}")
    result = agent.connectors.call({"name": call.name, "arguments": call.arguments, "call_id": call.call_id})
    return {
        "ok": isinstance(result, dict),
        "model": model,
        "tool": call.name,
        "result_type": result.get("type") if isinstance(result, dict) else None,
    }


def model_probe(model: str) -> dict[str, Any]:
    client = OpenAI(
        base_url=os.environ["FLWR_RUNTIME_BASE_URL"],
        api_key=os.environ["FLWR_RUNTIME_API_KEY"],
        max_retries=0,
    )
    response = client.responses.create(model=model, input="Reply with exactly MODEL_OK.")
    text = (response.output_text or "").strip()
    return {"ok": text == "MODEL_OK", "text": text[:40], "model": model}


def reply(agent: AgentSession, value: dict[str, Any]) -> None:
    result = grid_call(agent, "push_reply_message", payload=json.dumps(value, separators=(",", ":")))
    if result.get("error"):
        raise RuntimeError("Could not send probe reply")


def handle_worker(agent: AgentSession, context: Context, envelope: dict[str, Any]) -> bool:
    if "src_node_id" not in envelope:
        return False
    try:
        payload = json.loads(envelope.get("payload", ""))
    except (TypeError, ValueError):
        return False
    if not isinstance(payload, dict) or payload.get("protocol") != "comply.probe.v1":
        return False
    operation = payload.get("operation")
    result: dict[str, Any] = {"protocol": "comply.probe.reply.v1", "operation": operation, "ok": False}
    try:
        if operation == "hello":
            result.update(ok=True, node_config=dict(context.node_config))
        elif operation == "connector":
            result.update(connector_probe(agent))
        elif operation == "model":
            result.update(model_probe(str(payload.get("model") or "dedicated/flowerai/Kimi-K2.7-Code-1OUHWL")))
        elif operation == "delay":
            time.sleep(min(max(int(payload.get("seconds", 5)), 1), 60))
            result.update(ok=True)
        else:
            result["error"] = "unknown operation"
    except Exception as exc:  # capability result, never include provider details
        result["error"] = type(exc).__name__
    reply(agent, result)
    return True


def emit_text(agent: AgentSession, text: str) -> None:
    agent.events.emit({"type": "response.output_text.delta", "delta": text})
    agent.events.emit({"type": "response.completed"})


@app.main()
def main(agent: AgentSession, context: Context) -> None:
    try:
        envelope = json.loads(agent.prompt)
    except (TypeError, ValueError):
        emit_text(agent, "Probe input must be JSON.")
        return
    if not isinstance(envelope, dict):
        emit_text(agent, "Probe input must be an object.")
        return
    if handle_worker(agent, context, envelope):
        return
    if envelope.get("protocol") != "comply.probe.v1":
        emit_text(agent, "Unknown probe protocol.")
        return

    operation = envelope.get("operation")
    if operation == "hub_connector":
        result = connector_probe(agent)
    elif operation == "hub_connector_model":
        result = connector_model_probe(agent, str(context.run_config.get("agent.model", "openai/gpt-5.6-sol")))
    elif operation == "hub_model":
        result = model_probe(str(context.run_config.get("agent.model", "openai/gpt-5.6-sol")))
    elif operation == "get_nodes":
        result = grid_call(agent, "get_nodes")
    elif operation == "dispatch":
        node_id = str(envelope["node_id"])
        payload = {
            "protocol": "comply.probe.v1",
            "operation": envelope.get("worker_operation", "hello"),
            "model": envelope.get("model"),
            "seconds": envelope.get("seconds"),
        }
        sent = grid_call(agent, "push_messages", messages=[{
            "dst_node_id": node_id,
            "payload": json.dumps(payload, separators=(",", ":")),
            "reply_to_message_id": None,
        }])
        message_id = sent.get("results", [{}])[0].get("message_id")
        if not message_id:
            result = {"ok": False, "error": "message not accepted"}
        else:
            pulled = grid_call(agent, "pull_messages", message_ids=[message_id], timeout=int(envelope.get("timeout", 45)))
            messages = pulled.get("messages", [])
            result = json.loads(messages[0]["payload"]) if messages else {"ok": False, "error": "timeout"}
    else:
        result = {"ok": False, "error": "unknown operation"}
    emit_text(agent, json.dumps(result, sort_keys=True))
