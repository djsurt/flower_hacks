"""Validate source snapshots and metadata without network access or credentials."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main():
    for node in ("sanjose", "county-health", "abc"):
        directory = ROOT / "data" / node
        catalog = json.loads((directory / "catalog.json").read_text())
        assert catalog["node"] == node and catalog["datasets"], f"Missing data: {node}"
        for item in catalog["datasets"]:
            path = directory / item["file"]
            rows = json.loads(path.read_text())
            assert len(rows) == item["record_count"] > 0
            assert item["synthetic"] is False
            assert hashlib.sha256(path.read_bytes()).hexdigest() == item["sha256"]
            assert item["source_url"].startswith("https://")
            if node == "county-health":
                assert all("requester" not in r and "employee_name" not in r for r in rows)
            if node == "abc":
                assert all(r["Prem County"].upper() == "SANTA CLARA" for r in rows)
                assert all(not any(k.startswith("Mail ") for k in r) for r in rows)
            if node == "sanjose":
                assert len({r["OBJECTID"] for r in rows}) == len(rows)
            print(f"PASS {node}: {len(rows)} records, provenance and checksum valid")
    assert len(json.loads((ROOT / "data/county-health/guidance.json").read_text())["documents"]) == 2


if __name__ == "__main__":
    main()
