(function () {
    // Define this code as a plugin in the mstrmojo object
    if (!mstrmojo.plugins.SvFunnelChart) {
        mstrmojo.plugins.SvFunnelChart = {};
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
        labelMode: "value",
        sortOrder: "none",
        showBrackets: "true",
        barFill: {fillColor: "#14A99A", fillAlpha: "100"}
    };

    var LAYOUT = {
        pad: 8,
        labelGap: 12,
        bracketSpace: 30,
        minRow: 18,
        maxRow: 64,
        barRatio: 0.72,
        charWidth: 6.6
    };

    var LABEL_MODES = [
        {name: "Value", value: "value"},
        {name: "% of first stage", value: "percent"},
        {name: "Value and %", value: "both"},
        {name: "None", value: "none"}
    ];

    function isDarkTheme() {
        var app = window.mstrApp;
        var theme = app && typeof app.getThemeClassName === "function" ? app.getThemeClassName() : "";
        return String(theme || "").indexOf("dark") >= 0;
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

    function textWidth(textEl) {
        try {
            return textEl.getComputedTextLength();
        } catch (e) {
            return textEl.textContent.length * LAYOUT.charWidth;
        }
    }

    // Shortens an SVG <text> to fit maxWidth, keeping the full text in a <title> for hover.
    function fitText(textEl, fullText, maxWidth) {
        textEl.textContent = fullText;
        var length = textWidth(textEl);
        if (!length || length <= maxWidth) {
            return;
        }
        var keep = Math.max(1, Math.floor(fullText.length * maxWidth / length));
        do {
            textEl.textContent = fullText.slice(0, keep) + "\u2026";
            keep--;
        } while (keep > 0 && textWidth(textEl) > maxWidth);
        svg("title", {}, textEl).textContent = fullText;
    }

    // "5.2%", "100%", "0.4%".
    function formatPercent(ratio) {
        var pct = Math.round(ratio * 1000) / 10;
        return (pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)) + "%";
    }

    // True when white text would be hard to read on this fill.
    function isLightColor(hex) {
        var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
        if (!m) {
            return false;
        }
        var n = parseInt(m[1], 16),
            r = (n >> 16) & 255,
            g = (n >> 8) & 255,
            b = n & 255;
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
    }

    function getAdditionalAttrIds(viz) {
        if (viz.additionalAttrIds && viz.additionalAttrIds.length) {
            return viz.additionalAttrIds;
        }
        var zones = viz.zonesModel;
        return (zones && typeof zones.getAdditionalAttrIds === "function" && zones.getAdditionalAttrIds()) || [];
    }

    function readProps(viz) {
        var fill = viz.getProperty("barFill") || {};
        return {
            labelMode: viz.getProperty("labelMode") || "value",
            sortOrder: viz.getProperty("sortOrder") || "none",
            showBrackets: viz.getProperty("showBrackets") !== "false",
            barColor: fill.fillColor || DEFAULT_PROPS.barFill.fillColor
        };
    }

    function barLabel(d, first, mode) {
        var pct = first > 0 ? formatPercent(d.value / first) : "";
        switch (mode) {
        case "percent":
            return pct;
        case "both":
            return pct ? d.valueText + " (" + pct + ")" : d.valueText;
        case "none":
            return "";
        default:
            return d.valueText;
        }
    }

    // Horizontal bracket |-----| spanning x0..x1 with a centered label above (up) or below (down).
    function drawBracket(parent, x0, x1, y, label, labelSide) {
        var g = svg("g", {"class": "sv-bracket"}, parent);
        svg("path", {
            d: "M" + x0 + "," + (y - 5) + "V" + (y + 5) + "M" + x0 + "," + y + "H" + x1 + "M" + x1 + "," + (y - 5) + "V" + (y + 5)
        }, g);
        svg("text", {
            x: (x0 + x1) / 2,
            y: labelSide === "up" ? y - 9 : y + 18,
            "text-anchor": "middle"
        }, g).textContent = label;
        return g;
    }

    /**
     * Funnel chart: one centered bar per stage, width proportional to the metric, with the first stage
     * as 100% and a bracket showing how much of it reaches the last stage.
     *
     * @class mstrmojo.plugins.SvFunnelChart.SvFunnelChart
     * @extends mstrmojo.CustomVisBase
     */
    mstrmojo.plugins.SvFunnelChart.SvFunnelChart = mstrmojo.declare(
        mstrmojo.CustomVisBase,
        null,
        {
            scriptClass: "mstrmojo.plugins.SvFunnelChart.SvFunnelChart",
            cssClass: "svfunnelchart",
            errorMessage: "Either there is not enough data to display the visualization or the visualization configuration is incomplete.",
            errorDetails: "This visualization requires one or more attributes and one metric.",
            externalLibraries: [],
            useRichTooltip: true,
            reuseDOMNode: false,
            supportNEE: true,

            // One GraphicModel per stage (grid row); the selector ties the bar back to its row.
            createGraphicModels: function createGraphicModels() {
                var viz = this,
                    graphicModels = {children: []},
                    rawData = this.dataInterface.getRawData($DI.ENUM_RAW_DATA_FORMAT.ROWS_ADV, {
                        hasSelection: true,
                        hasTitleName: true,
                        additionalAttrIds: getAdditionalAttrIds(this)
                    }) || [];

                for (var i = 0; i < rawData.length; i++) {
                    var row = rawData[i],
                        headers = row.headers || [],
                        value = (row.values || [])[0],
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
                            value: value ? parseFloat(value.rv) || 0 : 0,
                            valueText: value ? value.v : ""
                        }
                    });
                    graphicModels.children.push(gm);
                }
                return graphicModels;
            },

            plot: function plot() {
                this.setDefaultPropertyValues(DEFAULT_PROPS);

                var domNode = this.domNode,
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

                if (!models.length) {
                    var msg = document.createElement("div");
                    msg.className = "sv-empty";
                    msg.textContent = "No data to display.";
                    domNode.appendChild(msg);
                    this.raiseEvent({name: "renderFinished", id: this.k});
                    return;
                }

                for (var m = 0; m < models.length; m++) {
                    items.push({gm: models[m], d: models[m].getCustomProperty("sv")});
                }
                if (props.sortOrder === "desc") {
                    items.sort(function (a, b) {
                        return b.d.value - a.d.value;
                    });
                }
                this._svItems = items;

                // ---- Layout -------------------------------------------------------------------
                var n = items.length,
                    first = items[0].d.value,
                    last = items[n - 1].d.value,
                    maxValue = 0,
                    longestLabel = 0;
                for (var i = 0; i < n; i++) {
                    maxValue = Math.max(maxValue, items[i].d.value);
                    longestLabel = Math.max(longestLabel, items[i].d.label.length);
                }

                var brackets = props.showBrackets && n > 1 && first > 0,
                    bracketSpace = brackets ? LAYOUT.bracketSpace : 0,
                    available = height - LAYOUT.pad * 2 - bracketSpace * 2,
                    rowHeight = Math.max(LAYOUT.minRow, Math.min(LAYOUT.maxRow, Math.floor(available / n))),
                    barHeight = Math.max(8, Math.round(rowHeight * LAYOUT.barRatio)),
                    contentHeight = rowHeight * n + LAYOUT.pad * 2 + bracketSpace * 2,
                    labelWidth = Math.min(Math.round(width * 0.3), Math.ceil(longestLabel * LAYOUT.charWidth)),
                    plotLeft = LAYOUT.pad + labelWidth + LAYOUT.labelGap,
                    plotWidth = Math.max(20, width - plotLeft - LAYOUT.pad),
                    centerX = plotLeft + plotWidth / 2,
                    top = LAYOUT.pad + bracketSpace,
                    barWidth = function (v) {
                        return maxValue > 0 ? Math.max(0, v) / maxValue * plotWidth : 0;
                    },
                    insideTextDark = isLightColor(props.barColor);

                domNode.style.overflowY = contentHeight > height ? "auto" : "hidden";

                var root = svg("svg", {
                    "class": "sv-root" + (dark ? " sv-dark" : ""),
                    width: width,
                    height: Math.max(height, contentHeight),
                    role: "img"
                }, domNode);

                // ---- Stages -------------------------------------------------------------------
                for (var r = 0; r < n; r++) {
                    var item = items[r],
                        d = item.d,
                        rowTop = top + r * rowHeight,
                        mid = rowTop + rowHeight / 2,
                        w = barWidth(d.value),
                        row = svg("g", {"class": "sv-row"}, root);

                    row.setAttribute(IDX_ATTR, String(r));
                    svg("rect", {"class": "sv-hit", x: 0, y: rowTop, width: width, height: rowHeight}, row);

                    var label = svg("text", {"class": "sv-label", x: LAYOUT.pad, y: mid, dy: "0.35em"}, row);
                    fitText(label, d.label, labelWidth);

                    var bar = svg("rect", {
                        "class": "sv-bar",
                        x: centerX - Math.max(w, 1) / 2,
                        y: mid - barHeight / 2,
                        width: Math.max(w, 1),
                        height: barHeight
                    }, row);
                    bar.style.fill = props.barColor;

                    var text = barLabel(d, first, props.labelMode);
                    if (text) {
                        var value = svg("text", {"class": "sv-value", x: centerX, y: mid, dy: "0.35em", "text-anchor": "middle"}, row);
                        value.textContent = text;
                        if (textWidth(value) + 8 <= w) {
                            value.setAttribute("class", "sv-value sv-value-inside" + (insideTextDark ? " sv-value-dark" : ""));
                        } else {
                            // Too narrow: put the label just right of the bar.
                            value.setAttribute("x", centerX + w / 2 + 6);
                            value.setAttribute("text-anchor", "start");
                            fitText(value, text, Math.max(10, plotLeft + plotWidth - (centerX + w / 2 + 6)));
                        }
                    }
                }

                // ---- Brackets: first stage = 100%, last stage as % of first -------------------
                if (brackets) {
                    var w0 = Math.max(barWidth(first), 10),
                        wn = Math.max(barWidth(last), 10);
                    drawBracket(root, centerX - w0 / 2, centerX + w0 / 2, top - 12, "100%", "up");
                    drawBracket(root, centerX - wn / 2, centerX + wn / 2, top + n * rowHeight + 10, formatPercent(last / first), "down");
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
                        {type: $DEFAULT_CONTEXT_MENU.GROUP},
                        {type: $DEFAULT_CONTEXT_MENU.CALCULATION},
                        {type: $DEFAULT_CONTEXT_MENU.SHOW_DATA},
                        {type: $DEFAULT_CONTEXT_MENU.GO_TO_TARGETS},
                        {type: $DEFAULT_CONTEXT_MENU.CHANGE_VISUALIZATION, isShown: !graphicModel}
                    ],
                    custom: [
                        {type: $CUSTOM_CONTEXT_MENU.SEPARATOR},
                        {type: $CUSTOM_CONTEXT_MENU.TOGGLE, name: "Show % brackets", propertyName: "showBrackets", showFormatPanel: false},
                        {
                            type: $CUSTOM_CONTEXT_MENU.SUBMENU,
                            name: "Bar labels",
                            subMenuConfig: [{
                                type: $CUSTOM_CONTEXT_MENU.SINGLE_SELECT_LIST,
                                propertyName: "labelMode",
                                showFormatPanel: false,
                                items: LABEL_MODES
                            }]
                        }
                    ]
                };
            }
        }
    );
}());
//@ sourceURL=SvFunnelChart.js
