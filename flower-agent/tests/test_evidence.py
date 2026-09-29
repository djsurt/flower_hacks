import hashlib
import json
from types import SimpleNamespace

import pytest

from agent.evidence import MODE, handle_evidence, inspect_snapshot, street


def snapshot(tmp_path, node, rows):
    filename = {"sanjose": "permits.json", "county-health": "plan-checks.json", "abc": "licenses.json"}[node]
    raw = json.dumps(rows).encode()
    (tmp_path / filename).write_bytes(raw)
    meta = {"file": filename, "sha256": hashlib.sha256(raw).hexdigest(), "synthetic": False,
            "record_count": len(rows), "retrieved_at": "2026-09-29T12:00:00Z", "source_url": "https://www.abc.ca.gov/", "limitations": ["Snapshot only"]}
    (tmp_path / "catalog.json").write_text(json.dumps({"node": node, "datasets": [meta]}))


def profile(city="San Jose"):
    return {"address": {"raw": "123 West Main Street, San Jose, CA"},
            "jurisdiction": {"cityName": city, "county": "Santa Clara County"}, "alcohol": "none", "foodService": "none"}


def test_conservative_matching_and_jurisdiction(tmp_path):
    snapshot(tmp_path, "sanjose", [
        {"ADDRESS": "123 W MAIN ST, SAN JOSE CA", "FOLDERNUM": "P1", "WORKDESC": "Alteration"},
        {"ADDRESS": "123 W MAIN ST #2, SAN JOSE CA", "FOLDERNUM": "P2"},
        {"ADDRESS": "1230 W MAIN ST, SAN JOSE CA", "FOLDERNUM": "P3"},
    ])
    report = inspect_snapshot(profile(), tmp_path)
    assert report["matchedCount"] == 1
    assert report["recordIds"] == ["P1"]
    assert inspect_snapshot(profile("Sunnyvale"), tmp_path)["matchedCount"] == 0
    assert street("123 W Main St #2") != street("123 W Main St")


def test_abc_distinguishes_city_and_application_status(tmp_path):
    snapshot(tmp_path, "abc", [
        {"Prem Addr 1": "123 W MAIN ST", "Prem City": "SAN JOSE", "File Number": "1", "License Type": "41", "Lic or App": "APP", "Type Status": "PEND"},
        {"Prem Addr 1": "123 W MAIN ST", "Prem City": "SUNNYVALE", "File Number": "2", "License Type": "41", "Lic or App": "LIC", "Type Status": "ACTIVE"},
    ])
    report = inspect_snapshot(profile(), tmp_path)
    assert report["matchedCount"] == 1
    assert "41 / APP / PEND: 1" in report["findings"][1]
    assert not report["actions"]  # No alcohol service means no proposed license action.


def test_snapshot_mismatch_fails_closed(tmp_path):
    snapshot(tmp_path, "abc", [])
    (tmp_path / "licenses.json").write_text("[{}]")
    with pytest.raises(ValueError, match="Snapshot changed"):
        inspect_snapshot(profile(), tmp_path)


def test_web_county_id_and_cross_city_address_collision(tmp_path):
    snapshot(tmp_path, "county-health", [
        {"site_location": "123 W MAIN ST, SAN JOSE, CA", "record_id": "1", "date_plan_approved": "2026-09-01"},
        {"site_location": "123 W MAIN ST, SUNNYVALE, CA", "record_id": "2"},
        {"site_location": "123 W MAIN ST", "record_id": "3"},
    ])
    p = profile("San José")
    p["jurisdiction"]["county"] = "santa_clara"
    result = inspect_snapshot(p, tmp_path)
    assert result["matchedCount"] == 1
    assert result["recordIds"] == ["1"]
    assert "1 matched records have a plan-approval date" in result["findings"][1]


def test_grid_uses_real_replies_and_reports_partial_failure():
    events = []
    calls = []
    nodes = {"sanjose": "9228757528304447072", "county-health": "14889312096352897577", "abc": "6553679376321286512"}
    def call(tool):
        calls.append(tool)
        if tool["name"] == "push_messages":
            output = {"results": [{"message_id": "a"}, {"message_id": "b"}, {"message_id": None}]}
        else:
            output = {"messages": [
                {"reply_to_message_id": "a", "src_node_id": nodes["sanjose"], "payload": json.dumps({"node": "sanjose", "status": "ok"}), "error": None},
                {"reply_to_message_id": "b", "src_node_id": nodes["county-health"], "payload": None, "error": "worker unavailable"},
            ]}
        return {"output": json.dumps(output)}
    agent = SimpleNamespace(prompt=json.dumps({"mode": MODE, "nodes": nodes, "profile": profile()}),
                            grid=SimpleNamespace(call=call), events=SimpleNamespace(emit=events.append))
    assert handle_evidence(agent)
    assert [n["status"] for n in events[-1]["report"]["nodes"]] == ["ok", "error", "error"]
    sent = json.loads(calls[0]["arguments"])["messages"]
    assert [m["dst_node_id"] for m in sent] == list(nodes.values())
    assert handle_evidence(SimpleNamespace(prompt="Plan a cafe")) is False
