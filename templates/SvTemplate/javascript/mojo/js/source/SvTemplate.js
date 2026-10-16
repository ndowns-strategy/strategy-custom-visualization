(function () {
    // Define this code as a plugin in the mstrmojo object
    if (!mstrmojo.plugins.SvTemplate) {
        mstrmojo.plugins.SvTemplate = {};
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
        showValues: "true",
        barFill: {fillColor: "#2D6CDF", fillAlpha: "100"}
    };

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

    /**
     * __SV_TITLE__
     *
     * Starter visualization: one horizontal bar per row of the grid. Replace plot() with your own drawing;
     * keep createGraphicModels() + the event handlers so selection, tooltips and context menus keep working.
     *
     * @class mstrmojo.plugins.SvTemplate.SvTemplate
     * @extends mstrmojo.CustomVisBase
     */
    mstrmojo.plugins.SvTemplate.SvTemplate = mstrmojo.declare(
        mstrmojo.CustomVisBase,
        null,
        {
            scriptClass: "mstrmojo.plugins.SvTemplate.SvTemplate",
            cssClass: "svtemplate",
            errorMessage: "Either there is not enough data to display the visualization or the visualization configuration is incomplete.",
            errorDetails: "This visualization requires one or more attributes and one metric.",
            externalLibraries: [],
            useRichTooltip: true,
            reuseDOMNode: false,
            supportNEE: true,

            // One GraphicModel per drawn mark. The selector ties the mark back to its grid row.
            createGraphicModels: function createGraphicModels() {
                var viz = this,
                    zones = this.zonesModel,
                    graphicModels = {children: []},
                    rawData = this.dataInterface.getRawData($DI.ENUM_RAW_DATA_FORMAT.ROWS_ADV, {
                        hasSelection: true,
                        hasTitleName: true,
                        hasThreshold: true,
                        additionalAttrIds: this.additionalAttrIds ||
                            (zones && zones.getAdditionalAttrIds && zones.getAdditionalAttrIds()) || []
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
                    showValues = this.getProperty("showValues") !== "false",
                    barColor = (this.getProperty("barFill") || {}).fillColor || DEFAULT_PROPS.barFill.fillColor;

                domNode.innerHTML = "";
                this._svItems = [];
                if (typeof this.addUseAsFilterMenuItem === "function") {
                    this.addUseAsFilterMenuItem();
                }

                if (!models.length) {
                    this.raiseEvent({name: "renderFinished", id: this.k});
                    return;
                }

                var max = 0;
                for (var m = 0; m < models.length; m++) {
                    var d = models[m].getCustomProperty("sv");
                    this._svItems.push({gm: models[m], d: d});
                    max = Math.max(max, Math.abs(d.value));
                }

                var pad = 8,
                    rowHeight = Math.max(20, Math.min(40, Math.floor((height - pad * 2) / models.length))),
                    labelWidth = Math.round(width * 0.3),
                    valueWidth = showValues ? 64 : 0,
                    plotWidth = Math.max(10, width - labelWidth - valueWidth - pad * 3),
                    root = svg("svg", {"class": "sv-root", width: width, height: Math.max(height, rowHeight * models.length + pad * 2)}, domNode);

                domNode.style.overflowY = rowHeight * models.length + pad * 2 > height ? "auto" : "hidden";

                for (var i = 0; i < this._svItems.length; i++) {
                    var item = this._svItems[i],
                        top = pad + i * rowHeight,
                        mid = top + rowHeight / 2,
                        row = svg("g", {"class": "sv-row"}, root),
                        barWidth = max ? Math.abs(item.d.value) / max * plotWidth : 0;

                    row.setAttribute(IDX_ATTR, String(i));
                    svg("rect", {"class": "sv-hit", x: 0, y: top, width: width, height: rowHeight}, row);
                    svg("text", {"class": "sv-label", x: labelWidth, y: mid, dy: "0.35em", "text-anchor": "end"}, row).textContent = item.d.label;
                    svg("rect", {
                        "class": "sv-bar",
                        x: labelWidth + pad, y: mid - rowHeight * 0.3,
                        width: Math.max(1, barWidth), height: rowHeight * 0.6,
                        fill: barColor
                    }, row);
                    if (showValues) {
                        svg("text", {"class": "sv-value", x: labelWidth + pad * 2 + barWidth, y: mid, dy: "0.35em"}, row).textContent = item.d.valueText;
                    }
                }

                this.updateHighlight();
                // Tell the PDF export engine rendering is done (raise it after any async work or animation).
                this.raiseEvent({name: "renderFinished", id: this.k});
            },

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
                var rows = this.domNode ? this.domNode.querySelectorAll(".sv-row") : [],
                    anySelected = false;
                for (var i = 0; i < rows.length; i++) {
                    var item = (this._svItems || [])[parseInt(rows[i].getAttribute(IDX_ATTR), 10)];
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
                    root.setAttribute("class", "sv-root" + (anySelected ? " sv-has-selection" : ""));
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
                        {type: $DEFAULT_CONTEXT_MENU.CHANGE_VISUALIZATION, isShown: !graphicModel}
                    ],
                    custom: [
                        {type: $CUSTOM_CONTEXT_MENU.TOGGLE, name: "Show values", propertyName: "showValues", showFormatPanel: false}
                    ]
                };
            }
        }
    );
}());
//@ sourceURL=SvTemplate.js
