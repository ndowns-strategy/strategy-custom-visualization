(function () {
    // Define this code as a plugin in the mstrmojo object
    if (!mstrmojo.plugins.SvKpiBenchmark) {
        mstrmojo.plugins.SvKpiBenchmark = {};
    }

    mstrmojo.requiresCls(
        "mstrmojo.CustomVisBase",
        "mstrmojo.models.template.DataInterface",
        "mstrmojo.array",
        "mstrmojo.customviz.GraphicModel",
        "mstrmojo.customviz.CustomVisEnums"
    );

    var $DI = mstrmojo.models.template.DataInterface,
        GraphicModel = mstrmojo.customviz.GraphicModel,
        $PT = mstrmojo.customviz.PICKED_TYPE,
        $PC = mstrmojo.customviz.PICKED_CRITERIA,
        $DEFAULT_CONTEXT_MENU = mstrmojo.DEFAULT_CONTEXT_MENU,
        $CUSTOM_CONTEXT_MENU = mstrmojo.CUSTOM_CONTEXT_MENU,
        SVG_NS = "http://www.w3.org/2000/svg",
        ARROW_UP = "\u2191",
        ARROW_DOWN = "\u2193",
        EM_DASH = "\u2014";

    // Saved property values are strings (or one level of string-valued objects).
    var DEFAULT_PROPS = {
        displayType: "latest",
        valueFontSize: "0",
        valueBold: "true",
        useValueColor: "false",
        valueColor: {fillColor: "#1F1F1F", fillAlpha: "100"},
        compDisplay: "pctDiff",
        direction: "higher",
        goodColor: {fillColor: "#1E8E3E", fillAlpha: "100"},
        neutralColor: {fillColor: "#5F6368", fillAlpha: "100"},
        badColor: {fillColor: "#D93025", fillAlpha: "100"},
        showCompLabel: "true",
        compLabel: "",
        showTrend: "true",
        trendShape: "line",
        valueLineColor: {fillColor: "#2D6CDF", fillAlpha: "100"},
        showBenchmarkTrend: "true",
        benchLineColor: {fillColor: "#2BB673", fillAlpha: "100"},
        showTimelineAxis: "false",
        align: "left",
        compPosition: "below"
    };

    var COMP_DISPLAYS = [
        {name: "% difference from", value: "pctDiff"},
        {name: "Difference from", value: "diff"},
        {name: "% of", value: "pctOf"},
        {name: "Absolute", value: "absolute"}
    ];

    var DIRECTIONS = [
        {name: "Higher is better", value: "higher"},
        {name: "Lower is better", value: "lower"},
        {name: "None", value: "none"}
    ];

    var MIN_TREND_HEIGHT = 28;

    function isDarkTheme() {
        var app = window.mstrApp;
        var theme = app && typeof app.getThemeClassName === "function" ? app.getThemeClassName() : "";
        return String(theme || "").indexOf("dark") >= 0;
    }

    function el(tag, className, parent, text) {
        var node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (text !== undefined) {
            node.textContent = text;
        }
        if (parent) {
            parent.appendChild(node);
        }
        return node;
    }

    function svg(tag, attrs, parent) {
        var node = document.createElementNS(SVG_NS, tag);
        for (var key in attrs) {
            if (attrs.hasOwnProperty(key)) {
                node.setAttribute(key, attrs[key]);
            }
        }
        if (parent) {
            parent.appendChild(node);
        }
        return node;
    }

    function clearNode(node) {
        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }
    }

    function toNumber(value) {
        var n = parseFloat(value);
        return isFinite(n) ? n : null;
    }

    function colorOf(prop, fallback) {
        return (prop && prop.fillColor) || fallback;
    }

    // "#D93025" -> "rgba(217, 48, 37, 0.14)"
    function tint(hex, alpha) {
        var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
        if (!m) {
            return "transparent";
        }
        var n = parseInt(m[1], 16);
        return "rgba(" + ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ", " + alpha + ")";
    }

    /**
     * Formats n the way Strategy formatted a sample value of the same metric: same prefix/suffix
     * (e.g. "$", "%", "M") and number of decimals, with comma grouping. Used for totals and differences,
     * which Strategy does not format for us.
     */
    function formatLike(sample, n) {
        if (n === null || !isFinite(n)) {
            return "";
        }
        var m = /^([^\d]*?)(\d[\d,]*)(?:\.(\d+))?([^\d]*)$/.exec(String(sample || "").replace(/^\s+|\s+$/g, "")),
            prefix = m ? m[1].replace(/[-(]/g, "") : "",
            decimals = m && m[3] ? m[3].length : 0,
            suffix = m ? m[4].replace(/\)/g, "") : "",
            parts = Math.abs(n).toFixed(decimals).split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return (n < 0 ? "-" : "") + prefix + parts.join(".") + suffix;
    }

    function formatPercent(ratio) {
        return (Math.round(ratio * 1000) / 10).toFixed(1) + "%";
    }

    // Metric columns arrive in drop-zone order (Value, Benchmark, Tooltip). Without drop zones
    // (documents) the first two metrics are used.
    function getMetricColumns(viz) {
        var zones = viz.zonesModel,
            totalCols = viz.dataInterface.getTotalCols ? viz.dataInterface.getTotalCols() : 0;
        if (zones && typeof zones.getDropZoneObjectsByName === "function") {
            var hasValue = (zones.getDropZoneObjectsByName("Value") || []).length > 0,
                hasBench = (zones.getDropZoneObjectsByName("Benchmark") || []).length > 0;
            return {
                value: hasValue ? 0 : -1,
                bench: hasBench ? (hasValue ? 1 : 0) : -1
            };
        }
        return {value: totalCols > 0 ? 0 : -1, bench: totalCols > 1 ? 1 : -1};
    }

    function getAdditionalAttrIds(viz) {
        if (viz.additionalAttrIds && viz.additionalAttrIds.length) {
            return viz.additionalAttrIds;
        }
        var zones = viz.zonesModel;
        return (zones && typeof zones.getAdditionalAttrIds === "function" && zones.getAdditionalAttrIds()) || [];
    }

    function metricName(viz, col) {
        try {
            return viz.dataInterface.getColHeaders(0).getHeader(col).getName();
        } catch (e) {
            return "";
        }
    }

    function readProps(viz) {
        var p = function (name) {
            return viz.getProperty(name);
        };
        return {
            displayType: p("displayType") || "latest",
            valueFontSize: toNumber(p("valueFontSize")) || 0,
            valueBold: p("valueBold") !== "false",
            valueColor: p("useValueColor") === "true" ? colorOf(p("valueColor"), "") : "",
            compDisplay: p("compDisplay") || "pctDiff",
            direction: p("direction") || "higher",
            goodColor: colorOf(p("goodColor"), DEFAULT_PROPS.goodColor.fillColor),
            neutralColor: colorOf(p("neutralColor"), DEFAULT_PROPS.neutralColor.fillColor),
            badColor: colorOf(p("badColor"), DEFAULT_PROPS.badColor.fillColor),
            showCompLabel: p("showCompLabel") !== "false",
            compLabel: p("compLabel") || "",
            showTrend: p("showTrend") !== "false",
            trendShape: p("trendShape") || "line",
            valueLineColor: colorOf(p("valueLineColor"), DEFAULT_PROPS.valueLineColor.fillColor),
            showBenchmarkTrend: p("showBenchmarkTrend") !== "false",
            benchLineColor: colorOf(p("benchLineColor"), DEFAULT_PROPS.benchLineColor.fillColor),
            showTimelineAxis: p("showTimelineAxis") === "true",
            align: p("align") || "left",
            compPosition: p("compPosition") || "below"
        };
    }

    /** The figures shown in the header: the latest period, or the total of all periods. */
    function headline(items, props) {
        var latest = items[items.length - 1].d;
        if (props.displayType !== "total") {
            return latest;
        }
        var value = 0, bench = 0, hasBench = false;
        for (var i = 0; i < items.length; i++) {
            var d = items[i].d;
            value += d.value || 0;
            if (d.bench !== null) {
                bench += d.bench;
                hasBench = true;
            }
        }
        return {
            period: "",
            value: value,
            valueText: formatLike(latest.valueText, value),
            bench: hasBench ? bench : null,
            benchText: hasBench ? formatLike(latest.benchText || latest.valueText, bench) : ""
        };
    }

    /** Comparison text, arrow direction and color; null when there is nothing to compare against. */
    function comparison(shown, props, benchName) {
        if (shown.bench === null || shown.value === null) {
            return null;
        }
        var v = shown.value,
            b = shown.bench,
            dir = v > b ? 1 : (v < b ? -1 : 0),
            text;
        switch (props.compDisplay) {
        case "diff":
            text = formatLike(shown.valueText, Math.abs(v - b));
            break;
        case "pctOf":
            text = b !== 0 ? formatPercent(v / b) : EM_DASH;
            break;
        case "absolute":
            text = shown.benchText;
            break;
        default:
            text = b !== 0 ? formatPercent(Math.abs((v - b) / Math.abs(b))) : EM_DASH;
        }

        var good = props.direction === "higher" ? dir > 0 : (props.direction === "lower" ? dir < 0 : false),
            bad = props.direction === "higher" ? dir < 0 : (props.direction === "lower" ? dir > 0 : false),
            template = props.compLabel || "vs {benchmark} {period}",
            label = template.replace(/\{benchmark\}/g, benchName).replace(/\{period\}/g, shown.period || "")
                .replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");

        return {
            text: text,
            arrow: dir > 0 ? ARROW_UP : (dir < 0 ? ARROW_DOWN : EM_DASH),
            color: good ? props.goodColor : (bad ? props.badColor : props.neutralColor),
            label: label
        };
    }

    /**
     * KPI benchmark period comparison (modeled on Sigma's KPI chart "Benchmark period comparison"):
     * the latest period's value (or a total), how it compares with a benchmark metric, and a trend of
     * both series across the timeline.
     *
     * @class mstrmojo.plugins.SvKpiBenchmark.SvKpiBenchmark
     * @extends mstrmojo.CustomVisBase
     */
    mstrmojo.plugins.SvKpiBenchmark.SvKpiBenchmark = mstrmojo.declare(
        mstrmojo.CustomVisBase,
        null,
        {
            scriptClass: "mstrmojo.plugins.SvKpiBenchmark.SvKpiBenchmark",
            cssClass: "svkpibenchmark",
            errorMessage: "Either there is not enough data to display the visualization or the visualization configuration is incomplete.",
            errorDetails: "This visualization requires a Timeline attribute and a Value metric.",
            externalLibraries: [],
            useRichTooltip: true,
            reuseDOMNode: false,
            supportNEE: true,

            // One GraphicModel per period (grid row).
            createGraphicModels: function createGraphicModels() {
                var viz = this,
                    cols = getMetricColumns(this),
                    graphicModels = {children: []},
                    rawData = this.dataInterface.getRawData($DI.ENUM_RAW_DATA_FORMAT.ROWS_ADV, {
                        hasSelection: true,
                        hasTitleName: true,
                        additionalAttrIds: getAdditionalAttrIds(this)
                    }) || [];

                for (var i = 0; i < rawData.length; i++) {
                    var row = rawData[i],
                        headers = row.headers || [],
                        values = row.values || [],
                        value = cols.value >= 0 ? values[cols.value] : null,
                        bench = cols.bench >= 0 ? values[cols.bench] : null,
                        names = [];

                    for (var h = 0; h < headers.length; h++) {
                        names.push(headers[h].name);
                    }

                    var gm = new GraphicModel();
                    gm.setId(viz.getSelectorHash(row.metricSelector));
                    gm.setSelector(row.metricSelector, false);
                    gm.setGroupOptions(headers);
                    if (headers.length) {
                        gm.setDrillOptions(headers[0].attributeSelector, [{dropZoneIndex: 0, keepParent: false}]);
                    }
                    gm.idValueMapping = row.idValueMapping;
                    if (row.additional) {
                        gm.additional = row.additional;
                    }
                    gm.setCustomProperties({
                        sv: {
                            period: names.join(" \u00b7 "),
                            value: value ? toNumber(value.rv) : null,
                            valueText: value ? value.v : "",
                            bench: bench ? toNumber(bench.rv) : null,
                            benchText: bench ? bench.v : ""
                        }
                    });
                    graphicModels.children.push(gm);
                }
                return graphicModels;
            },

            plot: function plot() {
                this.setDefaultPropertyValues(DEFAULT_PROPS);

                var viz = this,
                    domNode = this.domNode,
                    width = parseInt(this.width, 10) || 0,
                    height = parseInt(this.height, 10) || 0,
                    models = (this.getGraphicModels() || {children: []}).children || [],
                    cols = getMetricColumns(this),
                    props = readProps(this),
                    items = [];

                clearNode(domNode);
                this._svItems = [];
                this._svTrend = null;
                if (typeof this.addUseAsFilterMenuItem === "function") {
                    this.addUseAsFilterMenuItem();
                }

                var root = el("div", "sv-kpi sv-align-" + props.align + (isDarkTheme() ? " sv-dark" : ""), domNode);
                root.style.height = height + "px";

                if (cols.value < 0 || !models.length) {
                    el("div", "sv-empty", root, cols.value < 0 ? this.errorDetails : "No data to display.");
                    this.raiseEvent({name: "renderFinished", id: this.k});
                    return;
                }

                for (var m = 0; m < models.length; m++) {
                    items.push({gm: models[m], d: models[m].getCustomProperty("sv")});
                }
                this._svItems = items;

                // ---- Header: value + comparison ------------------------------------------------
                var shown = headline(items, props),
                    comp = comparison(shown, props, cols.bench >= 0 ? metricName(this, cols.bench) : ""),
                    head = el("div", "sv-kpi-head" + (props.compPosition === "right" ? " sv-comp-right" : ""), root),
                    valueEl = el("div", "sv-kpi-value", head, shown.valueText || EM_DASH),
                    trendWanted = props.showTrend && items.length > 1,
                    autoSize = Math.min(
                        (width - 24) / (Math.max(4, valueEl.textContent.length) * 0.62),
                        height * (trendWanted ? 0.3 : 0.5)
                    );

                valueEl.style.fontSize = Math.round(props.valueFontSize || Math.max(16, Math.min(72, autoSize))) + "px";
                valueEl.style.fontWeight = props.valueBold ? "700" : "400";
                if (props.valueColor) {
                    valueEl.style.color = props.valueColor;
                }

                if (comp) {
                    var compEl = el("div", "sv-kpi-comp", head),
                        badge = el("span", "sv-kpi-badge", compEl, comp.arrow),
                        delta = el("span", "sv-kpi-delta", compEl, comp.text);
                    badge.style.color = comp.color;
                    badge.style.backgroundColor = tint(comp.color, 0.14);
                    delta.style.color = comp.color;
                    if (props.showCompLabel && comp.label) {
                        el("span", "sv-kpi-label", compEl, comp.label);
                    }
                }

                // ---- Trend: value (solid) and benchmark (dotted) across the timeline ------------
                var trendHeight = height - head.offsetHeight - 30;
                if (trendWanted && trendHeight >= MIN_TREND_HEIGHT) {
                    this._svDrawTrend(root, items, props, Math.max(40, width - 24), trendHeight);
                }

                this.updateHighlight();
                this.raiseEvent({name: "renderFinished", id: this.k});
            },

            _svDrawTrend: function _svDrawTrend(root, items, props, width, height) {
                var viz = this,
                    wrap = el("div", "sv-kpi-trend", root),
                    axisH = props.showTimelineAxis ? 16 : 0,
                    pad = 4,
                    plotH = Math.max(10, height - axisH - pad * 2),
                    n = items.length,
                    showBench = props.showBenchmarkTrend,
                    lo = Infinity,
                    hi = -Infinity;

                for (var i = 0; i < n; i++) {
                    var d = items[i].d;
                    if (d.value !== null) {
                        lo = Math.min(lo, d.value);
                        hi = Math.max(hi, d.value);
                    }
                    if (showBench && d.bench !== null) {
                        lo = Math.min(lo, d.bench);
                        hi = Math.max(hi, d.bench);
                    }
                }
                if (!isFinite(lo)) {
                    return;
                }
                if (hi === lo) {
                    hi += 1;
                    lo -= 1;
                }

                var x = function (idx) {
                        return pad + idx * (width - pad * 2) / (n - 1);
                    },
                    y = function (v) {
                        return pad + (1 - (v - lo) / (hi - lo)) * plotH;
                    },
                    line = function (key) {
                        var dPath = "", pen = "M";
                        for (var k = 0; k < n; k++) {
                            var v = items[k].d[key];
                            if (v === null) {
                                pen = "M";
                                continue;
                            }
                            dPath += pen + x(k).toFixed(1) + "," + y(v).toFixed(1);
                            pen = "L";
                        }
                        return dPath;
                    },
                    root2 = svg("svg", {"class": "sv-kpi-svg", width: width, height: height}, wrap);

                if (props.trendShape === "area") {
                    var area = line("value");
                    if (area) {
                        var baseY = (pad + plotH).toFixed(1),
                            firstX = area.match(/^M([\d.]+)/)[1],
                            lastX = area.match(/([\d.]+),[\d.]+$/)[1];
                        svg("path", {
                            "class": "sv-kpi-area",
                            d: area + "L" + lastX + "," + baseY + "L" + firstX + "," + baseY + "Z",
                            fill: tint(props.valueLineColor, 0.16)
                        }, root2);
                    }
                }
                if (showBench) {
                    svg("path", {"class": "sv-kpi-bench", d: line("bench"), stroke: props.benchLineColor}, root2);
                }
                svg("path", {"class": "sv-kpi-line", d: line("value"), stroke: props.valueLineColor}, root2);

                if (axisH) {
                    var axisY = pad + plotH + axisH - 2;
                    svg("text", {"class": "sv-kpi-axis", x: x(0), y: axisY, "text-anchor": "start"}, root2).textContent = items[0].d.period;
                    svg("text", {"class": "sv-kpi-axis", x: x(n - 1), y: axisY, "text-anchor": "end"}, root2).textContent = items[n - 1].d.period;
                }

                var selection = svg("g", {"class": "sv-kpi-sel"}, root2),
                    guide = svg("g", {"class": "sv-kpi-guide", visibility: "hidden"}, root2),
                    guideLine = svg("line", {y1: pad, y2: pad + plotH}, guide),
                    guideValue = svg("circle", {r: 3.5, fill: props.valueLineColor}, guide),
                    guideBench = svg("circle", {r: 3.5, fill: props.benchLineColor}, guide);

                root2.addEventListener("mouseleave", function () {
                    guide.setAttribute("visibility", "hidden");
                });

                this._svTrend = {
                    svgEl: root2,
                    n: n,
                    x: x,
                    y: y,
                    width: width,
                    pad: pad,
                    selection: selection,
                    showGuide: function (idx) {
                        var d = items[idx].d,
                            gx = x(idx);
                        guideLine.setAttribute("x1", gx);
                        guideLine.setAttribute("x2", gx);
                        guideValue.setAttribute("visibility", d.value === null ? "hidden" : "visible");
                        if (d.value !== null) {
                            guideValue.setAttribute("cx", gx);
                            guideValue.setAttribute("cy", y(d.value));
                        }
                        guideBench.setAttribute("visibility", showBench && d.bench !== null ? "visible" : "hidden");
                        if (showBench && d.bench !== null) {
                            guideBench.setAttribute("cx", gx);
                            guideBench.setAttribute("cy", y(d.bench));
                        }
                        guide.setAttribute("visibility", "visible");
                    },
                    hideGuide: function () {
                        guide.setAttribute("visibility", "hidden");
                    }
                };
                return viz;
            },

            // ---- Interaction --------------------------------------------------------------------

            // The period under the pointer when it is over the trend; null elsewhere.
            _svItemFromEvent: function _svItemFromEvent(evt) {
                var trend = this._svTrend,
                    e = evt && (evt.e || evt),
                    target = evt && typeof evt.getTarget === "function" ? evt.getTarget() : (e && e.target);
                if (!trend || !target || !e || (target !== trend.svgEl && !(trend.svgEl.contains && trend.svgEl.contains(target)))) {
                    return null;
                }
                var box = trend.svgEl.getBoundingClientRect(),
                    step = (trend.width - trend.pad * 2) / (trend.n - 1),
                    idx = Math.round((e.clientX - box.left - trend.pad) / step);
                idx = Math.max(0, Math.min(trend.n - 1, idx));
                return {idx: idx, item: this._svItems[idx]};
            },

            onclick: function onclick(evt) {
                var hit = this._svItemFromEvent(evt);
                this.handleSelection(evt.e || evt, hit ? hit.item.gm : null);
            },

            oncontextmenu: function oncontextmenu(evt) {
                var hit = this._svItemFromEvent(evt);
                this.hideTooltip(false);
                this.handleContextMenuSelection(evt.e || evt, hit ? hit.item.gm : null);
            },

            onmousemove: function onmousemove(evt) {
                var hit = this._svItemFromEvent(evt),
                    e = evt.e || evt;
                if (hit) {
                    this._svTrend.showGuide(hit.idx);
                    this.showTooltip(hit.item.gm, {x: e.clientX, y: e.clientY});
                } else {
                    if (this._svTrend) {
                        this._svTrend.hideGuide();
                    }
                    this.hideTooltip(false);
                }
            },

            // Selected periods get a ring on the value line.
            updateHighlight: function updateHighlight() {
                var trend = this._svTrend,
                    items = this._svItems || [];
                if (!trend) {
                    return;
                }
                clearNode(trend.selection);
                for (var i = 0; i < items.length; i++) {
                    var d = items[i].d,
                        selected = this.graphicNeedsHighlight(items[i].gm, false),
                        context = this.graphicNeedsHighlight(items[i].gm, true);
                    if ((selected || context) && d.value !== null) {
                        svg("circle", {
                            "class": "sv-kpi-ring" + (context && !selected ? " sv-kpi-ring-context" : ""),
                            cx: trend.x(i),
                            cy: trend.y(d.value),
                            r: 5
                        }, trend.selection);
                    }
                }
            },

            getGraphicModelsBySelector: function getGraphicModelsBySelector(selector, isAttrSelector) {
                var picked = [],
                    models = (this.getGraphicModels() || {children: []}).children || [],
                    pickOptions = {attribute: $PT.METRIC, metric: $PT.METRIC, criteria: $PC.INTERSECTION};
                for (var i = 0; i < models.length; i++) {
                    if (this.canPickGraphicModel(selector, isAttrSelector, models[i], pickOptions)) {
                        picked.push(models[i]);
                    }
                }
                return picked;
            },

            getContextMenuConfig: function getContextMenuConfig(graphicModel) {
                return {
                    common: [
                        {type: $DEFAULT_CONTEXT_MENU.KEEP_ONLY},
                        {type: $DEFAULT_CONTEXT_MENU.EXCLUDE},
                        {type: $DEFAULT_CONTEXT_MENU.DRILL},
                        {type: $DEFAULT_CONTEXT_MENU.SHOW_DATA},
                        {type: $DEFAULT_CONTEXT_MENU.GO_TO_TARGETS},
                        {type: $DEFAULT_CONTEXT_MENU.CHANGE_VISUALIZATION, isShown: !graphicModel}
                    ],
                    custom: [
                        {type: $CUSTOM_CONTEXT_MENU.SEPARATOR},
                        {type: $CUSTOM_CONTEXT_MENU.TOGGLE, name: "Show trend", propertyName: "showTrend", showFormatPanel: false},
                        {
                            type: $CUSTOM_CONTEXT_MENU.SUBMENU,
                            name: "Comparison",
                            subMenuConfig: [{
                                type: $CUSTOM_CONTEXT_MENU.SINGLE_SELECT_LIST,
                                propertyName: "compDisplay",
                                showFormatPanel: false,
                                items: COMP_DISPLAYS
                            }]
                        },
                        {
                            type: $CUSTOM_CONTEXT_MENU.SUBMENU,
                            name: "Direction",
                            subMenuConfig: [{
                                type: $CUSTOM_CONTEXT_MENU.SINGLE_SELECT_LIST,
                                propertyName: "direction",
                                showFormatPanel: false,
                                items: DIRECTIONS
                            }]
                        }
                    ]
                };
            }
        }
    );
}());
//@ sourceURL=SvKpiBenchmark.js
