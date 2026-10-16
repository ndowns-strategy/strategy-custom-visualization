(function () {
    // Define this code as a plugin in the mstrmojo object
    if (!mstrmojo.plugins.SvBulletChart) {
        mstrmojo.plugins.SvBulletChart = {};
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
        IDX_ATTR = "data-sv-idx";

    // Saved property values are strings (or one level of string-valued objects).
    var DEFAULT_PROPS = {
        sortOrder: "none",
        showValues: "true",
        showAttainment: "false",
        showBands: "true",
        poorBelow: "70",
        goodFrom: "100",
        barFill: {fillColor: "#2D6CDF", fillAlpha: "100"},
        useThresholdColors: "false"
    };

    var LAYOUT = {
        minRow: 22,
        maxRow: 56,
        pad: 8,
        valueGap: 6,
        charWidth: 6.6
    };

    function isDarkTheme() {
        var app = window.mstrApp;
        var theme = app && typeof app.getThemeClassName === "function" ? app.getThemeClassName() : "";
        return String(theme || "").indexOf("dark") >= 0;
    }

    function toNumber(value, fallback) {
        var n = parseFloat(value);
        return isFinite(n) ? n : fallback;
    }

    function svg(tag, attrs, parent) {
        var el = document.createElementNS(SVG_NS, tag);
        for (var key in attrs) {
            if (attrs.hasOwnProperty(key)) {
                el.setAttribute(key, attrs[key]);
            }
        }
        if (parent) {
            parent.appendChild(el);
        }
        return el;
    }

    function clearNode(node) {
        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }
    }

    function formatPercent(ratio) {
        return Math.round(ratio * 100) + "%";
    }

    // Shortens an SVG <text> to fit maxWidth, keeping the full text in a <title> for hover.
    function fitText(textEl, fullText, maxWidth) {
        var measure = function () {
            try {
                return textEl.getComputedTextLength();
            } catch (e) {
                return textEl.textContent.length * LAYOUT.charWidth;
            }
        };
        textEl.textContent = fullText;
        var length = measure();
        if (!length || length <= maxWidth) {
            return;
        }
        // Proportional first guess, then trim until it really fits.
        var keep = Math.max(1, Math.floor(fullText.length * maxWidth / length));
        do {
            textEl.textContent = fullText.slice(0, keep) + "\u2026";
            keep--;
        } while (keep > 0 && measure() > maxWidth);
        svg("title", {}, textEl).textContent = fullText;
    }

    /**
     * Works out which metric columns hold Actual and Target. Columns arrive in drop-zone order;
     * without drop zones (documents) the first two metrics are used.
     */
    function getMetricColumns(viz) {
        var zones = viz.zonesModel,
            totalCols = viz.dataInterface.getTotalCols ? viz.dataInterface.getTotalCols() : 0;
        if (zones && typeof zones.getDropZoneObjectsByName === "function") {
            var hasActual = (zones.getDropZoneObjectsByName("Actual") || []).length > 0,
                hasTarget = (zones.getDropZoneObjectsByName("Target") || []).length > 0;
            return {
                actual: hasActual ? 0 : -1,
                target: hasTarget ? (hasActual ? 1 : 0) : -1
            };
        }
        return {actual: totalCols > 0 ? 0 : -1, target: totalCols > 1 ? 1 : -1};
    }

    function getAdditionalAttrIds(viz) {
        if (viz.additionalAttrIds && viz.additionalAttrIds.length) {
            return viz.additionalAttrIds;
        }
        var zones = viz.zonesModel;
        return (zones && typeof zones.getAdditionalAttrIds === "function" && zones.getAdditionalAttrIds()) || [];
    }

    function readProps(viz) {
        var poor = toNumber(viz.getProperty("poorBelow"), 70) / 100,
            good = toNumber(viz.getProperty("goodFrom"), 100) / 100,
            fill = viz.getProperty("barFill") || {};
        return {
            sortOrder: viz.getProperty("sortOrder") || "none",
            showValues: viz.getProperty("showValues") !== "false",
            showAttainment: viz.getProperty("showAttainment") === "true",
            showBands: viz.getProperty("showBands") !== "false",
            poorBelow: Math.min(poor, good),
            goodFrom: Math.max(poor, good),
            barColor: fill.fillColor || DEFAULT_PROPS.barFill.fillColor,
            useThresholdColors: viz.getProperty("useThresholdColors") === "true"
        };
    }

    function sortItems(items, order) {
        var attainment = function (d) {
            return d.target ? d.actual / d.target : -Infinity;
        };
        var byKey = {
            actualDesc: function (a, b) {
                return b.d.actual - a.d.actual;
            },
            attainmentDesc: function (a, b) {
                return attainment(b.d) - attainment(a.d);
            },
            attainmentAsc: function (a, b) {
                return attainment(a.d) - attainment(b.d);
            }
        };
        if (byKey[order]) {
            items.sort(byKey[order]);
        }
        return items;
    }

    /**
     * @class mstrmojo.plugins.SvBulletChart.SvBulletChart
     * @extends mstrmojo.CustomVisBase
     */
    mstrmojo.plugins.SvBulletChart.SvBulletChart = mstrmojo.declare(
        mstrmojo.CustomVisBase,
        null,
        {
            scriptClass: "mstrmojo.plugins.SvBulletChart.SvBulletChart",
            cssClass: "svbulletchart",
            errorMessage: "Either there is not enough data to display the visualization or the visualization configuration is incomplete.",
            errorDetails: "This visualization requires one or more attributes and an Actual metric.",
            externalLibraries: [],
            useRichTooltip: true,
            reuseDOMNode: false,
            supportNEE: true,

            createGraphicModels: function createGraphicModels() {
                var viz = this,
                    cols = getMetricColumns(this),
                    graphicModels = {children: []},
                    rawData = this.dataInterface.getRawData($DI.ENUM_RAW_DATA_FORMAT.ROWS_ADV, {
                        hasSelection: true,
                        hasTitleName: true,
                        hasThreshold: true,
                        additionalAttrIds: getAdditionalAttrIds(this)
                    }) || [];

                for (var i = 0; i < rawData.length; i++) {
                    var row = rawData[i],
                        headers = row.headers || [],
                        values = row.values || [],
                        actual = cols.actual >= 0 ? values[cols.actual] : null,
                        target = cols.target >= 0 ? values[cols.target] : null,
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
                            label: names.join(" \u00b7 "),
                            actual: actual ? toNumber(actual.rv, 0) : 0,
                            actualText: actual ? actual.v : "",
                            target: target ? toNumber(target.rv, null) : null,
                            targetText: target ? target.v : "",
                            thresholdColor: actual && actual.threshold ? actual.threshold.fillColor : null
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
                    props = readProps(this),
                    dark = isDarkTheme(),
                    items = [];

                clearNode(domNode);
                this._svItems = [];

                if (typeof this.addUseAsFilterMenuItem === "function") {
                    this.addUseAsFilterMenuItem();
                }
                if (props.useThresholdColors && typeof this.addThresholdMenuItem === "function") {
                    this.addThresholdMenuItem();
                }

                if (!models.length || getMetricColumns(this).actual < 0) {
                    var msg = document.createElement("div");
                    msg.className = "sv-empty";
                    msg.textContent = getMetricColumns(this).actual < 0 ? this.errorDetails : "No data to display.";
                    domNode.appendChild(msg);
                    this.raiseEvent({name: "renderFinished", id: this.k});
                    return;
                }

                for (var m = 0; m < models.length; m++) {
                    items.push({gm: models[m], d: models[m].getCustomProperty("sv")});
                }
                sortItems(items, props.sortOrder);
                this._svItems = items;

                // ---- Layout -------------------------------------------------------------------
                var n = items.length,
                    longestLabel = 0,
                    longestValue = 0,
                    maxValue = 0,
                    minValue = 0;
                for (var i = 0; i < n; i++) {
                    var d = items[i].d,
                        parts = [];
                    if (props.showValues) {
                        parts.push(d.actualText);
                    }
                    if (props.showAttainment && d.target) {
                        parts.push(formatPercent(d.actual / d.target));
                    }
                    items[i].valueText = parts.join("  ");
                    longestLabel = Math.max(longestLabel, d.label.length);
                    longestValue = Math.max(longestValue, items[i].valueText.length);
                    maxValue = Math.max(maxValue, d.actual, d.target || 0, d.target ? d.target * props.goodFrom : 0);
                    minValue = Math.min(minValue, d.actual);
                }
                maxValue = maxValue > minValue ? maxValue * 1.04 : minValue + 1;

                var rowHeight = Math.max(LAYOUT.minRow, Math.min(LAYOUT.maxRow, Math.floor((height - LAYOUT.pad * 2) / n))),
                    contentHeight = rowHeight * n + LAYOUT.pad * 2,
                    labelWidth = Math.min(Math.round(width * 0.35), Math.ceil(longestLabel * LAYOUT.charWidth) + LAYOUT.pad),
                    valueWidth = longestValue ? Math.min(Math.round(width * 0.3), Math.ceil(longestValue * LAYOUT.charWidth) + LAYOUT.valueGap * 2) : 0,
                    plotLeft = labelWidth + LAYOUT.pad,
                    plotWidth = Math.max(20, width - plotLeft - valueWidth - LAYOUT.pad),
                    scale = function (v) {
                        return plotLeft + (v - minValue) / (maxValue - minValue) * plotWidth;
                    };

                domNode.style.overflowY = contentHeight > height ? "auto" : "hidden";

                var root = svg("svg", {
                    "class": "sv-root" + (dark ? " sv-dark" : ""),
                    width: width,
                    height: Math.max(height, contentHeight),
                    role: "img"
                }, domNode);

                // Zero line when values go negative.
                if (minValue < 0) {
                    svg("line", {
                        "class": "sv-zero",
                        x1: scale(0), x2: scale(0),
                        y1: LAYOUT.pad, y2: contentHeight - LAYOUT.pad
                    }, root);
                }

                // ---- Rows ---------------------------------------------------------------------
                for (var r = 0; r < n; r++) {
                    var item = items[r],
                        dd = item.d,
                        top = LAYOUT.pad + r * rowHeight,
                        mid = top + rowHeight / 2,
                        bandH = Math.round(rowHeight * 0.64),
                        barH = Math.max(4, Math.round(rowHeight * 0.3)),
                        row = svg("g", {"class": "sv-row"}, root);

                    row.setAttribute(IDX_ATTR, String(r));

                    // Full-width hit area so the whole row is clickable.
                    svg("rect", {"class": "sv-hit", x: 0, y: top, width: width, height: rowHeight}, row);

                    var label = svg("text", {"class": "sv-label", x: labelWidth, y: mid, "text-anchor": "end", dy: "0.35em"}, row);
                    fitText(label, dd.label, labelWidth - 2);

                    if (props.showBands && dd.target) {
                        var bandEdges = [minValue, dd.target * props.poorBelow, dd.target * props.goodFrom, maxValue],
                            bandClasses = ["sv-band-poor", "sv-band-ok", "sv-band-good"];
                        for (var b = 0; b < 3; b++) {
                            var x0 = scale(Math.max(minValue, bandEdges[b])),
                                x1 = scale(Math.min(maxValue, bandEdges[b + 1]));
                            if (x1 > x0) {
                                svg("rect", {
                                    "class": "sv-band " + bandClasses[b],
                                    x: x0, y: mid - bandH / 2, width: x1 - x0, height: bandH
                                }, row);
                            }
                        }
                    }

                    var start = scale(Math.max(0, minValue)),
                        end = scale(dd.actual),
                        bar = svg("rect", {
                            "class": "sv-bar",
                            x: Math.min(start, end),
                            y: mid - barH / 2,
                            width: Math.max(1, Math.abs(end - start)),
                            height: barH
                        }, row);
                    bar.style.fill = props.useThresholdColors && dd.thresholdColor ? dd.thresholdColor : props.barColor;

                    if (dd.target !== null) {
                        var tx = scale(dd.target);
                        svg("line", {
                            "class": "sv-target",
                            x1: tx, x2: tx,
                            y1: mid - bandH / 2 - 1, y2: mid + bandH / 2 + 1
                        }, row);
                    }

                    if (valueWidth && item.valueText) {
                        var value = svg("text", {
                            "class": "sv-value",
                            x: plotLeft + plotWidth + LAYOUT.valueGap,
                            y: mid,
                            dy: "0.35em"
                        }, row);
                        fitText(value, item.valueText, valueWidth - LAYOUT.valueGap);
                    }
                }

                this.updateHighlight();
                this.raiseEvent({name: "renderFinished", id: this.k});
            },

            // ---- Selection & highlight -----------------------------------------------------------

            _svItemFromEvent: function _svItemFromEvent(evt) {
                var node = evt && typeof evt.getTarget === "function" ? evt.getTarget() : (evt && (evt.e || evt).target);
                while (node && node !== this.domNode) {
                    if (node.getAttribute && node.getAttribute(IDX_ATTR) !== null) {
                        return (this._svItems || [])[parseInt(node.getAttribute(IDX_ATTR), 10)] || null;
                    }
                    node = node.parentNode;
                }
                return null;
            },

            onclick: function onclick(evt) {
                var item = this._svItemFromEvent(evt);
                this.handleSelection(evt.e || evt, item ? item.gm : null);
            },

            oncontextmenu: function oncontextmenu(evt) {
                var item = this._svItemFromEvent(evt);
                this.hideTooltip(false);
                this.handleContextMenuSelection(evt.e || evt, item ? item.gm : null);
            },

            onmousemove: function onmousemove(evt) {
                var item = this._svItemFromEvent(evt),
                    e = evt.e || evt;
                if (item) {
                    this.showTooltip(item.gm, {x: e.clientX, y: e.clientY});
                } else {
                    this.hideTooltip(false);
                }
            },

            updateHighlight: function updateHighlight() {
                var items = this._svItems || [],
                    rows = this.domNode ? this.domNode.querySelectorAll(".sv-row") : [],
                    anySelected = false;
                for (var i = 0; i < rows.length; i++) {
                    var item = items[parseInt(rows[i].getAttribute(IDX_ATTR), 10)];
                    if (!item) {
                        continue;
                    }
                    var selected = !!this.graphicNeedsHighlight(item.gm, false),
                        contextSelected = !!this.graphicNeedsHighlight(item.gm, true);
                    anySelected = anySelected || selected;
                    rows[i].setAttribute("class", "sv-row" + (selected ? " sv-selected" : "") + (contextSelected ? " sv-context" : ""));
                }
                var root = this.domNode && this.domNode.querySelector(".sv-root");
                if (root) {
                    root.setAttribute("class", "sv-root" + (isDarkTheme() ? " sv-dark" : "") + (anySelected ? " sv-has-selection" : ""));
                }
            },

            getGraphicModelsBySelector: function getGraphicModelsBySelector(selector, isAttrSelector) {
                var picked = [],
                    models = (this.getGraphicModels() || {children: []}).children || [],
                    pickOptions = {
                        attribute: $PT.METRIC,
                        metric: $PT.METRIC,
                        criteria: $PC.INTERSECTION
                    };
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
                        {type: $DEFAULT_CONTEXT_MENU.GROUP},
                        {type: $DEFAULT_CONTEXT_MENU.CALCULATION},
                        {type: $DEFAULT_CONTEXT_MENU.SHOW_DATA},
                        {type: $DEFAULT_CONTEXT_MENU.GO_TO_TARGETS},
                        {type: $DEFAULT_CONTEXT_MENU.CHANGE_VISUALIZATION, isShown: !graphicModel}
                    ],
                    custom: [
                        {type: $CUSTOM_CONTEXT_MENU.SEPARATOR},
                        {type: $CUSTOM_CONTEXT_MENU.TOGGLE, name: "Show value labels", propertyName: "showValues", showFormatPanel: false},
                        {type: $CUSTOM_CONTEXT_MENU.TOGGLE, name: "Show bands", propertyName: "showBands", showFormatPanel: false},
                        {
                            type: $CUSTOM_CONTEXT_MENU.SUBMENU,
                            name: "Sort",
                            subMenuConfig: [{
                                type: $CUSTOM_CONTEXT_MENU.SINGLE_SELECT_LIST,
                                propertyName: "sortOrder",
                                showFormatPanel: false,
                                items: [
                                    {name: "Data order", value: "none"},
                                    {name: "Actual, high to low", value: "actualDesc"},
                                    {name: "% of target, high to low", value: "attainmentDesc"},
                                    {name: "% of target, low to high", value: "attainmentAsc"}
                                ]
                            }]
                        }
                    ]
                };
            }
        }
    );
}());
//@ sourceURL=SvBulletChart.js
