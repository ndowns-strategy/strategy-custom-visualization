# When to use the Custom Visualization Tool (mstr-viz)

This repo hand-writes plugins in the documented folder structure: ES5, no build step, no
third-party chart libraries. That keeps the edit → preview → deploy loop simple and the output easy
to review. Strategy also ships a Node-based toolchain, the **Custom Visualization Tool**
(`mstr-viz`). Use it when a visualization needs any of these:

| Need | Why mstr-viz |
|---|---|
| A charting library (D3, ECharts, Highcharts, deck.gl, …) | Bundles it as a module, so two visualizations on one dashboard can't clash over a global `d3`. |
| The **React-based Format panel** (2021 Update 3+) | Its config/query/apply files must be built with webpack. |
| ES6+/TypeScript, npm packages, Sass/LESS | Built and transpiled for you. |
| Many properties updated at once | The sample's "unified property" pattern stores every setting in one JSON property, which saves server round trips. |

## Setup (from the docs)

```bash
npm install -g mstr-viz
mstr-viz -h
mstr-viz init SvMyViz                          # React Format panel by default (tool v2.2.3+)
mstr-viz init SvMyViz --use-react-config=false # classic EditorModel Format panel
```

`mstr-viz init` produces (per the official SampleViz):

```
SvMyViz/
├── .env                    # PLUGIN_NAME, PATH_OF_PLUGINS (where builds are written)
├── config.js               # plugin_name, visualization_name, available_for_*, min_number_of_*
├── package.json            # start / build / build:local / build:format / deploy scripts
├── webpack.config.js, .eslintrc.js (Airbnb), husky pre-commit lint
├── src/
│   ├── SvMyViz.js            # ES module: `import * as d3 from "d3"` + mstrmojo.declare(...)
│   ├── SvMyVizDropZones.js
│   ├── SvMyVizEditorModel.js # only for the classic Format panel
│   ├── vis.less|scss         # compiled to global.css + Html5ViPage.css
│   ├── images/icon.svg
│   ├── properties/           # propertiesInfo.js, adjustProperties.js, getDefaultProperties.js
│   └── utils/enhanceHost.js
├── formatPanelConfig/      # React panel: config.js, properties.js, query.js, apply.js, …
└── i18n/MessagesBundle*.properties
```

| Command | Effect |
|---|---|
| `npm run start` | Dev build into `PATH_OF_PLUGINS/<name>`, rebuilt on save (unminified). |
| `npm run build` | Minified build into `PATH_OF_PLUGINS`. |
| `npm run build:local` | Minified build into `./dist`. |
| `mstr-viz migrate <path>` | Convert a hand-written plugin (like the ones here) into an mstr-viz project. |
| `npm update -g mstr-viz` | Upgrade the tool. |

Point `PATH_OF_PLUGINS` at Workstation's plugins folder (see [deployment.md](deployment.md)) for a
live development loop.

## Moving a visualization from this repo to mstr-viz

1. Make sure Node.js is installed and run `npm install -g mstr-viz`.
2. Run `mstr-viz migrate plugins/<Name>`, from a directory outside `plugins/`.
3. Replace inline SVG drawing with library calls if needed; `npm install --save-prod <lib>` and `import` it.
4. Keep the build **output** (the deployable plugin folder) in `plugins/<Name>` so
   `scripts/validate.py`, the harness and `scripts/package.sh` keep working. Keep the mstr-viz
   source in a sibling folder, e.g. `src-mstr-viz/<Name>/`.

The harness's Format panel only renders classic `CustomVisEditorModel` widgets. A React-panel
visualization still renders and responds to clicks in the harness, but its Format panel has to be
tested in Workstation or Library.
