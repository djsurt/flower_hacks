"""Contract tests for the loopback Flower Control API bridge."""

import json
from pathlib import Path
from types import SimpleNamespace

from flwr.proto.control_pb2 import (  # pylint: disable=no-name-in-module
    ListFederationsResponse,
    StartRunResponse,
    StopRunResponse,
    StreamRunEventsResponse,
)
from flwr.proto.federation_pb2 import Federation  # pylint: disable=no-name-in-module
from flwr.proto.task_pb2 import TaskEvent  # pylint: disable=no-name-in-module

from bridge.app import FlowerRunner


class FakeClient:
    def __init__(self, events=None):
        self.events = events or []
        self.started = []
        self.stopped = []
        self.closed = False

    def ListFederations(self, _request):
        return ListFederationsResponse(federations=[Federation(name="@niujiazhen/personal")])

    def StartRun(self, request):
        self.started.append(request)
        return StartRunResponse(run_id=123, series_id=456, federation="@niujiazhen/personal")

    def StreamRunEvents(self, _request):
        for event, data in self.events:
            yield StreamRunEventsResponse(task_event=TaskEvent(event=event, data=json.dumps(data)))

    def StopRun(self, request):
        self.stopped.append(request.run_id)
        return StopRunResponse(success=True)

    def close(self):
        self.closed = True


def local_agent():
    return SimpleNamespace(fab_hash="abc", fab_content=b"fab")


def decode(lines):
    return [json.loads(line) for line in lines]


def test_streams_run_metadata_events_and_done():
    client = FakeClient([
        ("comply.status", {"role": "Intake agent", "state": "running"}),
        ("response.completed", {"type": "response.completed"}),
    ])
    runner = FlowerRunner(
        federation="@niujiazhen/personal",
        agent_path=Path("/agent"),
        client_factory=lambda: client,
        agent_builder=lambda _path: local_agent(),
    )

    output = decode(runner.stream("hello", "99"))

    assert output[0] == {"type": "run", "runId": "123", "seriesId": "456"}
    assert output[1]["event"] == "comply.status"
    assert output[-1] == {"type": "done"}
    assert client.started[0].series_id == 99
    assert client.started[0].fab.content == b"fab"
    assert client.stopped == []
    assert client.closed


def test_published_app_uses_app_spec():
    client = FakeClient([("response.completed", {})])
    runner = FlowerRunner(
        federation="@niujiazhen/personal",
        app_spec="@niujiazhen/comply-cofounder",
        use_published_app=True,
        client_factory=lambda: client,
    )

    list(runner.stream("hello"))

    request = client.started[0]
    assert request.app_spec == "@niujiazhen/comply-cofounder"
    assert request.fab.content == b""


def test_early_disconnect_stops_run():
    client = FakeClient([("response.completed", {})])
    runner = FlowerRunner(
        federation="@niujiazhen/personal",
        client_factory=lambda: client,
        agent_builder=lambda _path: local_agent(),
    )
    stream = runner.stream("hello")

    assert json.loads(next(stream))["type"] == "run"
    stream.close()

    assert client.stopped == [123]
    assert client.closed


def test_failure_is_a_readable_error_and_stops_run():
    client = FakeClient([])
    runner = FlowerRunner(
        federation="@niujiazhen/personal",
        client_factory=lambda: client,
        agent_builder=lambda _path: local_agent(),
    )

    output = decode(runner.stream("hello"))

    assert output[-2]["type"] == "error"
    assert "RuntimeError" in output[-2]["message"]
    assert client.stopped == [123]


def test_connection_failure_is_returned_as_ndjson():
    def fail():
        raise RuntimeError("SuperLink unavailable")

    runner = FlowerRunner(client_factory=fail)

    output = decode(runner.stream("hello"))

    assert output == [
        {"type": "error", "message": "Flower bridge failed (RuntimeError). Check the bridge and SuperLink configuration."},
        {"type": "done"},
    ]


def test_terminal_event_does_not_wait_for_stream_to_close():
    client = FakeClient()
    def events(_request):
        yield StreamRunEventsResponse(task_event=TaskEvent(event="response.completed", data="{}"))
        raise AssertionError("must not read past the terminal event")
    client.StreamRunEvents = events
    runner = FlowerRunner(client_factory=lambda: client, agent_builder=lambda _: local_agent())
    output = decode(runner.stream("hello"))
    assert not any(item["type"] == "error" for item in output)
    assert client.closed


def test_transport_errors_do_not_expose_credentials():
    def fail():
        raise RuntimeError("Authorization: Bearer secret-token")
    output = decode(FlowerRunner(client_factory=fail).stream("hello"))
    assert "secret-token" not in json.dumps(output)
