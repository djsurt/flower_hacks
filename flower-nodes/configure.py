"""Create node identities and save the model key locally without echoing it."""
import argparse
import getpass
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent
NODES = ("sanjose", "county-health", "abc")


def initialize():
    (ROOT / "keys").mkdir(exist_ok=True, mode=0o700)
    (ROOT / "keys").chmod(0o700)
    for node in NODES:
        (ROOT / "data" / node).mkdir(parents=True, exist_ok=True)
        key = ROOT / "keys" / node
        if not key.exists():
            subprocess.run(["ssh-keygen", "-q", "-t", "ecdsa", "-b", "384", "-N", "",
                            "-C", f"comply-{node}", "-f", str(key)], check=True)
        key.chmod(0o600)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--keys-only", action="store_true")
    args = parser.parse_args()
    initialize()
    if args.keys_only:
        print("Three node identities are ready. Existing private keys were preserved.")
        return
    secret = getpass.getpass("Paste your Flower model API key (hidden): ").strip()
    if not secret or any(c in secret for c in "\r\n'"):
        raise SystemExit("No key saved: enter a nonempty, single-line API key without quotes.")
    # Single quotes stop Compose from interpreting dollar signs in the credential.
    path = ROOT / ".env"
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(f"COMPLY_UID={os.getuid()}\nCOMPLY_GID={os.getgid()}\n")
        f.write(f"FLWR_MODEL_API_KEY='{secret}'\n")
    print("Saved the key to ignored flower-nodes/.env with owner-only permissions.")


if __name__ == "__main__":
    main()
