#!/usr/bin/env bash
# Validate and zip plugins for deployment: dist/<Name>.zip with the plugin folder at the zip root.
# The zip works for Workstation's "Import Visualization"; for Library/Web, unzip it into the
# server's plugins folder and restart the web server.
#
#   scripts/package.sh SvBulletChart     # one plugin
#   scripts/package.sh                   # every plugin in plugins/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/dist"

if [[ $# -gt 0 ]]; then
    NAMES=("$@")
else
    NAMES=()
    for dir in "$ROOT"/plugins/*/; do
        NAMES+=("$(basename "$dir")")
    done
fi

python3 -I "$ROOT/scripts/validate.py" "${NAMES[@]}"

for NAME in "${NAMES[@]}"; do
    OUT="$ROOT/dist/$NAME.zip"
    rm -f "$OUT"
    (cd "$ROOT/plugins" && zip -qrX "$OUT" "$NAME" -x '*.DS_Store' -x '*/.*')
    echo "packaged dist/$NAME.zip ($(du -h "$OUT" | cut -f1 | tr -d ' '))"
done
