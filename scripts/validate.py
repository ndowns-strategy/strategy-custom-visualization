#!/usr/bin/env python3
"""Static checks for every plugin in plugins/ (or the ones named on the command line).

Catches the mistakes that make a custom visualization silently fail to load in Strategy:
names that don't line up between the XML config, the JS classes and the CSS; missing files;
malformed XML; and a few best practices from the Visualization SDK docs.

Usage: python3 scripts/validate.py [PluginName ...]
Exit code is non-zero if any plugin has errors.
"""

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLUGINS = ROOT / "plugins"
NAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9]*$")


class Report:
    def __init__(self, name):
        self.name = name
        self.errors = []
        self.warnings = []

    def error(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)


def parse_xml(path, report):
    try:
        return ET.parse(path).getroot()
    except FileNotFoundError:
        report.error(f"missing {path.relative_to(ROOT)}")
    except ET.ParseError as exc:
        report.error(f"{path.relative_to(ROOT)} is not well-formed XML: {exc}")
    return None


def class_file(plugin_dir, plugin, class_ref, label, report):
    """'plugins.Foo.FooDropZones' -> javascript/mojo/js/source/FooDropZones.js (must exist)."""
    parts = class_ref.split(".")
    if len(parts) != 3 or parts[0] != "plugins":
        report.error(f'{label}="{class_ref}" should be plugins.{plugin}.<FileName>')
        return None
    if parts[1] != plugin:
        report.error(f'{label}="{class_ref}" names plugin folder "{parts[1]}", expected "{plugin}"')
    path = plugin_dir / "javascript" / "mojo" / "js" / "source" / f"{parts[2]}.js"
    if not path.exists():
        report.error(f"{label} points to {path.relative_to(ROOT)}, which does not exist")
        return None
    return path, f"mstrmojo.{class_ref}"


ES6_PATTERNS = [
    (re.compile(r"=>"), "arrow function"),
    (re.compile(r"\b(let|const)\s"), "let/const"),
    (re.compile(r"`"), "template literal"),
    (re.compile(r"^\s*class\s", re.M), "class declaration"),
]


def strip_comments_and_strings(text):
    return re.sub(r"/\*.*?\*/|//[^\n]*|\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'", '""', text, flags=re.S)


def check_js(path, expected_class, report, main=False):
    text = path.read_text(encoding="utf-8")
    rel = path.relative_to(ROOT)
    code = strip_comments_and_strings(text)
    for pattern, label in ES6_PATTERNS:
        if pattern.search(code):
            report.error(f"{rel}: uses {label}; hand-written plugins must be ES5 (they run unbundled)")
    m = re.search(r'scriptClass\s*:\s*["\']([^"\']+)["\']', text)
    if not m:
        report.error(f"{rel}: no scriptClass")
    elif m.group(1) != expected_class:
        report.error(f'{rel}: scriptClass is "{m.group(1)}", expected "{expected_class}"')
    if f"{expected_class} = mstrmojo.declare(" not in re.sub(r"\s+", " ", text):
        report.error(f"{rel}: expected `{expected_class} = mstrmojo.declare(`")

    if main:
        libs = re.search(r"externalLibraries\s*:\s*\[(.*?)\]", text, re.S)
        code_only = re.sub(r"\"[^\"]*\"|'[^']*'", "", libs.group(1)) if libs else ""
        if "//" in code_only or "/*" in code_only:
            report.warn(f"{rel}: comments inside externalLibraries break parsing on Strategy Mobile")
        if libs and re.search(r"url\s*:\s*[\"']https?://", libs.group(1)):
            report.warn(f"{rel}: externalLibraries loads from the internet; prefer a local copy via mstrApp.getPluginsRoot()")
        if re.search(r"supportNEE\s*:\s*true", text) and "renderFinished" not in text:
            report.error(f"{rel}: supportNEE is true but renderFinished is never raised (PDF export would hang)")
        css = re.search(r'cssClass\s*:\s*["\']([^"\']+)["\']', text)
        return css.group(1) if css else None
    return None


def validate(plugin):
    report = Report(plugin)
    plugin_dir = PLUGINS / plugin
    if not NAME_RE.match(plugin):
        report.error("plugin folder names must be letters and digits only (no symbols)")

    vis_root = parse_xml(plugin_dir / "WEB-INF" / "xml" / "config" / "visualizations.xml", report)
    cat_root = parse_xml(plugin_dir / "WEB-INF" / "xml" / "styleCatalog.xml", report)
    if vis_root is None or cat_root is None:
        return report

    lists = vis_root.findall("visualization-list")
    ajax = [vl for vl in lists if vl.get("name") == "ajax"]
    if not ajax:
        report.error('visualizations.xml has no <visualization-list name="ajax">')
        return report
    vis = ajax[0].find("visualization")
    if vis is None:
        report.error("visualizations.xml has no <visualization>")
        return report

    style_name = vis.get("style-name")
    if vis.get("is-mojo") != "true":
        report.error('<visualization> needs is-mojo="true" in the ajax list')
    if vis.get("id") and vis.get("id") != plugin:
        report.warn(f'<visualization id="{vis.get("id")}"> differs from the folder name')
    if style_name != plugin:
        report.warn(f'style-name "{style_name}" differs from the folder name (the gallery icon class is ic-<style-name>)')
    if not vis.get("desc"):
        report.error("<visualization> needs desc (the name shown in the gallery)")
    tooltip_keys = [k for k in ("summary", "use-case", "requirements") if vis.get(k)]
    if 0 < len(tooltip_keys) < 3:
        report.warn("gallery tooltip only appears when summary, use-case and requirements are all set")
    for k in ("attribute-minimum", "metric-minimum"):
        if vis.get(k) is not None and not vis.get(k).isdigit():
            report.error(f"{k} must be a whole number")

    # The docs disagree on the default, so the React Format panel flag must be explicit.
    react = vis.get("use-react-config")
    if react not in ("true", "false"):
        report.error('<visualization> needs use-react-config="false" (or "true" with a built React Format panel)')
    elif react == "true" and not ((plugin_dir / "formatPanelConfig").is_dir() or (plugin_dir / "formatPanelBundles").is_dir()):
        report.error('use-react-config="true" but the plugin has no formatPanelConfig/ or formatPanelBundles/ (mstr-viz build output)')
    if vis.get("use-binary-data") not in (None, "false"):
        report.warn('use-binary-data is not "false"; hand-written plugins read JSON grid data')

    styles = {s.get("name"): s for s in cat_root.iter("Style")}
    style = styles.get(style_name)
    if style is None:
        report.error(f'styleCatalog.xml has no <Style name="{style_name}">')
        return report
    params = {p.get("name"): p.get("value") for p in style.iter("ActualParameter")}
    if params.get("reportXMLStyle") != "VisualizationServerJsonDataStyle":
        report.warn('reportXMLStyle should be "VisualizationServerJsonDataStyle" (thresholds in documents need it)')
    if style.get("transform") != "ReportAjaxMojoVisualizationTransform":
        report.error('<Style transform> should be "ReportAjaxMojoVisualizationTransform"')

    mojo_class = params.get("mojoClassName")
    css_class = None
    if not mojo_class:
        report.error("styleCatalog.xml: missing mojoClassName parameter")
    else:
        found = class_file(plugin_dir, plugin, mojo_class, "mojoClassName", report)
        if found:
            css_class = check_js(found[0], found[1], report, main=True)

    if vis.get("drop-zones"):
        found = class_file(plugin_dir, plugin, vis.get("drop-zones"), "drop-zones", report)
        if found:
            check_js(found[0], found[1], report)
        if vis.get("widget-type") != "7":
            report.warn('custom drop zones normally need widget-type="7"')
    if vis.get("editor-model"):
        found = class_file(plugin_dir, plugin, vis.get("editor-model"), "editor-model", report)
        if found:
            check_js(found[0], found[1], report)

    # CSS: the gallery icon rule must be in global.css (what Library and Workstation load, and where the
    # Custom Visualization Tool puts it); Html5ViPage.css carries a copy for classic Web.
    icon_class = f".ic-{style_name}"
    global_css = plugin_dir / "style" / "global.css"
    page_css = plugin_dir / "style" / "Html5ViPage.css"
    if not global_css.exists():
        report.error("missing style/global.css")
    elif icon_class not in global_css.read_text(encoding="utf-8"):
        report.error(f"style/global.css has no {icon_class} rule, so Library/Workstation show a blank gallery icon")
    if not page_css.exists():
        report.warn("no style/Html5ViPage.css (classic Web shows a default gallery icon)")
    elif icon_class not in page_css.read_text(encoding="utf-8"):
        report.warn(f"style/Html5ViPage.css has no {icon_class} rule (classic Web gallery icon)")
    for css_file in (global_css, page_css):
        if css_file.exists():
            for url in re.findall(r'url\(["\']?([^"\')]+)', css_file.read_text(encoding="utf-8")):
                if not (css_file.parent / url).resolve().exists():
                    report.error(f"{css_file.relative_to(ROOT)} references missing file {url}")

    if global_css.exists() and css_class:
        scope = f".custom-vis-layout.{css_class}"
        text = re.sub(r"/\*.*?\*/", "", global_css.read_text(encoding="utf-8"), flags=re.S)
        for selector_group in re.findall(r"([^{}]+)\{", text):
            for selector in selector_group.split(","):
                selector = selector.strip()
                allowed = (scope, icon_class, "#RwMenuModel", "@")
                if selector and not selector.startswith(allowed):
                    report.warn(f'style/global.css: selector "{selector}" is not scoped to {scope}')

    for path in plugin_dir.rglob("*"):
        if not path.is_file():
            continue
        if re.search(r"[^A-Za-z0-9._-]", path.name):
            report.warn(f"{path.relative_to(ROOT)}: avoid spaces/symbols in file names inside a plugin")
        if path.suffix in (".js", ".css", ".xml", ".svg"):
            data = path.read_bytes()
            if data.startswith(b"\xef\xbb\xbf"):
                report.error(f"{path.relative_to(ROOT)}: remove the UTF-8 byte-order mark")
            bad = [i + 1 for i, line in enumerate(data.split(b"\n")) if any(b > 127 for b in line)]
            if bad:
                report.error(f"{path.relative_to(ROOT)}: non-ASCII characters on line(s) {bad[:5]}; "
                             "use \\uXXXX escapes (servers may not serve plugin files as UTF-8)")
    return report


def main(argv):
    names = argv or sorted(p.name for p in PLUGINS.iterdir() if p.is_dir())
    failed = False
    for name in names:
        if not (PLUGINS / name).is_dir():
            print(f"✗ {name}: no such plugin in plugins/")
            failed = True
            continue
        r = validate(name)
        mark = "✗" if r.errors else ("!" if r.warnings else "✓")
        print(f"{mark} {name}")
        for e in r.errors:
            print(f"    error: {e}")
        for w in r.warnings:
            print(f"    warning: {w}")
        failed = failed or bool(r.errors)

    manifest = ROOT / "dev" / "plugins.json"
    if manifest.exists() and not argv:
        listed = set(json.loads(manifest.read_text(encoding="utf-8")))
        on_disk = {p.name for p in PLUGINS.iterdir() if p.is_dir()}
        for missing in sorted(on_disk - listed):
            print(f"! dev/plugins.json does not list {missing} (it won't appear in the harness)")
        for stale in sorted(listed - on_disk):
            print(f"✗ dev/plugins.json lists {stale}, which is not in plugins/")
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
