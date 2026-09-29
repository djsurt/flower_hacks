"""Loopback-only NDJSON bridge for running the Comply Cofounder AgentApp."""

from __future__ import annotations

import json
import os
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from flwr.cli.chat.chat_local_agent import LocalAgent, build_local_agent
from flwr.cli.flower_config import read_superlink_connection
from flwr.cli.utils import init_http_client_from_connection
from flwr.proto.control_pb2 import (  # pylint: disable=no-name-in-module
    ListFederationsRequest,
    StartRunRequest,
    StopRunRequest,
    StreamRunEventsRequest,
)
from flwr.proto.fab_pb2 import Fab  # pylint: disable=no-name-in-module
from flwr.supercore.control import ControlHttpClient
from pydantic import BaseModel, Field, field_validator

TERMINAL_EVENTS = {"response.completed", "response.incomplete", "response.failed", "error"}


class RunRequest(BaseModel):
    """One web chat turn."""

    prompt: str = Field(min_length=1, max_length=250_000)
    seriesId: str | None = None

    @field_validator("seriesId")
    @classmethod
    def valid_series_id(cls, value: str | None) -> str | None:
        if value is not None and (not value.isdigit() or int(value) <= 0):
            raise ValueError("seriesId must be a positive integer string")
        return value


def _line(payload: dict[str, Any]) -> str:
    return json.dumps(payload, separators=(",", ":")) + "\n"


class FlowerRunner:
    """Start AgentApp runs and translate Flower's event stream to NDJSON."""

    def __init__(
        self,
        connection_name: str | None = None,
        federation: str | None = None,
        agent_path: Path | None = None,
        app_spec: str = "@niujiazhen/comply-cofounder",
        use_published_app: bool = False,
        client_factory: Callable[[], ControlHttpClient] | None = None,
        agent_builder: Callable[[Path], LocalAgent] = build_local_agent,
    ) -> None:
        self.connection_name = connection_name or os.environ.get("FLOWER_BRIDGE_CONNECTION", "local-agent")
        self.federation = federation or os.environ.get("FLOWER_BRIDGE_FEDERATION")
        self.agent_path = agent_path or Path(os.environ.get("FLOWER_AGENT_PATH", Path(__file__).parents[1]))
        self.app_spec = os.environ.get("FLOWER_AGENT_APP_SPEC", app_spec)
        self.use_published_app = use_published_app or os.environ.get("FLOWER_USE_PUBLISHED_APP") == "1"
        self._client_factory = client_factory
        self._agent_builder = agent_builder

    def _client(self) -> ControlHttpClient:
        if self._client_factory:
            return self._client_factory()
        connection = read_superlink_connection(self.connection_name)
        return init_http_client_from_connection(connection)

    def _federation(self, client: ControlHttpClient) -> str:
        if self.federation:
            return self.federation
        federations = list(client.ListFederations(ListFederationsRequest()).federations)
        if not federations:
            raise RuntimeError("The selected SuperLink has no available federation.")
        personal = next((item.name for item in federations if item.name.endswith("/personal")), None)
        return personal or federations[0].name

    @staticmethod
    def _event(task_event: Any) -> tuple[str, dict[str, Any]]:
        event_name = task_event.event or ""
        try:
            data = json.loads(task_event.data or "{}")
        except json.JSONDecodeError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        if not event_name and isinstance(data.get("type"), str):
            event_name = data["type"]
        return event_name, data

    def stream(self, prompt: str, series_id: str | None = None) -> Iterator[str]:
        client: ControlHttpClient | None = None
        run_id: int | None = None
        terminal = False
        disconnected = False
        try:
            client = self._client()
            federation = self._federation(client)
            if self.use_published_app:
                request = StartRunRequest(app_spec=self.app_spec, user_prompt=prompt, federation=federation)
            else:
                local = self._agent_builder(self.agent_path)
                request = StartRunRequest(
                    app_spec="",
                    user_prompt=prompt,
                    federation=federation,
                    fab=Fab(hash_str=local.fab_hash, content=local.fab_content),
                )
            if series_id:
                request.series_id = int(series_id)
            response = client.StartRun(request)
            if not response.HasField("run_id"):
                raise RuntimeError("Flower did not return a run ID.")
            run_id = response.run_id
            resolved_series = str(response.series_id) if response.HasField("series_id") else None
            yield _line({"type": "run", "runId": str(run_id), **({"seriesId": resolved_series} if resolved_series else {})})

            for item in client.StreamRunEvents(StreamRunEventsRequest(run_id=run_id)):
                event_name, data = self._event(item.task_event)
                if event_name in TERMINAL_EVENTS:
                    terminal = True
                yield _line({"type": "event", "event": event_name, "data": data})
                if terminal:
                    break
            if not terminal:
                raise RuntimeError("Flower event stream ended before a terminal event.")
        except GeneratorExit:
            disconnected = True
            return
        except Exception as exc:  # pylint: disable=broad-exception-caught
            yield _line({"type": "error", "message": f"Flower bridge failed ({type(exc).__name__}). Check the bridge and SuperLink configuration."})
        finally:
            if client is not None and run_id is not None and not terminal:
                try:
                    client.StopRun(StopRunRequest(run_id=run_id))
                except Exception:  # pylint: disable=broad-exception-caught
                    pass
            if client is not None:
                client.close()
            if not disconnected:
                yield _line({"type": "done"})


app = FastAPI(title="Comply Cofounder Flower Bridge", docs_url=None, redoc_url=None)
runner = FlowerRunner()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/runs/stream")
def run(request: RunRequest) -> StreamingResponse:
    return StreamingResponse(
        runner.stream(request.prompt, request.seriesId),
        media_type="application/x-ndjson",
        headers={"cache-control": "no-store"},
    )
