#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

python3 - <<'PY'
import hashlib
import json
from pathlib import Path

root = Path.cwd()
manifest_path = root / "module-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

if manifest.get("schemaVersion") != 1:
    raise SystemExit("invalid schemaVersion")
if manifest.get("sourceRef") != "agent/modular-ui-bootstrap-20260801":
    raise SystemExit("unexpected sourceRef")

modules = manifest.get("modules") or []
if len(modules) != 15:
    raise SystemExit("expected 15 modules")

for item in modules:
    path = root / item["path"]
    if not path.is_file():
        raise SystemExit("missing module: %s" % path)
    source = path.read_bytes()
    actual = hashlib.sha256(source).hexdigest()
    if actual != item["sha256"]:
        raise SystemExit(
            "sha256 mismatch: %s\nexpected=%s\nactual=%s" %
            (path, item["sha256"], actual)
        )

print("manifest and SHA-256 verification passed")
PY

if command -v node >/dev/null 2>&1; then
    node --check entry/SingBoxHub.js
    node --check entry/SingBoxHubToggle.js
    for file in src/sbh_*.js; do
        node --check "$file"
    done
    echo "JavaScript syntax verification passed"
else
    echo "node not found; skipped JavaScript syntax verification"
fi
