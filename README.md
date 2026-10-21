# strategy-visualizations

Custom visualizations for **Strategy** (formerly MicroStrategy) dashboards and documents, built on the
[Visualization SDK](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/Introduction_to_the_Visualization_SDK.htm).

Each visualization is a self-contained plugin folder under `plugins/`. Copy it into a Strategy
`plugins` directory or zip-import it into Workstation, and it shows up in the visualization Gallery
with its own drop zones, Format-panel settings, selection/filtering, tooltips, context menu and PDF
export.

## Download

Ready-to-deploy zips are on the **[latest release](https://github.com/ndowns-strategy/strategy-custom-visualization/releases/latest)**:

- [SvBulletChart.zip](https://github.com/ndowns-strategy/strategy-custom-visualization/releases/latest/download/SvBulletChart.zip): Bullet Chart
- [SvFunnelChart.zip](https://github.com/ndowns-strategy/strategy-custom-visualization/releases/latest/download/SvFunnelChart.zip): Funnel Chart

These links always point to the newest release. Older versions are on the
[releases page](https://github.com/ndowns-strategy/strategy-custom-visualization/releases). See
[Deploy](#deploy) for how to install them.

## Visualizations

| Plugin | Gallery name | What it shows | Data |
|---|---|---|---|
| [`SvBulletChart`](plugins/SvBulletChart) | Bullet Chart (KPI) | Actual vs. target per item, against poor / satisfactory / good bands (% of target). Sort by value or attainment, threshold colors, value and % labels. | Category: 1+ attributes · Actual: 1 metric · Target: 1 metric (optional) · Tooltip: any |
| [`SvFunnelChart`](plugins/SvFunnelChart) | Funnel Chart | Centered bars per stage sized by the metric, with a 100% bracket over the first stage and the last stage as % of the first. Labels: value, % of first, both or none; stage order or largest first. | Stage: 1+ attributes · Value: 1 metric · Tooltip: any |

## Quick start

Requirements: Python 3 (for the preview server and validator) and a browser. Node.js is **not**
required.

```bash
python3 -m http.server 8765
```

Then open <http://localhost:8765/dev/> for the **preview harness**. It loads a plugin exactly as it
would be deployed, on top of a local mock of Strategy's `mstrmojo` framework, with sample datasets.
In the harness you can:

- add and remove objects in the drop zones (the plugin's own drop rules run)
- change Format-panel settings (rendered from the plugin's `EditorModel`)
- click, Ctrl/⌘-click, right-click and hover the chart
- resize the frame, switch to dark theme, and simulate a PDF export

The mock is a development aid only. Final testing must happen in Workstation or Library — see
the [release checklist](docs/deployment.md#release-checklist).

## Create a new visualization

```bash
scripts/new-viz.sh SvWaterfall "Waterfall Chart"
```

This copies [`templates/SvTemplate`](templates/SvTemplate) (a small working bar chart with every
integration point wired up) to `plugins/SvWaterfall`, renames everything, registers it with the
harness and validates it. Then:

1. Preview it at `http://localhost:8765/dev/?plugin=SvWaterfall`.
2. Define drop zones in `SvWaterfallDropZones.js`, the Format panel in `SvWaterfallEditorModel.js`
   and the drawing in `plot()` in `SvWaterfall.js`.
3. Replace `style/images/icon.svg` (28–30 px) and fill in `summary` / `use-case` / `requirements`
   in `WEB-INF/xml/config/visualizations.xml`.
4. Validate, then package:

```bash
python3 scripts/validate.py
```

```bash
scripts/package.sh SvWaterfall
```

## Deploy

Use a zip from the [latest release](#download), or build your own with `scripts/package.sh <Name>`,
which writes `dist/<Name>.zip`. In Workstation, use **Gallery → Custom → + → Import Visualization**.
For Library or Web, unzip it into the server's `plugins` folder **without renaming the folder**, then
restart the web server. The full guide, including Mobile and troubleshooting, is in
[docs/deployment.md](docs/deployment.md).

To publish a new release after changing a plugin: run `scripts/package.sh`, commit and push, then
create a GitHub release with the next version tag (e.g. `v1.1.0`) and attach the zips from `dist/`.
Use the same file names, so the download links above keep working.

## Repository layout

```
plugins/            deployable visualization plugins (one folder each)
templates/          SvTemplate — the scaffold copied by scripts/new-viz.sh
dev/                preview harness: mock mstrmojo, sample datasets, harness UI, plugins.json
scripts/            new-viz.sh · validate.py · package.sh
docs/               sdk-reference.md · deployment.md · mstr-viz-toolchain.md
dist/               build output from package.sh (git-ignored)
```

## Conventions

- **Names:** plugin folders are PascalCase with the `Sv` prefix (letters and digits only). The
  folder name, class names, `style-name` and icon class must all match. `validate.py` enforces this.
- **No build step, no chart libraries:** plugins are ES5 and draw plain SVG/DOM. This avoids global
  library conflicts between visualizations and works on every Strategy client. If a visualization
  really needs D3 or similar, use the mstr-viz toolchain; see
  [docs/mstr-viz-toolchain.md](docs/mstr-viz-toolchain.md).
- **CSS** is scoped to `.custom-vis-layout.<cssClass>`, because plugin stylesheets load globally.
- **Properties** are strings (`"true"`, `"70"`). Every `propertyName` gets a default in `DEFAULT_PROPS`.
- **Every visualization** supports selection and highlighting, tooltips, a context menu, PDF export
  (`supportNEE` + `renderFinished`), dark theme, empty data, and long labels.

## Reference

[docs/sdk-reference.md](docs/sdk-reference.md) condenses the whole Visualization SDK documentation:
plugin anatomy, XML config, `CustomVisBase`, `DataInterface`, drop zones, properties, selection,
tooltips, context menus, legend and colors, export, incremental fetch, i18n, mobile and API support
by version. It also lists where the official docs contradict themselves and which version this repo
follows, and links to every source page.
