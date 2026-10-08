/*
 * Local stand-in for the parts of Strategy's mstrmojo framework that custom visualizations call.
 *
 * It implements the API surface described in the Visualization SDK docs (CustomVisBase, DataInterface,
 * CustomVisDropZones, CustomVisEditorModel, GraphicModel and the related enums) closely enough to render
 * and click through a plugin in a browser. It is NOT the real framework: enum values, selector shapes,
 * highlight picking and aggregation are simplified. Always confirm in Workstation or Library before shipping.
 *
 * The harness page (dev/harness.js) supplies window.SvHarness hooks for logging, tooltips and menus.
 */
(function (global) {
    "use strict";

    var harness = function () {
        return global.SvHarness || {};
    };

    function call(name) {
        var h = harness();
        if (typeof h[name] === "function") {
            return h[name].apply(h, Array.prototype.slice.call(arguments, 1));
        }
        return undefined;
    }

    function log(type, detail) {
        call("log", type, detail);
    }

    function assign(target, source) {
        if (source) {
            for (var key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    target[key] = source[key];
                }
            }
        }
        return target;
    }

    function stableStringify(value) {
        if (value === null || typeof value !== "object") {
            return JSON.stringify(value);
        }
        if (Array.isArray(value)) {
            return "[" + value.map(stableStringify).join(",") + "]";
        }
        return "{" + Object.keys(value).sort().map(function (k) {
            return JSON.stringify(k) + ":" + stableStringify(value[k]);
        }).join(",") + "}";
    }

    // ---- Class system: mstrmojo.declare(superclass, mixins, properties) ----------------------------

    var usesSuper = /\b_super\b/;

    function declare(Super, mixins, props) {
        function Ctor(cfg) {
            if (typeof this.init === "function") {
                this.init(cfg || {});
            }
        }

        var parent = Super ? Super.prototype : {},
            proto = Object.create(Super ? Super.prototype : Object.prototype),
            sources = (mixins || []).concat([props || {}]);

        sources.forEach(function (source) {
            Object.keys(source).forEach(function (key) {
                var value = source[key];
                if (typeof value === "function" && typeof parent[key] === "function" && usesSuper.test(String(value))) {
                    proto[key] = (function (name, fn) {
                        return function () {
                            var saved = this._super;
                            this._super = parent[name];
                            try {
                                return fn.apply(this, arguments);
                            } finally {
                                this._super = saved;
                            }
                        };
                    }(key, value));
                } else {
                    proto[key] = value;
                }
            });
        });

        proto.constructor = Ctor;
        Ctor.prototype = proto;
        return Ctor;
    }

    // ---- Utilities -------------------------------------------------------------------------------

    var $ARR = {
        forEach: function (arr, fn, scope) {
            for (var i = 0; arr && i < arr.length; i++) {
                if (fn.call(scope, arr[i], i) === false) {
                    break;
                }
            }
        },
        filter: function (arr, fn, scope) {
            return Array.prototype.filter.call(arr || [], fn, scope);
        },
        map: function (arr, fn, scope) {
            return Array.prototype.map.call(arr || [], fn, scope);
        },
        indexOf: function (arr, item) {
            return Array.prototype.indexOf.call(arr || [], item);
        }
    };

    var mstrmojo = {
        plugins: {},
        declare: declare,
        array: $ARR,
        requiresCls: function () {},
        requiresDescs: function () {},
        requiresDescsWPrefix: function () {},
        desc: function (id, text) {
            return text;
        },
        descP: function (prefix, id, text) {
            return text;
        },
        models: {template: {}},
        vi: {models: {editors: {}}},
        customviz: {},
        FormatControlHelper: {FORMAT_CONTROL_TYPE: {}},
        CustomVisUtility: {
            isInPauseMode: function () {
                return false;
            }
        }
    };

    // ---- Enums (string values are placeholders; code should only compare against the enum) ----------

    mstrmojo.DEFAULT_CONTEXT_MENU = {
        KEEP_ONLY: "Keep Only",
        EXCLUDE: "Exclude",
        DRILL: "Drill",
        GROUP: "Group",
        CALCULATION: "Calculation",
        SHOW_DATA: "Show Data",
        GO_TO_TARGETS: "Go to Targets",
        CHANGE_VISUALIZATION: "Change Visualization",
        SHOW_LEGEND: "Show Legend"
    };

    mstrmojo.CUSTOM_CONTEXT_MENU = {
        NORMAL: "NORMAL",
        TOGGLE: "TOGGLE",
        SEPARATOR: "SEPARATOR",
        SUBMENU: "SUBMENU",
        SINGLE_SELECT_LIST: "SINGLE_SELECT_LIST",
        MULTI_SELECT_LIST: "MULTI_SELECT_LIST"
    };

    mstrmojo.customviz.PICKED_TYPE = {ATTR: "ATTR", METRIC: "METRIC", BOTH: "BOTH"};
    mstrmojo.customviz.PICKED_CRITERIA = {SUBSECTION: "SUBSECTION", INTERSECTION: "INTERSECTION"};

    mstrmojo.customviz.CustomVisEnums = {
        LEGEND_PROPERTY_SET: "legendProperties",
        ENUM_LEGEND_PROPS: {
            SHOW_LEGEND: "showLegend",
            LEGEND_FONT_FAMILY: "legendFontFamily",
            LEGEND_FONT_SIZE: "legendFontSize",
            LEGEND_FONT_COLOR: "legendFontColor",
            LEGEND_FONT_WEIGHT: "legendFontWeight",
            LEGEND_FONT_ITALIC: "legendFontItalic",
            LEGEND_FONT_UNDERLINE: "legendFontUnderline",
            LEGEND_FONT_LINE_THROUGH: "legendFontLineThrough",
            LEGEND_BG_COLOR: "legendBgColor",
            LEGEND_BG_FILL_TRANSPARENCY: "legendBgFillTransparency",
            LEGEND_POSITION: "legendPosition",
            LEGEND_MODE: "legendMode"
        },
        ENUM_LEGEND_SLOT: {RIGHT_TOP: 1, RIGHT_MIDDLE: 2, RIGHT_BOTTOM: 3, LEFT_TOP: 4, LEFT_MIDDLE: 5, LEFT_BOTTOM: 6}
    };

    var DSS_TYPE = {ATTRIBUTE: 12, METRIC: 4};

    // ---- GraphicModel ------------------------------------------------------------------------------

    function GraphicModel() {
        this._svProps = {};
        this._svId = null;
        this._svSelector = null;
        this._svIsAttrSelector = false;
    }

    GraphicModel.prototype = {
        constructor: GraphicModel,
        // Custom properties are readable both via getCustomProperty() and as fields (samples rely on both).
        setCustomProperties: function (props) {
            assign(this._svProps, props);
            assign(this, props);
        },
        getCustomProperty: function (key) {
            return this._svProps[key];
        },
        setId: function (id) {
            this._svId = id;
        },
        getId: function () {
            return this._svId !== null ? this._svId : stableStringify(this._svSelector);
        },
        setSelector: function (selector, isAttrSelector) {
            this._svSelector = selector;
            this._svIsAttrSelector = !!isAttrSelector;
        },
        getSelector: function () {
            return this._svSelector;
        },
        setGroupOptions: function (headers) {
            this._svGroupOptions = headers;
        },
        setDrillOptions: function (header, actions) {
            this._svDrillOptions = {header: header, actions: actions};
        },
        setGraphicCenter: function (x, y) {
            this._svCenter = {x: x, y: y};
        }
    };

    mstrmojo.customviz.GraphicModel = GraphicModel;

    // Collects element ids ("eid"/"id" values) from any selector shape.
    function selectorElementIds(selector) {
        var ids = [];
        (function walk(node) {
            if (!node || typeof node !== "object") {
                return;
            }
            if (Array.isArray(node)) {
                node.forEach(walk);
                return;
            }
            if (typeof node.eid === "string") {
                ids.push(node.eid);
            } else if (typeof node.id === "string" && node.id.indexOf(";") > 0) {
                ids.push(node.id);
            }
            Object.keys(node).forEach(function (k) {
                walk(node[k]);
            });
        }(selector));
        return ids;
    }

    // ---- DataInterface -----------------------------------------------------------------------------

    function formatNumber(value, fmt) {
        if (value === null || value === undefined || isNaN(value)) {
            return "";
        }
        fmt = fmt || {};
        var decimals = fmt.decimals !== undefined ? fmt.decimals : 0,
            text = Math.abs(value).toLocaleString("en-US", {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
        return (value < 0 ? "-" : "") + (fmt.prefix || "") + text + (fmt.suffix || "");
    }

    function header(name, objectId, elementId, index) {
        return {
            getName: function () {
                return name;
            },
            getObjectId: function () {
                return objectId;
            },
            getElementId: function () {
                return elementId;
            },
            getElementIndex: function () {
                return index;
            },
            isTotal: function () {
                return false;
            }
        };
    }

    function list(items) {
        return {
            size: function () {
                return items.length;
            },
            Size: function () {
                return items.length;
            },
            getHeader: function (i) {
                return items[i];
            },
            getTitle: function (i) {
                return items[i];
            }
        };
    }

    /**
     * grid = {
     *   attributes: [{id, name}],             // row attributes (non-tooltip), in drop-zone order
     *   metrics: [{id, name, format, threshold}],
     *   additionalAttrIds: [id],
     *   rows: [{elements: [name], values: [number], additional: [{idValueMapping}]}]
     * }
     */
    function DataInterface(grid) {
        this._svGrid = grid;
    }

    DataInterface.ENUM_RAW_DATA_FORMAT = {ROWS: 1, TREE: 2, ROWS_ADV: 3};

    function elementId(attr, name) {
        return "h" + name.replace(/[^A-Za-z0-9]/g, "") + ";" + attr.id;
    }

    // Mock thresholds: metrics flagged `threshold: true` get red / amber / green by tertile.
    function thresholdColors(grid) {
        var colors = {};
        grid.metrics.forEach(function (m, j) {
            if (!m.threshold) {
                return;
            }
            var sorted = grid.rows.map(function (r) {
                return r.values[j];
            }).sort(function (a, b) {
                return a - b;
            });
            var lo = sorted[Math.floor(sorted.length / 3)],
                hi = sorted[Math.floor(sorted.length * 2 / 3)];
            colors[j] = function (v) {
                return v < lo ? "#D0473F" : v < hi ? "#E8A33D" : "#3E9B5B";
            };
        });
        return colors;
    }

    DataInterface.prototype = {
        constructor: DataInterface,
        getTotalRows: function () {
            return this._svGrid.rows.length;
        },
        getTotalCols: function () {
            return this._svGrid.metrics.length;
        },
        getColumnHeaderCount: function () {
            return this._svGrid.metrics.length;
        },
        isEmpty: function () {
            return this._svGrid.rows.length === 0;
        },
        getRowTitles: function () {
            return list(this._svGrid.attributes.map(function (a, i) {
                var h = header(a.name, a.id, null, i);
                h.getFormType = function () {
                    return 21;
                };
                return h;
            }));
        },
        getColTitles: function () {
            return list([header("Metrics", "metrics", null, 0)]);
        },
        getColHeaders: function () {
            return list(this._svGrid.metrics.map(function (m, i) {
                return header(m.name, m.id, null, i);
            }));
        },
        getRowHeaders: function (pos) {
            var grid = this._svGrid,
                row = grid.rows[pos || 0] || {elements: []};
            return list(grid.attributes.map(function (a, i) {
                return header(row.elements[i], a.id, elementId(a, String(row.elements[i])), i);
            }));
        },
        getMetricValue: function (row, col) {
            var grid = this._svGrid,
                v = grid.rows[row].values[col];
            return {
                getValue: function () {
                    return formatNumber(v, grid.metrics[col].format);
                },
                getRawValue: function () {
                    return v;
                }
            };
        },
        getColumnHeaderData: function () {
            return this._svGrid.metrics.map(function (m) {
                return {n: m.name, id: m.id};
            });
        },

        getRawData: function (format, params) {
            params = params || {};
            var F = DataInterface.ENUM_RAW_DATA_FORMAT;
            if (format === F.TREE) {
                return this._svTree(params);
            }
            return this._svRows(params, format === F.ROWS_ADV);
        },

        _svRows: function (params, advanced) {
            var grid = this._svGrid,
                thresholds = params.hasThreshold ? thresholdColors(grid) : {};
            return grid.rows.map(function (row) {
                var out = {headers: [], values: []},
                    mapping = {},
                    metricSelector = {};

                grid.attributes.forEach(function (a, i) {
                    var name = String(row.elements[i]),
                        h = {name: name};
                    if (params.hasTitleName) {
                        h.tname = a.name;
                    }
                    if (advanced && params.hasSelection) {
                        h.attributeSelector = {n: name, tid: a.id, eid: elementId(a, name), isSelectAttr: true};
                        metricSelector[a.id] = [{n: name, id: elementId(a, name)}];
                    }
                    mapping[a.id] = name;
                    out.headers.push(h);
                });

                grid.metrics.forEach(function (m, j) {
                    var rv = row.values[j],
                        v = {v: formatNumber(rv, m.format), rv: rv, name: m.name};
                    if (thresholds[j]) {
                        v.threshold = {fillColor: thresholds[j](rv), n: ""};
                    }
                    mapping[m.id] = v.v;
                    out.values.push(v);
                });

                if (advanced && params.hasSelection) {
                    out.metricSelector = metricSelector;
                }
                out.idValueMapping = mapping;
                if (row.additional && row.additional.length) {
                    out.additional = row.additional;
                }
                return out;
            });
        },

        _svTree: function (params) {
            var grid = this._svGrid,
                childrenKey = params.childrenKey || "children",
                descKey = params.descKey || "name",
                root = {};
            root[descKey] = "root";
            root[childrenKey] = [];

            grid.rows.forEach(function (row) {
                var parent = root;
                grid.attributes.forEach(function (a, i) {
                    var name = String(row.elements[i]),
                        kids = parent[childrenKey] = parent[childrenKey] || [],
                        node = null;
                    for (var k = 0; k < kids.length; k++) {
                        if (kids[k][descKey] === name) {
                            node = kids[k];
                        }
                    }
                    if (!node) {
                        node = {};
                        node[descKey] = name;
                        node._eid = elementId(a, name);
                        if (params.hasSelection) {
                            node.attributeSelector = {n: name, tid: a.id, eid: elementId(a, name), isSelectAttr: true};
                        }
                        kids.push(node);
                    }
                    parent = node;
                });
                var leaf = parent,
                    value = row.values[0] || 0;
                leaf.value = (leaf.value || 0) + value;
                leaf.formattedValue = formatNumber(leaf.value, grid.metrics[0] && grid.metrics[0].format);
            });
            return root;
        }
    };

    mstrmojo.models.template.DataInterface = DataInterface;
    mstrmojo.models.template.formatNumber = formatNumber;

    // ---- CustomVisBase -----------------------------------------------------------------------------

    function normalizeProperty(value) {
        if (value !== null && typeof value === "object") {
            var out = {};
            Object.keys(value).forEach(function (k) {
                out[k] = String(value[k]);
            });
            return out;
        }
        return String(value);
    }

    var PALETTE = ["#2D6CDF", "#E8743B", "#19A979", "#945ECF", "#ED4A7B", "#13A4B4", "#BF399E", "#6C8893"];

    var CustomVisBase = declare(null, null, {
        scriptClass: "mstrmojo.CustomVisBase",

        init: function (props) {
            assign(this, props);
            this._svProps = this._svProps || {};
            this._svDefaults = {};
            this._svSelection = {};
            this._svContext = null;
        },

        // Properties ----------------------------------------------------------------------------
        setDefaultPropertyValues: function (defaults) {
            assign(this._svDefaults, defaults);
        },
        getDefaultProperties: function () {
            return assign({}, this._svDefaults);
        },
        getProperties: function () {
            return assign({}, this._svProps);
        },
        getProperty: function (name) {
            return Object.prototype.hasOwnProperty.call(this._svProps, name) ? this._svProps[name] : this._svDefaults[name];
        },
        readProperty: function (name) {
            return this.getProperty(name);
        },
        setProperty: function (name, value, config) {
            config = config || {};
            var changes = {};
            changes[name] = normalizeProperty(value);
            if (typeof config.onPropertyChange === "function") {
                assign(changes, config.onPropertyChange(name, changes[name]) || {});
            }
            Object.keys(changes).forEach(function (k) {
                this._svProps[k] = normalizeProperty(changes[k]);
            }, this);
            log("setProperty", changes);
            if (typeof config.callback === "function") {
                config.callback();
            } else {
                this.refresh();
            }
            call("onPropertiesChanged", this);
        },
        savePropertyAndUpdateWidget: function (name, value, autoRefresh) {
            this.setProperty(name, value, autoRefresh || {callback: function () {}});
        },
        refresh: function () {
            call("render", this);
        },

        // Graphic models ------------------------------------------------------------------------
        getGraphicModels: function () {
            if (!this._svGraphicModels && typeof this.createGraphicModels === "function") {
                this._svGraphicModels = this.createGraphicModels();
            }
            return this._svGraphicModels;
        },
        getSelectorHash: function (selector) {
            return stableStringify(selector);
        },

        // Selection & highlight ------------------------------------------------------------------
        handleSelection: function (evt, graphicModel) {
            var multi = !!(evt && (evt.ctrlKey || evt.metaKey));
            if (!graphicModel) {
                this._svSelection = {};
            } else {
                var id = graphicModel.getId(),
                    already = Object.prototype.hasOwnProperty.call(this._svSelection, id);
                if (multi) {
                    if (already) {
                        delete this._svSelection[id];
                    } else {
                        this._svSelection[id] = graphicModel;
                    }
                } else {
                    var onlyThis = already && Object.keys(this._svSelection).length === 1;
                    this._svSelection = {};
                    if (!onlyThis) {
                        this._svSelection[id] = graphicModel;
                    }
                }
            }
            log("handleSelection", Object.keys(this._svSelection).length + " selected" + (multi ? " (multi)" : ""));
            if (typeof this.updateHighlight === "function") {
                this.updateHighlight();
            }
        },
        handleContextMenuSelection: function (evt, graphicModel) {
            this._svContext = graphicModel || null;
            if (typeof this.updateHighlight === "function") {
                this.updateHighlight();
            }
            var config = typeof this.getContextMenuConfig === "function" ? this.getContextMenuConfig(graphicModel) : null;
            log("handleContextMenuSelection", graphicModel ? "on a mark" : "on empty space");
            call("showContextMenu", this, config, {x: evt ? evt.clientX : 0, y: evt ? evt.clientY : 0});
        },
        graphicNeedsHighlight: function (graphicModel, forContextMenu) {
            if (!graphicModel) {
                return false;
            }
            if (forContextMenu) {
                return !!this._svContext && this._svContext.getId() === graphicModel.getId();
            }
            return Object.prototype.hasOwnProperty.call(this._svSelection, graphicModel.getId());
        },
        canPickGraphicModel: function (selector, isAttrSelector, graphicModel, pickOptions) {
            var wanted = selectorElementIds(selector),
                have = selectorElementIds(graphicModel && graphicModel.getSelector());
            return wanted.length > 0 && wanted.some(function (id) {
                return have.indexOf(id) >= 0;
            });
        },

        // Selector API --------------------------------------------------------------------------
        applySelection: function (selectInfo) {
            log("applySelection", selectInfo);
        },
        clearSelections: function () {
            this._svSelection = {};
            log("clearSelections");
        },
        endSelections: function () {
            log("endSelections");
        },
        getSelections: function () {
            return Object.keys(this._svSelection).map(function (k) {
                return this._svSelection[k];
            }, this);
        },
        addUseAsFilterMenuItem: function () {
            this._svUseAsFilter = true;
        },
        addFilterMenuItem: function () {
            this._svUseAsFilter = true;
        },
        addThresholdMenuItem: function () {
            this._svThresholdMenu = true;
        },
        goToDocument: function () {
            log("goToDocument");
        },

        // Tooltips ------------------------------------------------------------------------------
        showTooltip: function (graphicModel, pos, fixed) {
            call("showTooltip", this, graphicModel, pos, !!fixed);
        },
        hideTooltip: function (delayed) {
            call("hideTooltip", delayed !== false);
        },

        // Misc ----------------------------------------------------------------------------------
        raiseEvent: function (evt) {
            log("raiseEvent", evt && evt.name);
            call("onRaiseEvent", this, evt);
        },
        getColorBy: function (colorInfo) {
            var key = stableStringify(colorInfo),
                hash = 0;
            for (var i = 0; i < key.length; i++) {
                hash = (hash * 31 + key.charCodeAt(i)) | 0;
            }
            return PALETTE[Math.abs(hash) % PALETTE.length];
        },
        getCanvasContainerSize: function () {
            return {width: parseInt(this.width, 10), height: parseInt(this.height, 10)};
        },
        renderErrorMessage: function (message) {
            var div = document.createElement("div");
            div.textContent = message;
            this.domNode.appendChild(div);
        }
    });

    CustomVisBase.ENUM_EXTERNAL_LIBS = {D3: "d3"};
    mstrmojo.CustomVisBase = CustomVisBase;

    // ---- CustomVisDropZones ------------------------------------------------------------------------

    var CustomVisDropZones = declare(null, null, {
        scriptClass: "mstrmojo.vi.models.CustomVisDropZones",

        init: function (props) {
            assign(this, props);
            this._svZones = this._svZones || {};
            this._svZoneNames = this._svZoneNames || [];
        },

        getDropZoneName: function (zone) {
            return typeof zone === "string" ? zone : zone && (zone.n || zone.name);
        },
        getDropZoneObjectsByIndex: function (index) {
            return (this._svZones[this._svZoneNames[index]] || []).slice();
        },
        getDropZoneObjectsByName: function (name) {
            return (this._svZones[name] || []).slice();
        },
        isZoneEmpty: function (name) {
            return !(this._svZones[name] || []).length;
        },
        isObjectInZone: function (object, zoneName) {
            return (this._svZones[zoneName] || []).some(function (o) {
                return o.id === object.id;
            });
        },
        isItemInZone: function (object, zoneName) {
            return this.isObjectInZone(object, zoneName);
        },
        isMetric: function (object) {
            return object && object.t === DSS_TYPE.METRIC;
        },
        isAttribute: function (object) {
            return object && object.t === DSS_TYPE.ATTRIBUTE;
        },
        _svDefs: function () {
            return this.getCustomDropZones() || [];
        },
        getAdditionalAttrIds: function () {
            var defs = this._svDefs(), extra = [], regular = [];
            defs.forEach(function (def) {
                (this._svZones[def.name] || []).forEach(function (o) {
                    if (o.t === DSS_TYPE.ATTRIBUTE) {
                        (def.isAdditionalInfo ? extra : regular).push(o.id);
                    }
                });
            }, this);
            return extra.filter(function (id, i) {
                return regular.indexOf(id) < 0 && extra.indexOf(id) === i;
            });
        },
        getColorByAttributes: function () {
            var out = [];
            this._svDefs().forEach(function (def) {
                if (def.isColorBy) {
                    (this._svZones[def.name] || []).forEach(function (o) {
                        if (o.t === DSS_TYPE.ATTRIBUTE) {
                            out.push(o);
                        }
                    });
                }
            }, this);
            return out;
        },
        isObjectAllowedForDropZone: function (object, zone) {
            var name = typeof zone === "number" ? this._svZoneNames[zone] : this.getDropZoneName(zone),
                def = this._svDefs().filter(function (d) {
                    return d.name === name;
                })[0];
            if (!def || def.disabled) {
                return false;
            }
            var T = CustomVisDropZones.ENUM_ALLOW_DROP_TYPE,
                typeOk = def.allowObjectType === T.ATTRIBUTE_AND_METRIC ||
                    (def.allowObjectType === T.ATTRIBUTE && this.isAttribute(object)) ||
                    (def.allowObjectType === T.METRIC && this.isMetric(object));
            if (!typeOk) {
                return false;
            }
            var res = typeof this.shouldAllowObjectsInDropZone === "function" ?
                this.shouldAllowObjectsInDropZone({n: name, name: name}, [object], 0, null, {}) : null;
            return !res || !res.allowedItems || res.allowedItems.length > 0;
        },

        // Actions are plain records here; the harness applies them.
        getAddDropZoneObjectsActions: function (actions, zoneName, objects, idx, extras) {
            actions.push({type: "add", zone: zoneName, objects: [].concat(objects), idx: idx});
        },
        getRemoveDropZoneObjectsActions: function (actions, zoneName, objects) {
            actions.push({type: "remove", zone: zoneName, objects: [].concat(objects)});
        },
        getReplaceDropZoneObjectsActions: function (actions, zoneName, newObject, idx) {
            actions.push({type: "replace", zone: zoneName, objects: [newObject], idx: idx});
        },
        transitionObjectsToZone: function (zoneName, objects) {
            if (objects === undefined || objects === null) {
                return;
            }
            var zone = this._svZones[zoneName] = this._svZones[zoneName] || [],
                def = this._svDefs().filter(function (d) {
                    return d.name === zoneName;
                })[0] || {};
            [].concat(objects).forEach(function (o) {
                if (o && (!def.maxCapacity || zone.length < def.maxCapacity) && !this.isObjectInZone(o, zoneName)) {
                    zone.push(o);
                }
            }, this);
        },
        buildThresholdMenuOptions: function () {
            log("buildThresholdMenuOptions");
        },
        getDefaultTooltipOrder: function () {
            return null;
        }
    });

    CustomVisDropZones.ENUM_ALLOW_DROP_TYPE = {ATTRIBUTE: 1, METRIC: 2, ATTRIBUTE_AND_METRIC: 3};
    CustomVisDropZones.CUSTOM_DZ_SUFFIX = {ATTRIBUTE: "_attr", METRIC: "_metric"};
    CustomVisDropZones.DSS_TYPE = DSS_TYPE;
    mstrmojo.vi.models.CustomVisDropZones = CustomVisDropZones;

    // ---- CustomVisEditorModel ----------------------------------------------------------------------

    var CustomVisEditorModel = declare(null, null, {
        scriptClass: "mstrmojo.vi.models.editors.CustomVisEditorModel",
        init: function (props) {
            assign(this, props);
        },
        getHost: function () {
            return this.host;
        }
    });

    CustomVisEditorModel.WIDGET_TYPE = {
        EDITORGROUP: "EditorGroup",
        TWOCOLUMN: "TwoColumn",
        PULLDOWN: "PullDown",
        BUTTONBAR: "ButtonBar",
        CHECKLIST: "CheckList",
        TEXTBOX: "TextBox",
        LABEL: "Label",
        CHECKBOXANDLABEL: "CheckBoxAndLabel",
        COMBOBOX: "ComboBox",
        STEPPER: "Stepper",
        CHARACTERGROUP: "CharacterGroup",
        FILLGROUP: "FillGroup",
        LINEGROUP: "LineGroup",
        BUTTON: "Button",
        COLORBYGROUP: "ColorByGroup"
    };
    mstrmojo.vi.models.editors.CustomVisEditorModel = CustomVisEditorModel;

    // ---- mstrApp -----------------------------------------------------------------------------------

    global.mstrApp = global.mstrApp || {
        isExporting: false,
        pageName: "dossier",
        _svTheme: "",
        getPluginsRoot: function () {
            return "../plugins/";
        },
        getThemeClassName: function () {
            return this._svTheme;
        }
    };

    global.mstrmojo = mstrmojo;
}(window));
