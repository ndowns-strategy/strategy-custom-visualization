# Strategy Visualization SDK — working reference

A condensed reference for building custom visualizations, distilled from Strategy's
[Visualization SDK documentation](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/Introduction_to_the_Visualization_SDK.htm)
(crawled 2026-10-08; all 69 pages are listed under [Sources](#sources)) and checked against the
official sample plugins (MstrVisTemplate, D3BubbleChart, CircularTreeMap and SampleViz).
When this file and the official docs disagree, the docs win — but see
[Doc inconsistencies](#doc-inconsistencies-and-how-this-repo-resolves-them) first.

> Strategy was formerly MicroStrategy. Class names, the `mstrmojo` framework, folder names and
> most docs still say "MicroStrategy"; "dossier" is the older name for "dashboard".

## Contents

1. [How custom visualizations work](#1-how-custom-visualizations-work)
2. [Plugin anatomy](#2-plugin-anatomy)
3. [visualizations.xml](#3-visualizationsxml)
4. [styleCatalog.xml](#4-stylecatalogxml)
5. [The visualization class (CustomVisBase)](#5-the-visualization-class-customvisbase)
6. [Reading data (DataInterface)](#6-reading-data-datainterface)
7. [Drop zones (CustomVisDropZones)](#7-drop-zones-customvisdropzones)
8. [Format panel properties (CustomVisEditorModel)](#8-format-panel-properties-customviseditormodel)
9. [Graphic models, selection and highlighting](#9-graphic-models-selection-and-highlighting)
10. [Use as filter / Selector API](#10-use-as-filter--selector-api)
11. [Tooltips](#11-tooltips)
12. [Context menus](#12-context-menus)
13. [Color by, legend and thresholds](#13-color-by-legend-and-thresholds)
14. [Export to PDF](#14-export-to-pdf)
15. [Contextual linking](#15-contextual-linking)
16. [Incremental fetch (large data)](#16-incremental-fetch-large-data)
17. [External libraries](#17-external-libraries)
18. [Gallery icon, placement and tooltip](#18-gallery-icon-placement-and-tooltip)
19. [Internationalization](#19-internationalization)
20. [Mobile](#20-mobile)
21. [Best practices](#21-best-practices)
22. [API support by version](#22-api-support-by-version)
23. [Doc inconsistencies](#doc-inconsistencies-and-how-this-repo-resolves-them)
24. [Sources](#sources)

---

## 1. How custom visualizations work

- **Server side:** the Intelligence Server supplies the data and Strategy Web/Library registers
  the visualization from XML in the plugin. You don't write server code.
- **Client side:** your JavaScript class extends `mstrmojo.CustomVisBase` (Strategy's "mojo"
  framework) and draws into `this.domNode` in `plot()`.
- A visualization is a **plugin folder** copied into the `plugins/` directory of Library / Web /
  Workstation (or zip-imported into Workstation). Restart the web server after adding a plugin.
- Two ways to author a plugin:
  - **By hand** (what this repo does): ES5 files in the documented folder structure, no build.
  - **Custom Visualization Tool** (`npm install -g mstr-viz`): Node/webpack scaffold with ES6+,
    Sass/LESS, ESLint, live rebuild, and the React-based Format panel. See
    [mstr-viz-toolchain.md](mstr-viz-toolchain.md).
- Every custom visualization automatically gets the Editor/Filter/Format panels, the dashboard's
  visualization menu (Duplicate, Export, Show Data, …), title/container formatting and undo/redo.

## 2. Plugin anatomy

```
<PluginName>/
├── javascript/mojo/js/source/
│   ├── <PluginName>.js               # visualization class (extends CustomVisBase)        — required
│   ├── <PluginName>DropZones.js      # Editor-panel drop zones (CustomVisDropZones)       — optional
│   ├── <PluginName>EditorModel.js    # Format-panel controls (CustomVisEditorModel)       — optional
│   └── <library>.js                  # local copies of third-party libraries              — optional
├── style/
│   ├── global.css                    # visualization CSS (scope to .custom-vis-layout.<cssClass>) + gallery icon rule
│   ├── Html5ViPage.css               # copy of the gallery icon rule for classic Web
│   └── images/icon.svg|png           # 28–30 px gallery icon
└── WEB-INF/
    ├── xml/styleCatalog.xml          # style that maps to the JS class                    — required
    ├── xml/config/visualizations.xml # registers the visualization in the gallery         — required
    └── classes/resources/MessagesBundle*.properties   # i18n strings                      — optional
```

Naming chain — these must agree or the visualization silently doesn't load:

| Where | Value (plugin `SvBulletChart`) |
|---|---|
| Folder | `SvBulletChart` |
| JS global | `mstrmojo.plugins.SvBulletChart.SvBulletChart = mstrmojo.declare(...)` |
| `scriptClass` | `"mstrmojo.plugins.SvBulletChart.SvBulletChart"` |
| styleCatalog `mojoClassName` | `plugins.SvBulletChart.SvBulletChart` |
| styleCatalog `<Style name>` | `SvBulletChart` = visualizations.xml `style-name` |
| visualizations.xml `drop-zones` / `editor-model` | `plugins.SvBulletChart.SvBulletChartDropZones` / `…EditorModel` |
| Gallery icon CSS | `.ic-SvBulletChart` (uses `style-name`) |

`scripts/validate.py` checks this whole chain. The chain includes the **folder name on the server**:
`mojoClassName` `plugins.SvBulletChart.SvBulletChart` makes Strategy load
`plugins/SvBulletChart/javascript/mojo/js/source/SvBulletChart.js`. If the folder is renamed during
deployment, the code is never found and the visualization doesn't appear, with no error.

## 3. visualizations.xml

```xml
<visualizations>
  <visualization-list name="ajax" show-in-web="true" view-mode="51">
    <visualization id="SvBulletChart" desc="Bullet Chart" style-name="SvBulletChart"
                   is-mojo="true" scope="19" widget-type="7"
                   attribute-minimum="1" metric-minimum="1"
                   drop-zones="plugins.SvBulletChart.SvBulletChartDropZones"
                   editor-model="plugins.SvBulletChart.SvBulletChartEditorModel"
                   use-react-config="false" use-binary-data="false"
                   categories="KPI,Custom"
                   summary="…" use-case="Example: …" requirements="Uses 1+ ##attributes### and 1 #metric###"/>
  </visualization-list>
</visualizations>
```

| Attribute | Meaning |
|---|---|
| `id` | Unique id; use the plugin name. |
| `desc` | Name shown in the gallery / document widget list. |
| `style-name` | `<Style name>` in styleCatalog.xml. Also drives the `ic-<style-name>` icon class. |
| `is-mojo` | `"true"` for HTML5/mojo visualizations (omit only in mobile document lists — see §20). |
| `scope` | Bit flags: `2` report grids in documents, `16` dashboards; samples use `18` or `19`. |
| `widget-type` | `"7"` when the visualization defines custom drop zones. |
| `attribute-minimum`, `metric-minimum` | Framework shows `errorMessage`/`errorDetails` instead of calling `plot()` when unmet. |
| `drop-zones`, `editor-model` | `plugins.<Plugin>.<Class>` for the optional classes. |
| `categories` | Gallery sections, comma-separated (default `Custom`). 2021 Update 5+. |
| `summary`, `use-case`, `requirements` | Gallery hover tooltip — **all three or none**; overrides the min-count text. In `requirements`, `##…###` marks attribute text and `#…###` marks metric text (rendered with icons). |
| `desc-id`, `summary-id`, `use-case-id`, `requirements-id` | i18n ids (`Prefix.N`) that override the literal strings. |
| `use-react-config` | `"true"` = React Format panel (needs the mstr-viz-built `formatPanelConfig/` / `formatPanelBundles/`); `"false"` = classic `editor-model`. **Always set it explicitly**: the docs disagree on the default. |
| `use-binary-data` | `"false"` for JSON grid data (what `DataInterface` here reads). The current tool always writes it. |

The Custom Visualization Tool (mstr-viz 2.15.x) generates this file from `config.js` and writes
`desc`, `drop-zones`, `editor-model`, `is-mojo`, `scope`, `style-name`, `widget-type`, the gallery
tooltip and i18n ids, `categories`, `use-react-config` and `use-binary-data`. It no longer writes
`id`, `attribute-minimum` or `metric-minimum`. Its build also adds a `_custom_vis_` file and a
`version.json` to the plugin. Those are only for the tool: `_custom_vis_` marks a folder the tool
created so it may overwrite it. Strategy doesn't need either file.

## 4. styleCatalog.xml

```xml
<!DOCTYPE StyleCatalog SYSTEM "styleCatalog.dtd">
<StyleCatalog version="2.0"><Styles>
  <Style name="SvBulletChart" description="(not shown to users)" transform="ReportAjaxMojoVisualizationTransform">
    <ActualParameters>
      <ActualParameter name="documentStyle" type="1" value="RWGridJsonStyle"/>
      <ActualParameter name="reportXMLStyle" type="1" value="VisualizationServerJsonDataStyle"/>
      <ActualParameter name="mojoClassName" type="1" value="plugins.SvBulletChart.SvBulletChart"/>
    </ActualParameters>
    <Layouts><Layout layout_source="AppLayoutSourceFile" order="1">
      <![CDATA[/WEB-INF/xml/layouts/MojoVisualizationLayout.xml]]>
    </Layout></Layouts>
  </Style>
</Styles></StyleCatalog>
```

Use `VisualizationServerJsonDataStyle` (older templates say `VisualizationDataStyle`); metric
thresholds in documents need it.

## 5. The visualization class (CustomVisBase)

```js
(function () {
    if (!mstrmojo.plugins.SvFoo) { mstrmojo.plugins.SvFoo = {}; }
    mstrmojo.requiresCls("mstrmojo.CustomVisBase", "mstrmojo.models.template.DataInterface",
                         "mstrmojo.customviz.GraphicModel", "mstrmojo.customviz.CustomVisEnums");

    mstrmojo.plugins.SvFoo.SvFoo = mstrmojo.declare(mstrmojo.CustomVisBase, null /* mixins */, {
        scriptClass: "mstrmojo.plugins.SvFoo.SvFoo",
        cssClass: "svfoo",                   // added to the container next to .custom-vis-layout
        errorMessage: "…", errorDetails: "…",
        externalLibraries: [],               // see §17
        reuseDOMNode: false,                 // true = keep DOM across resize/data change
        useRichTooltip: true,
        supportNEE: true,                    // PDF export (§14)
        init: function (props) { this._super(props); /* setDefaultPropertyValues here is fine */ },
        plot: function () { /* draw into this.domNode */ }
    });
}());
```

Members you use most:

| Member | Notes |
|---|---|
| `plot()` | Called to render — on load, data change, resize and (by default) property change. |
| `this.domNode` | Container element. With `enableLegend`, draw into `this.canvasContainer` instead. |
| `this.width`, `this.height` | Size; may be strings — use `parseInt(this.width, 10)`. |
| `this.dataInterface` | §6. |
| `this.zonesModel` | Drop-zone model (§7); `undefined` in documents. |
| `this.additionalAttrIds` | Ids of attributes in tooltip (`isAdditionalInfo`) zones. |
| `this.k` | Widget key — used in `raiseEvent({name: "renderFinished", id: this.k})`. |
| `getProperty(name)`, `setProperty(name, value, config)`, `getProperties()` | §8. |
| `setDefaultPropertyValues(obj)`, `getDefaultProperties()` | Defaults used by `getProperty()` and the Format panel. |
| `refresh()` | Re-render (regenerates the DOM node). |
| `createGraphicModels()` / `getGraphicModels()` | §9. |
| `handleSelection`, `handleContextMenuSelection`, `graphicNeedsHighlight`, `updateHighlight`, `getGraphicModelsBySelector`, `canPickGraphicModel`, `getSelectorHash` | §9. |
| `applySelection`, `clearSelections`, `endSelections`, `getSelections`, `addUseAsFilterMenuItem` | §10. |
| `showTooltip(gm, {x, y}, fixed)`, `hideTooltip(delayed = true)` | §11. |
| `getContextMenuConfig(gm)` | §12. |
| `getColorBy(colorInfo)`, `addThresholdMenuItem()` | §13. |
| `raiseEvent({name: "renderFinished", id: this.k})` | §14. |
| `goToDocument()` | §15. |
| `onclick(evt)`, `oncontextmenu(evt)`, `onmousemove(evt)` | Mojo event hooks; `evt.e` is the DOM event, `evt.getTarget()` the target node. |
| `mstrApp.getThemeClassName()` | Contains `"dark"` under a dark theme. |
| `mstrApp.isExporting` | True while rendering for PDF export. |

## 6. Reading data (DataInterface)

The grid: row attributes ("row titles"/"row headers") × metric columns ("column headers").
`this.dataInterface` methods:

| Method | Returns |
|---|---|
| `getRawData(format, params)` | Pre-shaped data; see below. **Use this.** |
| `getTotalRows()`, `getTotalCols()`, `getColumnHeaderCount()`, `isEmpty()` | Counts. |
| `getRowTitles().getTitle(i).getName()` | Attribute name. |
| `getColHeaders(0).getHeader(i).getName()` / `.getObjectId()` | Metric *i* name / id. |
| `getRowHeaders(row).getHeader(i).getName()` | Element name of attribute *i* in a row. |
| `getMetricValue(row, col).getValue()` / `.getRawValue()` | Formatted / raw value. |

`ENUM_RAW_DATA_FORMAT` (`mstrmojo.models.template.DataInterface.ENUM_RAW_DATA_FORMAT`):

- **`ROWS_ADV`** — one object per grid row (use this for selection):
  ```js
  {headers: [{name, tname, attributeSelector}], values: [{v: "$1,234", rv: 1234.5, name, threshold: {fillColor}}],
   metricSelector: {...}, idValueMapping: {...}, additional: [...]}
  ```
- **`TREE`** — nested `{name, children: [...]}` with leaf `value` / `formattedValue` (first metric); D3-friendly.
- `ROWS` — simple rows; does **not** support selection.

`params`: `hasSelection` (add `attributeSelector`/`metricSelector`; needed for selection,
filtering, context menus), `hasTitleName` (`tname`), `hasThreshold` (threshold color per value),
`needDecode` (decode HTML in names; slower), `colorByInfo` (§13), `additionalAttrIds` (aggregate
tooltip-zone attributes into `additional` rows), TREE-only: `descKey`, `childrenKey`, `nestedLevel`.

**Column order with custom drop zones:** objects are placed into the standard grid in drop-zone
order, then order within a zone; an object in several zones counts at its first appearance. So the
metric in your first metric zone is column 0, and so on. Read columns positionally from the zones
that are non-empty (see `getMetricColumns` in SvBulletChart.js), and stop the same metric being
dropped in two zones whose positions you depend on.

## 7. Drop zones (CustomVisDropZones)

```js
mstrmojo.plugins.SvFoo.SvFooDropZones = mstrmojo.declare(mstrmojo.vi.models.CustomVisDropZones, null, {
    scriptClass: "mstrmojo.plugins.SvFoo.SvFooDropZones",
    getCustomDropZones: function () {
        var T = mstrmojo.vi.models.CustomVisDropZones.ENUM_ALLOW_DROP_TYPE;
        return [
            {name: "Category", title: mstrmojo.desc(13828, "Drag attributes here"), allowObjectType: T.ATTRIBUTE},
            {name: "Value", title: mstrmojo.desc(13827, "Drag metrics here"), maxCapacity: 1, allowObjectType: T.METRIC},
            {name: "Tooltip", isAdditionalInfo: true, title: mstrmojo.desc(13258, "Drag objects here"), allowObjectType: T.ATTRIBUTE_AND_METRIC}
        ];
    }
});
```

Zone fields: `name` (unique id), `title` (tooltip), `maxCapacity`, `allowObjectType`
(`ATTRIBUTE` | `METRIC` | `ATTRIBUTE_AND_METRIC`), `disabled` (e.g.
`this.getDropZoneObjectsByIndex(0).length === 0`), `isAdditionalInfo` (tooltip zone), `isColorBy`,
`isSizeBy`, `useAbsolute`.

Overridable hooks:

| Hook | Purpose |
|---|---|
| `shouldAllowObjectsInDropZone(zone, dragObjects, idx, edge, context)` | Return `{allowedItems: [...]}`. |
| `getActionsForObjectsDropped(zone, objects, idx, replaceObject, extras)` | Return actions (e.g. remove from another zone). |
| `getActionsForObjectsRemoved(zone, objects)` | Return actions. |
| `getActionsForDoubleClick(obj)` | Where a double-clicked dataset object goes. |
| `getDropZoneContextMenuItems(cfg, zone, object, el)` | Only the threshold item is supported: `cfg.addSeparator(); this.buildThresholdMenuOptions(cfg, {item: object}, true);` |
| `customDropZonesTransition(attributes, metrics)` | Map objects when switching *from* another visualization; call `transitionObjectsToZone(name, objects)`. Each object has `fromZone`. |
| `getDefaultTooltipOrder()` | `[[zone, zone + CUSTOM_DZ_SUFFIX.ATTRIBUTE], [...]]` — groups separated by lines. |

Helpers: `getDropZoneName(zone)`, `getDropZoneObjectsByIndex(i)`, `getDropZoneObjectsByName(name)`
(don't call this inside `getCustomDropZones` — it recurses), `isObjectInZone(obj, name)`,
`isMetric(obj)`, `isAttribute(obj)`, `isZoneEmpty(name)`, `isObjectAllowedForDropZone(obj, zone)`,
`getAddDropZoneObjectsActions(actions, zone, objects, idx, extras)`,
`getRemoveDropZoneObjectsActions(actions, zone, objects)`,
`getReplaceDropZoneObjectsActions(actions, zone, newObject, idx)`, `getAdditionalAttrIds()`,
`getColorByAttributes()`. From the visualization: `this.zonesModel.getDropZoneObjectsByName("Color")`.

Custom drop zones are a dashboard feature; documents use the default grid.

## 8. Format panel properties (CustomVisEditorModel)

Properties are saved with the visualization as **strings** (or one level of string-valued
objects — `"true"`, not `true`). Visible properties get a Format-panel control; hidden ones (e.g. a
zoom level) are just `setProperty` calls.

```js
var $WT = mstrmojo.vi.models.editors.CustomVisEditorModel.WIDGET_TYPE;
mstrmojo.plugins.SvFoo.SvFooEditorModel = mstrmojo.declare(mstrmojo.vi.models.editors.CustomVisEditorModel, null, {
    scriptClass: "mstrmojo.plugins.SvFoo.SvFooEditorModel",
    getCustomProperty: function () {
        var host = this.getHost();           // the visualization instance
        return [{name: "Section title", value: [
            {style: $WT.EDITORGROUP, items: [
                {style: $WT.CHECKBOXANDLABEL, propertyName: "showLegend", labelText: "Show legend"},
                {style: $WT.TWOCOLUMN, items: [
                    {style: $WT.LABEL, width: "40%", labelText: "Name"},
                    {style: $WT.TEXTBOX, width: "60%", propertyName: "vizName",
                     disabled: host.getProperty("showLegend") === "false"}
                ]}
            ]}
        ]}];
    }
});
```

Widget types: `EDITORGROUP` (container), `TWOCOLUMN` (container; default widths 30%/70%),
`PULLDOWN` (`items: [{name, value}]`), `BUTTONBAR` and `CHECKLIST` (`items: [{labelText,
propertyName}]`, `multiSelect`, CHECKLIST `orientation: "v"|"h"`), `TEXTBOX`, `LABEL`,
`CHECKBOXANDLABEL`, `COMBOBOX` (`items: [{name}]`), `STEPPER` (integers; `min`, `max`),
`CHARACTERGROUP` (fontFamily/fontStyle/fontSize/fontColor), `FILLGROUP` (fillColor/fillAlpha),
`LINEGROUP` (lineColor/lineStyle), `BUTTON` (`labelText`, `callback`), `COLORBYGROUP` (§13).
Group controls can disable children: `items: [{childName: "fillAlpha", disabled: true}]`.

`propertyName` must be unique. Each control may carry `config` (same as `setProperty`'s):

| config | Effect |
|---|---|
| *(none)* | After saving, `plot()` runs again (DOM node kept). |
| `callback` | Runs instead of `plot()` (DOM node regenerated). |
| `suppressData` | `true` (default for controls): no server round trip / loading spinner. |
| `onPropertyChange(name, value)` | Return other properties to change at the same time. |
| `requestDefinition` | Also re-request the definition. |
| `clientUndoRedoCallback` | Called after undo/redo instead of a partial update. |

`setProperty` round-trips to the server — never call it in a loop or unconditionally in `plot()`.
Set defaults with `setDefaultPropertyValues()` before reading (in `init` or at the top of `plot`).
`mstrmojo.CustomVisUtility.isInPauseMode()` is handy for `disabled` (no data while paused).

The newer **React Format panel** (2021 Update 3+) needs the mstr-viz build — see
[mstr-viz-toolchain.md](mstr-viz-toolchain.md).

## 9. Graphic models, selection and highlighting

A `GraphicModel` represents one drawn mark and carries the selector that ties it to grid rows.
It powers selection persistence, filtering/highlighting other visualizations, context menus and
tooltips.

```js
var GraphicModel = mstrmojo.customviz.GraphicModel;
createGraphicModels: function () {
    var rows = this.dataInterface.getRawData($DI.ENUM_RAW_DATA_FORMAT.ROWS_ADV,
        {hasSelection: true, hasTitleName: true, hasThreshold: true, additionalAttrIds: this.additionalAttrIds});
    return {children: rows.map(function (row) {
        var gm = new GraphicModel();
        gm.setId(this.getSelectorHash(row.metricSelector));
        gm.setSelector(row.metricSelector, false);          // false = metric (data point) selector
        gm.setGroupOptions(row.headers);                    // Group / Calculation menu items
        gm.setDrillOptions(row.headers[0].attributeSelector, [{dropZoneIndex: 0, keepParent: false}]);
        gm.idValueMapping = row.idValueMapping;             // tooltip content
        if (row.additional) { gm.additional = row.additional; }
        gm.setCustomProperties({label: row.headers[0].name, value: row.values[0].rv});
        return gm;
    }, this)};
}
```

- `getGraphicModels()` returns what `createGraphicModels()` built — call it in `plot()` and bind
  each model to its mark. The structure (array, `{children}`, tree) is yours.
- `setCustomProperties(obj)` (incremental); read back with `getCustomProperty(key)`.
  `setGraphicCenter(x, y)` keeps the mobile context menu positioned after rotation.
- **Select:** in `onclick`, call `this.handleSelection(evt.e, graphicModel)` (Ctrl/⌘ = multi-select;
  pass no model to clear).
- **Context-menu select:** in `oncontextmenu`, `this.handleContextMenuSelection(evt.e, graphicModel)`.
- **Draw highlight:** implement `updateHighlight()`; inside, `this.graphicNeedsHighlight(gm, false)`
  for selection and `(gm, true)` for context-menu selection.
- **Be a target:** implement `getGraphicModelsBySelector(selector, isAttrSelector)` — loop your
  models and return those where `this.canPickGraphicModel(selector, isAttrSelector, gm, pickOptions)`.
  `pickOptions = {attribute, metric, criteria}` with `mstrmojo.customviz.PICKED_TYPE.ATTR|METRIC|BOTH`
  and `PICKED_CRITERIA.SUBSECTION|INTERSECTION` (how source headers / data points map to your marks).

## 10. Use as filter / Selector API

- Call `this.addUseAsFilterMenuItem()` in `plot()` to show **Use as Filter**.
- Selections made through `handleSelection` drive filtering of target visualizations.
- Lower-level: `this.applySelection(selectorOrArray)` with `attributeSelector`/`metricSelector`
  objects from `getRawData(..., {hasSelection: true})`; `clearSelections()` + `endSelections()` to
  clear targets; `getSelections()`.
- Old iOS documents used `window.webkit.messageHandlers.selectionDataJSONString.postMessage(...)`
  instead of `applySelection` (see the Selector API page).

## 11. Tooltips

1. Mark a zone `isAdditionalInfo: true` (it may hold attributes and metrics).
2. Pass `additionalAttrIds: this.additionalAttrIds` to `getRawData`.
3. Bind `gm.idValueMapping = row.idValueMapping` and `gm.additional = row.additional`.
4. Optionally override `getDefaultTooltipOrder()` in the drop-zone class.
5. In `onmousemove`: `this.showTooltip(gm, {x: e.clientX, y: e.clientY})` or `this.hideTooltip(false)`.
   Third argument `true` pins the tooltip (needed for links inside it).

## 12. Context menus

```js
getContextMenuConfig: function (graphicModel) {
    var D = mstrmojo.DEFAULT_CONTEXT_MENU, C = mstrmojo.CUSTOM_CONTEXT_MENU;
    return {
        common: [{type: D.KEEP_ONLY}, {type: D.EXCLUDE}, {type: D.DRILL}, {type: D.GROUP},
                 {type: D.CALCULATION}, {type: D.SHOW_DATA}, {type: D.GO_TO_TARGETS},
                 {type: D.CHANGE_VISUALIZATION, isShown: !graphicModel}],   // also D.SHOW_LEGEND
        custom: [{type: C.TOGGLE, name: "Show labels", propertyName: "showLabels", showFormatPanel: false},
                 {type: C.SEPARATOR},
                 {type: C.SUBMENU, name: "Sort", subMenuConfig: [
                     {type: C.SINGLE_SELECT_LIST, propertyName: "sortOrder", items: [{name: "A–Z", value: "az"}]}]}]
    };
}
```

Custom item types: `NORMAL` (`name`, `onClick`, `isDisabled`), `TOGGLE` (`currentValue` +
`onClick(newValue)`, or bound via `propertyName`), `SEPARATOR`, `SUBMENU` (`subMenuConfig`),
`SINGLE_SELECT_LIST` (`items`, `currentValue`/`onClick` or `propertyName`), `MULTI_SELECT_LIST`
(must bind to a two-level property). All accept `isShown`. Property-bound items accept
`showFormatPanel` (default true) and `config`. Common items need `setSelector` (all),
`setGroupOptions` (Group/Calculation) and `setDrillOptions` (Drill) on the model. Menus don't show
in documents in Express mode. On mobile only Keep Only, Exclude, Drill and Show Data are supported.

## 13. Color by, legend and thresholds

- **Color by attribute** (shared dashboard palette): mark one zone `isColorBy: true`; request
  `getRawData(fmt, {colorByInfo: this.zonesModel && this.zonesModel.getColorByAttributes()})`; color
  each mark with `this.getColorBy(item.colorInfo)`. Add `{style: $WT.COLORBYGROUP}` to the Format
  panel to let users edit element colors.
- **Legend:** `enableLegend: true`; mark `isColorBy` / `isSizeBy` zones (`isSizeBy` metric zone
  `maxCapacity: 1`, optional `useAbsolute`); draw into `this.canvasContainer` sized from
  `this.getCanvasContainerSize()`. Defaults via `setDefaultPropertyValues` under
  `CustomVisEnums.LEGEND_PROPERTY_SET` with `ENUM_LEGEND_PROPS.*` keys; override
  `getDefaultThresholdColorsAndBands()` (returns `{colors: [...n], bands: [...n-1 in (0,1)]}`) for
  color-by-metric. Add `DEFAULT_CONTEXT_MENU.SHOW_LEGEND` to reopen a closed legend.
- **Thresholds:** `this.addThresholdMenuItem()` in `plot()` (or the drop-zone context-menu item in
  §7); request `hasThreshold: true`; use `value.threshold.fillColor`. Only basic thresholds apply.

## 14. Export to PDF

- `supportNEE: true` on the class.
- Raise `this.raiseEvent({name: "renderFinished", id: this.k})` once rendering **and any
  animation** is finished — at the end of `plot()`, or later if drawing is async. Without it the
  export waits/errs.
- Skip animations when `window.mstrApp && mstrApp.isExporting`.
- `supportPagination: true` lets content flow across pages; override `getPaginationContainer`,
  `canScrollDown`, `canScrollRight`, `scrollToNext…Page`, `pre/postExport`, `pre/postPrint` as needed.

## 15. Contextual linking

Requires selection support (§9). Entry points: **Go to Targets** in the context menu; a pinned
tooltip (`showTooltip(gm, pos, true)` on click) that shows the link; or call `this.goToDocument()`
on click to follow the link using the current selection.

## 16. Incremental fetch (large data)

Strategy ONE (December 2024)+. Set `supportIncrementalFetch: true`; the editor model must extend
`CustomVisEditorModel`. APIs on `CustomVisBase`: `fetchRows({start, count}, memo)` (start is
1-based; count `0`/`-1` = all), `hasNextRowSet()`, `fetchNextRowSet()` (window size from More
Options), and override `onDataFetched(data, memo)` to merge the new slice (`data` has the same shape
as `gridData`). Read-only state: `incFetchStatus` (0 idle, 1 fetching, 2 done, 3 failed) and
`incFetchError`, with `onincFetchStatusChange` / `onincFetchErrorChange` handlers.

## 17. External libraries

```js
externalLibraries: [
    {url: (mstrApp.getPluginsRoot && mstrApp.getPluginsRoot() || "../plugins/") + "SvFoo/javascript/mojo/js/source/d3.v7.min.js",
     forceReload: false}
]
```

- Prefer a **local, minified copy inside the plugin** at that path — it works on Web, Library,
  Workstation and Mobile, and avoids CSP/offline problems with CDNs.
- `forceReload: false` stops re-loading on resize/data change (pre-2020 re-load bugs, e.g. a null
  `d3.event`).
- **No comments inside the `externalLibraries` array** — it breaks parsing on Mobile.
- Libraries load into the global scope: two visualizations on one dashboard that need different
  D3 versions will clash. `noConflictLibraries` (10.5–2019) is deprecated; the fix is the
  mstr-viz toolchain, which bundles dependencies as modules.
- This repo's plugins draw plain SVG with no library to avoid all of the above.

## 18. Gallery icon, placement and tooltip

- Gallery icon: `.ic-<style-name> > div > div { background: url("images/icon.svg") … }` with a
  28–30 px icon in `style/images/`. Put it in **`style/global.css`**: that's where the current Custom
  Visualization Tool puts it, and its build replaces `Html5ViPage.css` with an empty placeholder.
  The older docs only describe `Html5ViPage.css` (prefixed with `.mstrmojo-VIGallery .mstrmojo-VIGalleryList .item`),
  so this repo keeps the same rule in both files. Add a `.mojo-theme-dark …` variant if the icon needs it.
- Document Insert-menu icon: `#RwMenuModel_WEB-INFxmllayoutsblocksInsertDHTMLWidgetMenuLayoutxml #mnuInsertWg<Name>`
  (and the `RwMenuModelEditor_…` variant) in `global.css`.
- `categories`, `summary`, `use-case`, `requirements` — §3.

## 19. Internationalization

`WEB-INF/classes/resources/MessagesBundle[_lang[_COUNTRY]].properties` with
`<Prefix>.<id>=<text>` (lookup falls back `en_GB` → `en` → default file). Load early with
`mstrmojo.requiresDescsWPrefix("SvFoo.", 1, 2, 3)` (top of the main JS, before `plot`), then use
`mstrmojo.descP("SvFoo.", "1", "Fallback text")`. Built-in strings: `mstrmojo.desc(13828, "Drag
attributes here")`. Restart the web server after adding bundles. Supported languages include zh-CN,
zh-TW, da, de, nl, en-GB, en-US, fr (BE/FR/CH), de-CH, it (IT/CH), ja, ko, pl, pt-BR, ru, es, sv.

## 20. Mobile

- Dashboards on iPad / Android tablet: copy the plugin to the **Mobile server's** `plugins` folder.
- Documents on phones/tablets: add an extra `<visualization-list>` per device —
  `name="iphone" view-mode="70"`, `ipad` `71`, `android` `72`, `androidTablet` `73` — with
  `show-in-web="false"` and **without** `is-mojo`, then tick the device in the document's widget editor.
- Mobile only bundles a subset of mojo (CustomVisBase, DataInterface, CustomVisDropZones,
  CustomVisEditorModel, array, dom, color, …) and a subset of JSON keys; check the API table (§22).

## 21. Best practices

- Scope every CSS rule: `.custom-vis-layout.<cssClass> …` — plugin CSS loads globally.
- No spaces or symbols in plugin file/folder names, and deploy the folder under its exact plugin name.
- Keep plugin files ASCII; write other characters as `\uXXXX` escapes. Servers don't always serve
  plugin files as UTF-8.
- Minify libraries for production; keep them inside the plugin.
- Clear and redraw in `plot()` (or reuse nodes deliberately with `reuseDOMNode: true`).
- Don't call `setProperty` from `plot()` unless the value changed — each call is a server round trip.
- Handle empty data, a single row, negative values, long labels, and dark theme.
- Test in every target client (Library, Workstation, Web, Mobile) — capabilities differ (§22).
- Before upgrading Strategy, back up the `plugins` folder; copy it back, restart, clear browser caches, retest.

## 22. API support by version

| API | Dashboards (Workstation/Web) | Dashboards (iOS / Android) | Documents |
|---|---|---|---|
| Data Interface | 10.1 | 10.1 / 10.4 | Web 10.1, iOS 10.1, Android 10.4 |
| JSON data format | 10.2 | 10.2 | Web 10.2 |
| Selector (Use as filter) | 10.2 | 10.4 (iOS) | partial |
| Custom drop zones | 10.2 | n/a | partial |
| Custom properties | 10.3 | 10.5 / 10.8 | partial |
| Metric thresholds | 10.3 | 10.4 (iOS) | partial |
| Color palette | 10.4 | 10.5 (iOS) | partial |
| Drop zones: persist objects | 10.4 | n/a | partial |
| Export to PDF | 10.6 | n/a | — |
| Legend, custom selection & highlight, custom context menu, custom tooltip, contextual linking | 2020 | 2020 | partial (Web) |
| React Format panel | 2021 Update 3 | | |
| Gallery categories | 2021 Update 5 | | |
| Incremental fetch | Strategy ONE (Dec 2024) | | |

## Doc inconsistencies (and how this repo resolves them)

| Topic | What the docs say | What we do |
|---|---|---|
| `handleSelection` signature | Selection page: `handleSelection(graphicModel, isMultiSelect)`; Contextual-linking page and the official CircularTreeMap sample: `handleSelection(event, graphicModel)` | Event first: `handleSelection(evt.e, gm)` — matches the shipped 2020+ sample. |
| `handleContextMenuSelection` | Selection page: `(graphicModel)`; Context-menu page + CircularTreeMap: `(event, graphicModel)` | Event first. |
| `canPickGraphicModel` argument order | Selection page code: `(selector, isAttr, pickOptions, gm)`; its prose and CircularTreeMap: `(selector, isAttr, gm, pickOptions)` | `(selector, isAttrSelector, gm, pickOptions)`. |
| `reportXMLStyle` | Older MstrVisTemplate: `VisualizationDataStyle` | `VisualizationServerJsonDataStyle` (current docs + samples). |
| Icon class | Some pages show `ic-<Name>Style` | `ic-<style-name>`; we keep `style-name` = plugin name so they match. |
| `addFilterMenuItem` vs `addUseAsFilterMenuItem` | Prose says the former, code the latter | `addUseAsFilterMenuItem()` (used by samples). |
| `use-react-config` default | Gallery-placement page: default `true`; Build & deploy page: React panel disabled by default | Always set it explicitly (`"false"` for hand-written plugins). |
| Gallery icon file | Icon pages: `Html5ViPage.css`; current mstr-viz build: `global.css` (Html5ViPage.css is an empty placeholder) | The same rule in both files. |

If Strategy behaves differently from this table in your version, fix it here and in the template.

## Sources

Crawled from the SDK's Current docs on 2026-10-08:

- [Introduction to the Visualization SDK](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/Introduction_to_the_Visualization_SDK.htm) ·
  [What's New](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/WhatsNew.htm) ·
  [Download a local copy of the docs](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/DownloadableVisSDKZipFile.htm)
- **Custom Visualization Tool:**
  [Introduction](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/intro_custom_viz_tool.htm) ·
  [Install](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/install_custom_viz_tool.htm) ·
  [Initialize](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/initialize_custom_viz.htm) ·
  [Develop](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/develop_custom_viz_tool.htm) ·
  [Configure](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/config_custom_viz.htm) ·
  [Build for production](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/build_viz.htm) ·
  [Add a custom icon](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/add_icon.htm) ·
  [Migrate](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/migrate_viz.htm) ·
  [Upgrade the tool](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/upgrade_custom_viz_tool.htm) ·
  [Modify ESLint rules](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/modify_eslint_rules.htm) ·
  [Resolve library conflicts](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/resolve_conflicts.htm)
- **Plugins:**
  [Create a plug-in](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/Creating_a_plugin.htm) ·
  [Plug-in structure](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/Understanding_the_plugin_structure.htm) ·
  [Workflow](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/Understanding_the_workflow.htm) ·
  [Configuration files](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/Configuration_files.htm) ·
  [visualizations.xml](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/Visualizations_configuration_file.htm) ·
  [styleCatalog.xml](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/Style_Catalog_configuration_file.htm) ·
  [Learn from sample code](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/Learning_from_sample_code.htm) ·
  [D3 Simple Bar Chart](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/SampleCode_D3SimpleBarChart.htm) ·
  [Google Chart](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/SampleCode_GoogleChart.htm) ·
  [Simple Select Box](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/SampleCode_SimpleSelectBox.htm) ·
  [Sample visualizations](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/Sample_visualizations.htm)
- **APIs:**
  [API overview](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/API_Reference.htm) ·
  [Supported APIs by version](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/API_Version_Support.htm) ·
  [Data Interface](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/DataInterfaceAPI.htm) ·
  [Drop zones](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/CustomDropZoneAPI.htm) ·
  [Custom properties](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/CustomPropertiesAPI.htm) ·
  [Selector](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/SelectorAPI.htm) ·
  [Selection & highlighting](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/selection_highlightAPI.htm) ·
  [GraphicModel](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/context_menu_API_graphic_model_class.htm) ·
  [Context menus](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/context_menu_API.htm) ·
  [Common menu items](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/context_menu_API_common_menu.htm) ·
  [Custom menu items](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/context_menu_API_custom_menu.htm) ·
  [Tooltips](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/custom_tooltip.htm) ·
  [Legend](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/Adding_a_Legend.htm) ·
  [Color palette](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/ColorPaletteAPI.htm) ·
  [Metric thresholds](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/MetricThresholdEditorAPI.htm) ·
  [Export to PDF](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/ExportEngineAPI.htm) ·
  [PDF pagination](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/paginate_custom_widgets.htm) ·
  [Contextual linking](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/contextual_linking.htm) ·
  [Incremental fetch](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/enable_incremental_fetch_Vis.htm) ·
  [Inherited functionality](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/Inheriting_functionality.htm)
- **Look & feel, libraries, deployment:**
  [Customize look and feel](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/Customizing_look_and_feel.htm) ·
  [Image Layout visualization](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/Customizing_ImageLayout_Vis.htm) ·
  [Gallery icon](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/Specifying_visualization_icon.htm) ·
  [Gallery placement](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/viz_gallery_placement.htm) ·
  [Gallery tooltip](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/customize_gallery_tooltips.htm) ·
  [Local libraries](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/UsingLocalFilesAsExternalLibraries.htm) ·
  [Multiple libraries](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/Using_Multiple_Libraries.htm) ·
  [Best practices](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/Best_practices.htm) ·
  [Deploy](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/Deploying_a_custom_visualization.htm) ·
  [Upgrade Strategy](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/Upgrading.htm)
- **React Format panel:**
  [Overview](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/react_format_panel.htm) ·
  [Initialize](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/initialize_react_format_panel.htm) ·
  [Plugin init](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/plugin_init.htm) ·
  [Modify plugin structure](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/modify_plugin_structure.htm) ·
  [Add files](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/add_format_panel_files.htm) ·
  [File structure](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/format_panel_file_structure.htm) ·
  [Create and use](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/create_use_format_panel.htm) ·
  [Config object](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/define_config_object.htm) ·
  [Custom properties](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/define_use_custom_prop.htm) ·
  [Component API](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/component_api.htm) ·
  [Mojo → React widget map](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/map_mojo_widget_types.htm) ·
  [Middle layer](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/implement_middle_layer.htm) ·
  [i18n](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/internationalization.htm) ·
  [Build & deploy](https://www2.strategy.com/producthelp/Current/VisSDK/Content/topics/HTML5/build_deploy_plugin.htm)

Official sample downloads referenced: [MstrVisTemplate](https://www2.strategy.com/producthelp/2021/CustomizationPlugins/BasicScenarios/MstrVisTemplate/MstrVisTemplate.zip),
[D3BubbleChart](https://www2.strategy.com/producthelp/2021/downloads/VisSDK/D3BubbleChartNew.zip),
[CircularTreeMap](https://www2.strategy.com/producthelp/2021/downloads/VisSDK/CircularTreeMap.zip),
[SampleViz (mstr-viz + React Format panel)](https://www2.strategy.com/producthelp/2021/downloads/VisSDK/React_Format_Panel/SampleViz.zip).
Community gallery: <https://community.strategy.com/gallery>.
