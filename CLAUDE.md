# CLAUDE.md

Custom visualizations for Strategy (MicroStrategy) built with the Visualization SDK. Read
`docs/sdk-reference.md` before touching plugin code; it is the source of truth for the mstrmojo APIs
used here, including the "Doc inconsistencies" table.

## Layout

- `plugins/<Name>/`: deployable plugins (classic hand-written format, ES5, no build).
- `templates/SvTemplate/`: scaffold. Tokens `SvTemplate`, `svtemplate` and `__SV_TITLE__` are
  replaced by `scripts/new-viz.sh`.
- `dev/`: browser preview harness. `mock-mstrmojo.js` mocks the SDK, `harness.js` is the UI,
  `datasets.js` holds sample data, and `plugins.json` lists the plugins shown in the harness.
- `scripts/validate.py`: static checks. Run it after any plugin change.

## Commands

- Preview: `python3 -m http.server 8765`, then open `http://localhost:8765/dev/?plugin=<Name>&dataset=<id>[&theme=dark]`
  (datasets: `sales`, `pipeline`, `kpis`, `single`, `empty`). `.claude/launch.json` defines this as `harness`.
- Validate: `python3 -I scripts/validate.py [Name]`
- New plugin: `scripts/new-viz.sh SvName "Display Name"`
- Package: `scripts/package.sh [Name]`, which writes `dist/<Name>.zip`

## Rules for plugin code

- ES5 only in `plugins/` and `templates/`: no `let`/`const`/arrows/template literals/classes. It
  runs unbundled inside Strategy, including mobile web views. (`dev/` is modern JS.)
- Keep the naming chain intact: folder = `mstrmojo.plugins.<Name>.<Name>` = `scriptClass` =
  styleCatalog `mojoClassName` (`plugins.<Name>.<Name>`) = `style-name` = `.ic-<Name>`.
- Draw with plain SVG/DOM. Don't add third-party libraries to a hand-written plugin; see
  `docs/mstr-viz-toolchain.md` for that route.
- Scope all CSS under `.custom-vis-layout.<cssClass>`. The one exception is the gallery icon rule
  `.ic-<Name> > div > div`, which goes in `global.css` (Library/Workstation) and again in
  `Html5ViPage.css` (classic Web).
- `visualizations.xml` must set `use-react-config="false"` and `use-binary-data="false"` explicitly.
- Plugin files must be ASCII; write other characters as `\uXXXX` escapes.
- Deploy the folder under its exact plugin name. A renamed folder silently fails to load.
- Property values are strings. Declare every property in `DEFAULT_PROPS` and call
  `setDefaultPropertyValues` before `getProperty`. Never call `setProperty` unconditionally in `plot()`.
- Selection: `handleSelection(evt.e, gm)` and `handleContextMenuSelection(evt.e, gm)` (event
  first), and `canPickGraphicModel(selector, isAttr, gm, pickOptions)`.
- `supportNEE: true` requires `raiseEvent({name: "renderFinished", id: this.k})` on every exit path of `plot()`.
- Metric columns arrive in drop-zone order. Read them positionally from the non-empty zones, as in
  `getMetricColumns` in `SvBulletChart.js`.

## Verifying a change

1. `python3 -I scripts/validate.py` reports no errors.
2. In the harness, load the plugin with every dataset (`sales`, `pipeline`, `kpis`, `single`, `empty`) in light
   and dark themes. Click, Ctrl-click, right-click and hover, change each Format-panel control, and
   use "Simulate PDF export". The harness's warnings box and the browser console should stay empty.
3. The harness is a mock. Tell the user that real verification needs Workstation or Library
   (`docs/deployment.md` → Release checklist).

When adding a plugin, add a row to the README "Visualizations" table.
