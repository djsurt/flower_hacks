"""Local NDJSON bridge using the authenticated Flower 1.39 CLI transport.

Uses ~/.flwr credentials. Never sends credentials or raw snapshots to the browser.
Flower CLI helper imports are version-specific, hence the exact dependency pin.
"""
import contextlib
import json
from pathlib import Path
import signal
import sys

from flwr.cli.chat.chat_app import parse_task_event, start_chat_run
from flwr.cli.chat.chat_local_agent import build_local_agent
from flwr.cli.flower_config import read_superlink_connection
from flwr.cli.utils import init_http_client_from_connection
from flwr.proto.control_pb2 import StopRunRequest, StreamRunEventsRequest

ROOT = Path(__file__).resolve().parent


def emit(value):
    print(json.dumps(value), flush=True)


def interrupted(_signum, _frame):
    raise InterruptedError("Evidence run cancelled or timed out")


def main():
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    signal.signal(signal.SIGALRM, interrupted)
    signal.alarm(330)
    client = None
    run_id = None
    finished = False
    try:
        request = json.loads(sys.stdin.read(32769))
        deployment = json.loads((ROOT.parent / "flower-nodes/deployment.json").read_text())
        with contextlib.redirect_stdout(sys.stderr):
            app = build_local_agent(ROOT)
            client = init_http_client_from_connection(read_superlink_connection("supergrid"))
            run_id, _ = start_chat_run(client,
                json.dumps({"mode": "comply.evidence.v1", "profile": request["profile"], "nodes": deployment["nodes"]}),
                deployment["federation"], None, app.app_spec, app.fab_hash, app.fab_content)
        emit({"type": "started", "runId": str(run_id), "federation": deployment["federation"]})
        for response in client.StreamRunEvents(StreamRunEventsRequest(run_id=run_id)):
            kind, payload = parse_task_event(response.task_event)
            if kind == "comply.node":
                emit({"type": "node", "node": payload["node"], "status": payload["status"]})
            elif kind == "comply.evidence":
                emit({"type": "report", "report": {**payload["report"], "runId": str(run_id),
                      "federation": deployment["federation"]}})
                finished = True
                break
            elif kind in {"error", "response.failed", "response.incomplete"}:
                raise RuntimeError("Remote evidence run failed")
        if not finished:
            raise RuntimeError("No evidence report received")
    except Exception as exc:
        # Only exception class leaves the bridge: auth/transport errors may contain secrets.
        emit({"type": "error", "message": f"Flower evidence check failed ({type(exc).__name__}). Check Docker and run `flwr login supergrid` if your session expired."})
        return 1
    finally:
        signal.alarm(0)
        if client:
            if run_id is not None and not finished:
                try:
                    stopped = client.StopRun(StopRunRequest(run_id=run_id))
                    if not stopped.success:
                        emit({"type": "error", "message": f"Could not stop Flower run {run_id}; check it in Flower."})
                except Exception:
                    emit({"type": "error", "message": f"Could not confirm cancellation of Flower run {run_id}; check it in Flower."})
            client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
