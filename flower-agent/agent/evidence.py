"""Read-only specialists executing beside their data; only summaries cross Grid.

No language model estimates statistics or decides whether a node replied.
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import time
import unicodedata
from uuid import uuid4

MODE = "comply.evidence.v1"
NAMES = ("sanjose", "county-health", "abc")


def grid_call(agent, name, **arguments):
    result = agent.grid.call({"type": "function_call", "call_id": str(uuid4()),
                              "name": name, "arguments": json.dumps(arguments)})
    return json.loads(result["output"])


def street(value):
    """Conservative equality: retain unit numbers, normalize common street words."""
    words = re.findall(r"[A-Z0-9]+", str(value or "").split(",")[0].upper())
    aliases = {"STREET": "ST", "AVENUE": "AVE", "ROAD": "RD", "BOULEVARD": "BLVD",
               "DRIVE": "DR", "LANE": "LN", "COURT": "CT", "WAY": "WY",
               "NORTH": "N", "SOUTH": "S", "EAST": "E", "WEST": "W"}
    return " ".join(aliases.get(word, word) for word in words)


def locality(value):
    return " ".join(unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().upper().replace("_", " ").split())


def inspect_snapshot(profile, directory=Path("/data")):
    catalog = json.loads((directory / "catalog.json").read_text())
    node = catalog["node"]
    filename = {"sanjose": "permits.json", "county-health": "plan-checks.json", "abc": "licenses.json"}[node]
    meta = next(m for m in catalog["datasets"] if m["file"] == filename)
    raw = (directory / filename).read_bytes()
    if hashlib.sha256(raw).hexdigest() != meta["sha256"]:
        raise ValueError("Snapshot changed during query; refresh and retry")
    rows = json.loads(raw)
    if len(rows) != meta["record_count"] or meta["synthetic"] is not False:
        raise ValueError("Snapshot provenance check failed")
    city = profile.get("jurisdiction", {}).get("cityName", "")
    county = profile.get("jurisdiction", {}).get("county", "")
    applicable = (locality(city) in ("SAN JOSE", "SAN JOSE CITY")
                  if node == "sanjose" else locality(county) in ("SANTA CLARA", "SANTA CLARA COUNTY"))
    target = street(profile.get("address", {}).get("normalized") or profile.get("address", {}).get("raw"))
    address_field = {"sanjose": "ADDRESS", "county-health": "site_location", "abc": "Prem Addr 1"}[node]
    def same_city(row):
        if node == "abc":
            return locality(row.get("Prem City", "")) == locality(city)
        if node == "county-health":
            parts = str(row.get("site_location", "")).split(",")
            return len(parts) > 1 and locality(parts[1]) == locality(city)
        return True  # This layer contains only San José records.
    matches = [r for r in rows if applicable and target and street(r.get(address_field)) == target and same_city(r)]
    findings = [f"{len(matches)} conservative address matches in this snapshot. City and unit must match; spelling differences or missing locality can miss records."]
    if not applicable:
        findings = ["The plan's resolved jurisdiction is outside this dataset's scope or is unknown; address matching was skipped."]
    sources = [{"title": f"{node} public dataset", "url": meta["source_url"]}]
    actions = []
    ids = []
    if node == "sanjose":
        ids = [str(r["FOLDERNUM"]) for r in matches]
        counts = Counter(str(r.get("WORKDESC") or "Unknown") for r in matches)
        if counts:
            findings.append("Matched work types: " + "; ".join(f"{k}: {v}" for k, v in counts.most_common(8)))
        actions = ["Confirm permitted use, zoning and required tenant improvements with the city before signing a lease."] if applicable else []
    elif node == "county-health":
        ids = [str(r["record_id"]) for r in matches]
        approved = sum(bool(r.get("date_plan_approved")) for r in matches)
        if matches:
            findings.append(f"{approved} matched records have a plan-approval date; {len(matches)-approved} have no approval date recorded.")
        if applicable and profile.get("foodService") != "none":
            guidance = json.loads((directory / "guidance.json").read_text())
            document = guidance["documents"][1 if profile.get("acquisition") == "change_of_ownership" else 0]
            findings.append(document["summary"])
            sources.append({"title": document["title"], "url": document["source_url"]})
            actions = ["Confirm the county food-facility review pathway and inspection requirements; an existing permit does not transfer to a new owner."]
    else:
        ids = [str(r["File Number"]) + "/" + str(r["License Type"]) for r in matches]
        counts = Counter((r["License Type"], r["Lic or App"], r["Type Status"]) for r in matches)
        if counts:
            findings.append("Matched ABC type / license-or-application / status codes: " + "; ".join(f"{' / '.join(k)}: {v}" for k, v in counts.most_common(8)))
        if applicable and profile.get("alcohol") != "none":
            actions = ["Ask ABC to confirm the required license type and any transfer or location restrictions before budgeting for alcohol service."]
        elif applicable:
            findings.append("The plan currently has no alcohol service; these records alone do not add a licensing requirement.")
    if not matches and applicable:
        findings.append("No match is not evidence that the site has no permits or licenses.")
    return {"node": node, "status": "ok", "recordCount": len(rows), "retrievedAt": meta["retrieved_at"],
            "matchedCount": len(matches), "recordIds": ids[:12], "findings": findings,
            "actions": actions, "sources": sources, "limitations": meta["limitations"],
            "synthetic": False}


def handle_evidence(agent):
    """Return False for the existing conversational planner's prompts."""
    try:
        request = json.loads(agent.prompt)
    except (ValueError, TypeError):
        return False
    if not isinstance(request, dict):
        return False
    if "src_node_id" in request:
        payload = request.get("payload", "")
        try:
            task = json.loads(payload)
        except (ValueError, TypeError):
            return False
        if not isinstance(task, dict) or task.get("mode") != MODE:
            return False
        # The mounted catalog identifies this node, never a user-supplied path.
        result = inspect_snapshot(task["profile"])
        reply = grid_call(agent, "push_reply_message", payload=json.dumps(result))
        if reply.get("error"):
            raise RuntimeError("Could not deliver evidence reply")
        return True
    if request.get("mode") != MODE:
        return False
    nodes = request["nodes"]
    if set(nodes) != set(NAMES) or any(not isinstance(v, str) or not v.isdecimal() for v in nodes.values()):
        raise ValueError("Invalid deployment node IDs")
    task = json.dumps({"mode": MODE, "profile": request["profile"]})
    sent = grid_call(agent, "push_messages", messages=[
        {"dst_node_id": nodes[n], "payload": task, "reply_to_message_id": None} for n in NAMES])
    pending = {}
    reports = {}
    for name, result in zip(NAMES, sent["results"], strict=True):
        if result.get("message_id"):
            pending[result["message_id"]] = name
        else:
            reports[name] = {"node": name, "status": "error", "error": "Node did not accept the request"}
    deadline = time.monotonic() + 240
    while pending and time.monotonic() < deadline:
        response = grid_call(agent, "pull_messages", message_ids=list(pending), timeout=20)
        for message in response["messages"]:
            name = pending.get(message["reply_to_message_id"])
            if not name or message["src_node_id"] != nodes[name]:
                continue
            try:
                report = json.loads(message["payload"] or "null")
                if message.get("error") or not isinstance(report, dict) or report.get("node") != name:
                    raise ValueError("Invalid reply")
                reports[name] = report
            except (ValueError, TypeError):
                reports[name] = {"node": name, "status": "error", "error": "Node could not read its snapshot; check Docker logs"}
            del pending[message["reply_to_message_id"]]
            agent.events.emit({"type": "comply.node", "node": name, "status": reports[name]["status"]})
    for name in pending.values():
        reports[name] = {"node": name, "status": "error", "error": "Timed out waiting for this node"}
    agent.events.emit({"type": "comply.evidence", "report": {
        "checkedAt": datetime.now(timezone.utc).isoformat(), "nodes": [reports[n] for n in NAMES]}})
    return True
