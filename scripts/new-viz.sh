#!/usr/bin/env bash
# Scaffold a new visualization plugin from templates/SvTemplate.
#
#   scripts/new-viz.sh SvWaterfall "Waterfall Chart"
#
# NAME becomes the plugin folder, class namespace and gallery icon class, so it must be
# letters and digits only and start with a capital letter. The Sv prefix keeps our plugins
# from colliding with Strategy's or other teams' plugins in the same plugins folder.
set -euo pipefail

usage() {
    echo "usage: $0 <PluginName> [\"Display Name\"]" >&2
    exit 1
}

[[ $# -ge 1 ]] || usage
NAME="$1"
TITLE="${2:-$1}"
[[ "$NAME" =~ ^[A-Z][A-Za-z0-9]+$ ]] || { echo "PluginName must be letters/digits and start with a capital letter (e.g. SvWaterfall)" >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/templates/SvTemplate"
DEST="$ROOT/plugins/$NAME"
[[ -e "$DEST" ]] && { echo "plugins/$NAME already exists" >&2; exit 1; }

cp -R "$SRC" "$DEST"

# Rename files whose names contain the template name.
find "$DEST" -depth -name '*SvTemplate*' | while read -r path; do
    dir="$(dirname "$path")"
    base="$(basename "$path")"
    mv "$path" "$dir/${base//SvTemplate/$NAME}"
done

# Replace tokens inside files.
LOWER="$(printf '%s' "$NAME" | tr '[:upper:]' '[:lower:]')"
export NAME LOWER TITLE
find "$DEST" -type f \( -name '*.js' -o -name '*.css' -o -name '*.xml' \) -print0 |
    xargs -0 perl -pi -e 's/SvTemplate/$ENV{NAME}/g; s/svtemplate/$ENV{LOWER}/g; s/__SV_TITLE__/$ENV{TITLE}/g'

# Register it with the preview harness.
python3 -I - "$ROOT/dev/plugins.json" "$NAME" <<'PY'
import json, sys
path, name = sys.argv[1], sys.argv[2]
with open(path) as f:
    plugins = json.load(f)
if name not in plugins:
    plugins.append(name)
with open(path, "w") as f:
    json.dump(plugins, f, indent=2)
    f.write("\n")
PY

python3 -I "$ROOT/scripts/validate.py" "$NAME"

cat <<EOF

Created plugins/$NAME. Next:
  1. Preview:  python3 -m http.server 8765   then open http://localhost:8765/dev/?plugin=$NAME
  2. Edit plugins/$NAME/javascript/mojo/js/source/$NAME.js (plot) and ${NAME}DropZones.js / ${NAME}EditorModel.js
  3. Replace plugins/$NAME/style/images/icon.svg
  4. Package:  scripts/package.sh $NAME
EOF
