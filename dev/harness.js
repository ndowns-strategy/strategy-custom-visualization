/*
 * Preview harness: loads a plugin from ../plugins/<Name>/ exactly as deployed (its XML config, CSS and JS)
 * on top of mock-mstrmojo.js, then lets you edit drop zones, change Format-panel properties, resize,
 * switch theme and click / right-click / hover the visualization.
 *
 * URL parameters: ?plugin=<Name>&dataset=<id>&theme=dark
 */
(function () {
    "use strict";

    const DSS = mstrmojo.vi.models.CustomVisDropZones.DSS_TYPE;
    const ALLOW = mstrmojo.vi.models.CustomVisDropZones.ENUM_ALLOW_DROP_TYPE;
    const WT = mstrmojo.vi.models.editors.CustomVisEditorModel.WIDGET_TYPE;
    const CCM = mstrmojo.CUSTOM_CONTEXT_MENU;
    const DI = mstrmojo.models.template.DataInterface;

    const params = new URLSearchParams(location.search);
    const $ = (sel) => document.querySelector(sel);

    const state = {
        plugin: null,
        meta: null,
        dataset: null,
        VizClass: null,
        viz: null,
        zonesModel: null,
        defs: [],
        zones: {},
        editor: null,
        renderFinished: false,
        warnings: []
    };

    // ---- Small helpers ------------------------------------------------------------------------------

    function el(tag, attrs, ...children) {
        const node = document.createElement(tag);
        Object.entries(attrs || {}).forEach(([k, v]) => {
            if (v === undefined || v === null || v === false) {
                return;
            }
            if (k === "class") {
                node.className = v;
            } else if (k === "style" && typeof v === "object") {
                Object.assign(node.style, v);
            } else if (k.startsWith("on") && typeof v === "function") {
                node.addEventListener(k.slice(2), v);
            } else if (v === true) {
                node.setAttribute(k, "");
            } else {
                node.setAttribute(k, v);
            }
        });
        children.flat().forEach((c) => {
            if (c !== null && c !== undefined && c !== false) {
                node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
            }
        });
        return node;
    }

    function log(type, detail) {
        const text = detail === undefined ? "" : typeof detail === "string" ? detail : JSON.stringify(detail);
        const row = el("li", {class: "log-" + type.replace(/[^a-z]/gi, "")},
            el("span", {class: "log-time"}, new Date().toLocaleTimeString()),
            el("span", {class: "log-type"}, type),
            el("span", {class: "log-detail"}, text.length > 400 ? text.slice(0, 400) + "…" : text));
        const list = $("#log");
        list.insertBefore(row, list.firstChild);
        while (list.children.length > 200) {
            list.removeChild(list.lastChild);
        }
    }

    function warn(message) {
        if (!state.warnings.includes(message)) {
            state.warnings.push(message);
            renderWarnings();
        }
        log("warning", message);
    }

    function renderWarnings() {
        const box = $("#warnings");
        box.replaceChildren(...state.warnings.map((w) => el("li", {}, w)));
        box.hidden = state.warnings.length === 0;
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = el("script", {src});
            s.onload = resolve;
            s.onerror = () => reject(new Error("Could not load " + src));
            document.head.appendChild(s);
        });
    }

    function loadCss(href) {
        return new Promise((resolve) => {
            const l = el("link", {rel: "stylesheet", href});
            l.onload = resolve;
            l.onerror = () => {
                warn("Stylesheet not found: " + href);
                resolve();
            };
            document.head.appendChild(l);
        });
    }

    async function fetchXml(url) {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`${url} → HTTP ${res.status}`);
        }
        const doc = new DOMParser().parseFromString(await res.text(), "text/xml");
        const err = doc.querySelector("parsererror");
        if (err) {
            throw new Error(`${url} is not well-formed XML: ${err.textContent.slice(0, 200)}`);
        }
        return doc;
    }

    function resolveClass(path) {
        return path.split(".").reduce((obj, key) => (obj ? obj[key] : undefined), mstrmojo);
    }

    // "plugins.Foo.FooDropZones" -> {file, path}
    function classFile(pluginBase, pluginName, className) {
        const parts = className.split(".");
        if (parts.length !== 3 || parts[0] !== "plugins") {
            warn(`Class reference "${className}" should look like plugins.${pluginName}.<FileName>`);
        } else if (parts[1] !== pluginName) {
            warn(`Class reference "${className}" points at plugin folder "${parts[1]}", not "${pluginName}"`);
        }
        return pluginBase + "javascript/mojo/js/source/" + parts[parts.length - 1] + ".js";
    }

    // ---- Plugin metadata (read from the plugin's own XML) -------------------------------------------

    async function readPluginMeta(name) {
        const base = `../plugins/${name}/`;
        const visDoc = await fetchXml(base + "WEB-INF/xml/config/visualizations.xml");
        const vis = visDoc.querySelector('visualization-list[name="ajax"] > visualization') || visDoc.querySelector("visualization");
        if (!vis) {
            throw new Error("visualizations.xml has no <visualization> element");
        }
        const attr = (k) => vis.getAttribute(k);
        const styleName = attr("style-name");
        const catDoc = await fetchXml(base + "WEB-INF/xml/styleCatalog.xml");
        const style = Array.from(catDoc.querySelectorAll("Style")).find((s) => s.getAttribute("name") === styleName);
        if (!style) {
            throw new Error(`styleCatalog.xml has no <Style name="${styleName}">`);
        }
        const param = (n) => {
            const p = style.querySelector(`ActualParameter[name="${n}"]`);
            return p ? p.getAttribute("value") : null;
        };
        const mojoClass = param("mojoClassName");
        if (param("reportXMLStyle") !== "VisualizationServerJsonDataStyle") {
            warn('styleCatalog.xml: reportXMLStyle should be "VisualizationServerJsonDataStyle" (needed for thresholds in documents)');
        }
        return {
            name,
            base,
            styleName,
            desc: attr("desc") || name,
            mojoClass,
            dropZones: attr("drop-zones"),
            editorModel: attr("editor-model"),
            attributeMinimum: parseInt(attr("attribute-minimum") || "0", 10),
            metricMinimum: parseInt(attr("metric-minimum") || "0", 10),
            summary: attr("summary"),
            useCase: attr("use-case"),
            requirements: attr("requirements"),
            categories: attr("categories") || "Custom"
        };
    }

    // ---- Drop zones ---------------------------------------------------------------------------------

    function datasetObjects() {
        const ds = state.dataset;
        return ds.attributes.map((a) => ({id: a.id, n: a.name, t: DSS.ATTRIBUTE}))
            .concat(ds.metrics.map((m) => ({id: m.id, n: m.name, t: DSS.METRIC})));
    }

    function currentDefs() {
        if (state.zonesModel) {
            return state.zonesModel.getCustomDropZones() || [];
        }
        // Built-in zones used when a plugin defines no custom drop zones.
        return [
            {name: "Attributes", allowObjectType: ALLOW.ATTRIBUTE},
            {name: "Metrics", allowObjectType: ALLOW.METRIC}
        ];
    }

    function typeAllowed(def, obj) {
        return def.allowObjectType === ALLOW.ATTRIBUTE_AND_METRIC ||
            (def.allowObjectType === ALLOW.ATTRIBUTE && obj.t === DSS.ATTRIBUTE) ||
            (def.allowObjectType === ALLOW.METRIC && obj.t === DSS.METRIC);
    }

    function zoneArr(name) {
        state.zones[name] = state.zones[name] || [];
        return state.zones[name];
    }

    function applyActions(actions) {
        (actions || []).forEach((a) => {
            const arr = zoneArr(a.zone);
            a.objects.filter(Boolean).forEach((o) => {
                const at = arr.findIndex((x) => x.id === o.id);
                if (a.type === "remove") {
                    if (at >= 0) {
                        arr.splice(at, 1);
                    }
                } else if (a.type === "replace") {
                    arr.splice(a.idx || 0, 1, o);
                } else if (at < 0) {
                    arr.push(o);
                }
            });
            log("dropZoneAction", `${a.type} ${a.objects.map((o) => o && o.n).join(", ")} ${a.type === "remove" ? "from" : "to"} ${a.zone}`);
        });
    }

    function initialZones() {
        state.zones = {};
        const objs = datasetObjects();
        const attrs = objs.filter((o) => o.t === DSS.ATTRIBUTE).slice(0, 1).map((o) => ({...o, fromZone: "Rows"}));
        const metrics = objs.filter((o) => o.t === DSS.METRIC).map((o) => ({...o, fromZone: "Metrics"}));
        const zm = state.zonesModel;
        if (zm) {
            zm._svZones = state.zones;
            zm._svZoneNames = currentDefs().map((d) => d.name);
            if (typeof zm.customDropZonesTransition === "function") {
                zm.customDropZonesTransition(attrs, metrics);
                log("customDropZonesTransition", "applied the plugin's transition rules (as if switching from a grid)");
                return;
            }
        }
        // Default rule from the docs: fill zones in order, respecting type and capacity.
        attrs.concat(metrics).forEach((o) => {
            const def = currentDefs().find((d) => !d.disabled && !d.isAdditionalInfo && typeAllowed(d, o) &&
                (!d.maxCapacity || zoneArr(d.name).length < d.maxCapacity));
            if (def) {
                zoneArr(def.name).push(o);
            }
        });
    }

    function tryDrop(def, obj) {
        const zm = state.zonesModel;
        const arr = zoneArr(def.name);
        if (arr.some((o) => o.id === obj.id)) {
            return;
        }
        if (def.maxCapacity && arr.length >= def.maxCapacity) {
            log("dropRejected", `${def.name} is full (maxCapacity ${def.maxCapacity})`);
            return;
        }
        if (zm && typeof zm.shouldAllowObjectsInDropZone === "function") {
            const res = zm.shouldAllowObjectsInDropZone({n: def.name, name: def.name}, [obj], arr.length, null, {});
            if (res && res.allowedItems && res.allowedItems.length === 0) {
                log("dropRejected", `shouldAllowObjectsInDropZone refused ${obj.n} in ${def.name}`);
                return;
            }
        }
        arr.push(obj);
        log("drop", `${obj.n} → ${def.name}`);
        if (zm && typeof zm.getActionsForObjectsDropped === "function") {
            applyActions(zm.getActionsForObjectsDropped({n: def.name, name: def.name}, [obj], arr.length - 1, null, {}));
        }
        dataChanged();
    }

    function removeFromZone(def, obj) {
        const arr = zoneArr(def.name);
        const at = arr.findIndex((o) => o.id === obj.id);
        if (at >= 0) {
            arr.splice(at, 1);
        }
        log("remove", `${obj.n} ✕ ${def.name}`);
        const zm = state.zonesModel;
        if (zm && typeof zm.getActionsForObjectsRemoved === "function") {
            applyActions(zm.getActionsForObjectsRemoved({n: def.name, name: def.name}, [obj]));
        }
        dataChanged();
    }

    function renderZonesUI() {
        const box = $("#zones");
        const defs = currentDefs();
        if (state.zonesModel) {
            state.zonesModel._svZoneNames = defs.map((d) => d.name);
        }
        box.replaceChildren(...defs.map((def) => {
            const objs = zoneArr(def.name);
            const candidates = datasetObjects().filter((o) => typeAllowed(def, o) && !objs.some((x) => x.id === o.id));
            const select = el("select", {
                "aria-label": "Add to " + def.name,
                disabled: def.disabled || candidates.length === 0,
                onchange: (e) => {
                    const obj = candidates.find((o) => o.id === e.target.value);
                    if (obj) {
                        tryDrop(def, obj);
                    }
                }
            }, el("option", {value: ""}, "+ add…"), candidates.map((o) => el("option", {value: o.id}, (o.t === DSS.METRIC ? "Σ " : "▦ ") + o.n)));
            const flags = [
                def.maxCapacity ? `max ${def.maxCapacity}` : null,
                def.isAdditionalInfo ? "tooltip" : null,
                def.isColorBy ? "color by" : null,
                def.isSizeBy ? "size by" : null,
                def.disabled ? "disabled" : null
            ].filter(Boolean).join(" · ");
            return el("div", {class: "zone" + (def.disabled ? " zone-disabled" : "")},
                el("div", {class: "zone-head"}, el("strong", {}, def.name), el("span", {class: "muted"}, flags)),
                el("div", {class: "chips"}, objs.length ? objs.map((o) => el("span", {class: "chip " + (o.t === DSS.METRIC ? "chip-metric" : "chip-attr")},
                    o.n, el("button", {type: "button", "aria-label": `Remove ${o.n}`, onclick: () => removeFromZone(def, o)}, "×"))) :
                    el("span", {class: "muted"}, def.title || "empty")),
                select);
        }));
    }

    // ---- Grid built from the zones ------------------------------------------------------------------

    function buildGrid() {
        const ds = state.dataset;
        const defs = currentDefs();
        const ordered = [];
        defs.forEach((def) => zoneArr(def.name).forEach((o) => {
            if (!ordered.some((x) => x.id === o.id)) {
                ordered.push(o);
            }
        }));
        const addIds = state.zonesModel ? state.zonesModel.getAdditionalAttrIds() : [];
        const attrs = ordered.filter((o) => o.t === DSS.ATTRIBUTE && !addIds.includes(o.id));
        const addAttrs = ordered.filter((o) => o.t === DSS.ATTRIBUTE && addIds.includes(o.id));
        const metrics = ordered.filter((o) => o.t === DSS.METRIC);
        const aIdx = (o) => ds.attributes.findIndex((a) => a.id === o.id);
        const mIdx = (o) => ds.attributes.length + ds.metrics.findIndex((m) => m.id === o.id);
        const mDef = (o) => ds.metrics.find((m) => m.id === o.id);

        const groups = new Map();
        ds.rows.forEach((row) => {
            const key = attrs.map((a) => row[aIdx(a)]).join("\u0001");
            let g = groups.get(key);
            if (!g) {
                g = {elements: attrs.map((a) => row[aIdx(a)]), values: metrics.map(() => 0), sub: new Map()};
                groups.set(key, g);
            }
            metrics.forEach((m, j) => {
                g.values[j] += row[mIdx(m)];
            });
            if (addAttrs.length) {
                const sk = addAttrs.map((a) => row[aIdx(a)]).join("\u0001");
                let s = g.sub.get(sk);
                if (!s) {
                    s = {names: addAttrs.map((a) => row[aIdx(a)]), values: metrics.map(() => 0)};
                    g.sub.set(sk, s);
                }
                metrics.forEach((m, j) => {
                    s.values[j] += row[mIdx(m)];
                });
            }
        });

        const fmt = mstrmojo.models.template.formatNumber;
        return {
            attributes: attrs.map((o) => ({id: o.id, name: o.n})),
            metrics: metrics.map((o) => ({id: o.id, name: o.n, format: mDef(o).format, threshold: mDef(o).threshold})),
            additionalAttrIds: addIds,
            rows: Array.from(groups.values()).map((g) => ({
                elements: g.elements,
                values: g.values.map((v) => Math.round(v * 1000) / 1000),
                additional: addAttrs.length ? Array.from(g.sub.values()).map((s) => {
                    const mapping = {};
                    addAttrs.forEach((a, i) => {
                        mapping[a.id] = String(s.names[i]);
                    });
                    metrics.forEach((m, j) => {
                        mapping[m.id] = fmt(s.values[j], mDef(m).format);
                    });
                    return {idValueMapping: mapping};
                }) : undefined
            })),
            counts: {attributes: attrs.length + addAttrs.length, metrics: metrics.length}
        };
    }

    // ---- Rendering ----------------------------------------------------------------------------------

    let grid = null;

    function dataChanged() {
        grid = buildGrid();
        renderZonesUI();
        render();
    }

    function render() {
        const viz = state.viz;
        const frame = $("#frame");
        hideTooltip(false);
        closeMenu();
        viz.width = frame.clientWidth;
        viz.height = frame.clientHeight;
        viz.dataInterface = new DI(grid);
        viz.additionalAttrIds = grid.additionalAttrIds;
        viz._svGraphicModels = null;
        state.renderFinished = false;

        const meta = state.meta;
        const status = $("#status");
        if (grid.counts.attributes < meta.attributeMinimum || grid.counts.metrics < meta.metricMinimum) {
            viz.domNode.replaceChildren(el("div", {class: "framework-error"},
                el("strong", {}, viz.errorMessage || "Not enough data"), el("div", {}, viz.errorDetails || ""),
                el("div", {class: "muted"}, `(Framework check: needs ${meta.attributeMinimum}+ attributes and ${meta.metricMinimum}+ metrics.)`)));
            status.textContent = "Minimum attributes/metrics not met — plot() not called";
            return;
        }

        const t0 = performance.now();
        try {
            viz.plot();
        } catch (e) {
            console.error(e);
            log("error", e.message);
            viz.domNode.replaceChildren(el("pre", {class: "framework-error"}, "plot() threw: " + (e.stack || e.message)));
        }
        const ms = Math.round(performance.now() - t0);
        status.textContent = `${grid.rows.length} rows · ${grid.attributes.length} attr / ${grid.metrics.length} metric columns · plot ${ms} ms`;

        if (state.VizClass.prototype.supportNEE) {
            setTimeout(() => {
                if (!state.renderFinished) {
                    warn("supportNEE is true but plot() did not raise renderFinished within 1 s — PDF export would hang.");
                }
            }, 1000);
        }
    }

    // ---- Tooltip & context menu (simplified look-alikes) ---------------------------------------------

    let tooltipTimer = null;

    function nameOf(id) {
        const ds = state.dataset;
        const o = ds.attributes.concat(ds.metrics).find((x) => x.id === id);
        return o ? o.name : id;
    }

    function showTooltip(viz, gm, pos, fixed) {
        clearTimeout(tooltipTimer);
        const tip = $("#tooltip");
        const mapping = (gm && gm.idValueMapping) || {};
        const rows = Object.keys(mapping).map((id) => el("tr", {}, el("th", {}, nameOf(id)), el("td", {}, mapping[id])));
        const extra = gm && gm.additional ? el("div", {class: "tip-extra"},
            `${gm.additional.length} tooltip row(s):`,
            el("ul", {}, gm.additional.slice(0, 6).map((a) => el("li", {}, Object.keys(a.idValueMapping).map((id) => a.idValueMapping[id]).join(" · "))))) : null;
        tip.replaceChildren(el("table", {}, rows), extra || "");
        if (!rows.length) {
            tip.replaceChildren(el("em", {}, "graphicModel has no idValueMapping"));
        }
        tip.hidden = false;
        tip.classList.toggle("fixed", fixed);
        const x = Math.min(pos.x + 14, window.innerWidth - tip.offsetWidth - 8);
        const y = Math.min(pos.y + 14, window.innerHeight - tip.offsetHeight - 8);
        tip.style.left = x + "px";
        tip.style.top = y + "px";
    }

    function hideTooltip(delayed) {
        clearTimeout(tooltipTimer);
        const hide = () => {
            $("#tooltip").hidden = true;
        };
        if (delayed) {
            tooltipTimer = setTimeout(hide, 200);
        } else {
            hide();
        }
    }

    function closeMenu() {
        $("#menu").hidden = true;
    }

    function menuItems(viz, items, depth) {
        const out = [];
        (items || []).forEach((item) => {
            if (item.isShown === false) {
                return;
            }
            const pad = {paddingLeft: 10 + depth * 14 + "px"};
            switch (item.type) {
            case CCM.SEPARATOR:
                out.push(el("li", {class: "sep", role: "separator"}));
                break;
            case CCM.SUBMENU:
                out.push(el("li", {class: "sub", style: pad}, item.name + " ▸"));
                out.push(...menuItems(viz, item.subMenuConfig, depth + 1));
                break;
            case CCM.TOGGLE: {
                const on = item.propertyName ? viz.getProperty(item.propertyName) === "true" : !!item.currentValue;
                out.push(el("li", {role: "menuitemcheckbox", "aria-checked": String(on), style: pad, onclick: () => {
                    closeMenu();
                    if (item.propertyName) {
                        viz.setProperty(item.propertyName, on ? "false" : "true", item.config);
                    } else if (item.onClick) {
                        item.onClick(!on);
                    }
                }}, (on ? "✓ " : "   ") + item.name));
                break;
            }
            case CCM.SINGLE_SELECT_LIST: {
                const current = item.propertyName ? viz.getProperty(item.propertyName) : item.currentValue;
                (item.items || []).forEach((opt) => out.push(el("li", {role: "menuitemradio", style: pad, onclick: () => {
                    closeMenu();
                    if (item.propertyName) {
                        viz.setProperty(item.propertyName, opt.value, item.config);
                    } else if (item.onClick) {
                        item.onClick(opt.value);
                    }
                }}, (String(current) === String(opt.value) ? "● " : "○ ") + opt.name)));
                break;
            }
            case CCM.NORMAL:
                out.push(el("li", {role: "menuitem", style: pad, class: item.isDisabled ? "disabled" : "", onclick: () => {
                    closeMenu();
                    if (!item.isDisabled && item.onClick) {
                        item.onClick();
                    }
                }}, item.name));
                break;
            default:
                // Common (framework) items: shown by their enum value; the real framework runs them.
                out.push(el("li", {role: "menuitem", class: "common", style: pad, onclick: () => {
                    closeMenu();
                    log("commonMenu", item.type);
                }}, String(item.type)));
            }
        });
        return out;
    }

    function showContextMenu(viz, config, pos) {
        const menu = $("#menu");
        const items = [];
        if (viz._svUseAsFilter) {
            items.push(el("li", {class: "common", onclick: () => {
                closeMenu();
                log("commonMenu", "Use as Filter");
            }}, "Use as Filter"));
        }
        if (config) {
            items.push(...menuItems(viz, config.common, 0));
            items.push(...menuItems(viz, config.custom, 0));
        } else {
            items.push(el("li", {class: "muted"}, "(no getContextMenuConfig)"));
        }
        menu.replaceChildren(...items);
        menu.hidden = false;
        menu.style.left = Math.min(pos.x, window.innerWidth - menu.offsetWidth - 8) + "px";
        menu.style.top = Math.min(pos.y, window.innerHeight - menu.offsetHeight - 8) + "px";
    }

    // ---- Format panel (classic CustomVisEditorModel widgets) ----------------------------------------

    function childDisabled(w, childName) {
        return (w.items || []).some((c) => c.childName === childName && c.disabled);
    }

    function renderWidget(w, viz, seen) {
        const name = w.propertyName;
        const value = name ? viz.getProperty(name) : undefined;
        const set = (v) => viz.setProperty(name, v, w.config);
        const style = w.width ? {flexBasis: w.width} : null;
        if (name) {
            if (seen.has(name)) {
                warn(`Duplicate propertyName "${name}" in getCustomProperty()`);
            }
            seen.add(name);
            const defaults = viz.getDefaultProperties();
            if (![WT.BUTTONBAR, WT.CHECKLIST].includes(w.style) && !(name in defaults)) {
                warn(`propertyName "${name}" has no default — add it to setDefaultPropertyValues()`);
            }
        }
        switch (w.style) {
        case WT.EDITORGROUP:
            return el("div", {class: "pg"}, (w.items || []).map((c) => renderWidget(c, viz, seen)));
        case WT.TWOCOLUMN:
            return el("div", {class: "two"}, (w.items || []).map((c) => renderWidget(c, viz, seen)));
        case WT.LABEL:
            return el("span", {class: "lbl", style}, w.labelText || "");
        case WT.CHECKBOXANDLABEL:
            return el("label", {class: "chk", style}, el("input", {type: "checkbox", checked: value === "true", disabled: w.disabled,
                onchange: (e) => set(e.target.checked ? "true" : "false")}), " ", w.labelText || name);
        case WT.PULLDOWN:
            return el("select", {style, disabled: w.disabled, "aria-label": name, onchange: (e) => set(e.target.value)},
                (w.items || []).map((i) => el("option", {value: i.value, selected: String(i.value) === String(value)}, i.name)));
        case WT.TEXTBOX:
            return el("input", {type: "text", style, value: value || "", disabled: w.disabled, "aria-label": name, onchange: (e) => set(e.target.value)});
        case WT.STEPPER:
            return el("input", {type: "number", style, value: value || "0", min: w.min, max: w.max, step: 1, disabled: w.disabled, "aria-label": name,
                onchange: (e) => set(String(parseInt(e.target.value, 10) || 0))});
        case WT.COMBOBOX: {
            const id = "dl-" + name;
            return el("span", {style}, el("input", {type: "text", list: id, value: value || "", "aria-label": name, onchange: (e) => set(e.target.value)}),
                el("datalist", {id}, (w.items || []).map((i) => el("option", {value: i.name}))));
        }
        case WT.FILLGROUP: {
            const v = value || {};
            return el("span", {class: "grp", style},
                el("input", {type: "color", value: v.fillColor || "#000000", disabled: w.disabled || childDisabled(w, "fillColor"), "aria-label": name + " color",
                    onchange: (e) => set({...v, fillColor: e.target.value})}),
                childDisabled(w, "fillAlpha") ? null : el("input", {type: "number", min: 0, max: 100, value: v.fillAlpha || "100", "aria-label": name + " alpha",
                    onchange: (e) => set({...v, fillAlpha: e.target.value})}));
        }
        case WT.LINEGROUP: {
            const v = value || {};
            return el("span", {class: "grp", style},
                el("input", {type: "color", value: v.lineColor || "#000000", "aria-label": name + " color", onchange: (e) => set({...v, lineColor: e.target.value})}),
                el("input", {type: "text", value: v.lineStyle || "", placeholder: "lineStyle", "aria-label": name + " style", onchange: (e) => set({...v, lineStyle: e.target.value})}));
        }
        case WT.CHARACTERGROUP: {
            const v = value || {};
            const part = (key, input) => (childDisabled(w, key) ? null : input);
            return el("span", {class: "grp", style},
                part("fontFamily", el("input", {type: "text", value: v.fontFamily || "", placeholder: "fontFamily", "aria-label": name + " family", onchange: (e) => set({...v, fontFamily: e.target.value})})),
                part("fontSize", el("input", {type: "text", value: v.fontSize || "", placeholder: "fontSize", "aria-label": name + " size", onchange: (e) => set({...v, fontSize: e.target.value})})),
                part("fontColor", el("input", {type: "color", value: v.fontColor || "#000000", "aria-label": name + " color", onchange: (e) => set({...v, fontColor: e.target.value})})),
                part("fontStyle", el("input", {type: "text", value: v.fontStyle || "", placeholder: "fontStyle", "aria-label": name + " style", onchange: (e) => set({...v, fontStyle: e.target.value})})));
        }
        case WT.BUTTONBAR:
        case WT.CHECKLIST: {
            const v = value && typeof value === "object" ? value : {};
            return el("span", {class: "grp", style}, (w.items || []).map((i) => el("label", {class: "chk"},
                el("input", {type: w.multiSelect ? "checkbox" : "radio", name: "bb-" + name, checked: v[i.propertyName] === "true",
                    onchange: (e) => {
                        const next = w.multiSelect ? {...v} : {};
                        (w.items || []).forEach((x) => {
                            next[x.propertyName] = next[x.propertyName] || "false";
                        });
                        next[i.propertyName] = e.target.checked ? "true" : "false";
                        set(next);
                    }}), " ", i.labelText)));
        }
        case WT.BUTTON:
            return el("button", {type: "button", style, onclick: () => w.callback && w.callback()}, w.labelText || "Button");
        default:
            return el("span", {class: "muted", style}, `[${w.style} not mocked]`);
        }
    }

    function renderPropsUI() {
        const box = $("#props");
        if (!state.editor) {
            box.replaceChildren(el("p", {class: "muted"}, "No editor-model in visualizations.xml."));
            return;
        }
        let sections;
        try {
            sections = state.editor.getCustomProperty() || [];
        } catch (e) {
            box.replaceChildren(el("pre", {class: "framework-error"}, "getCustomProperty() threw: " + e.message));
            return;
        }
        const seen = new Set();
        box.replaceChildren(...sections.map((s) => el("section", {}, el("h3", {}, s.name || ""),
            (s.value || []).map((w) => renderWidget(w, state.viz, seen)))));
    }

    // ---- Gallery preview ----------------------------------------------------------------------------

    function renderGallery() {
        const m = state.meta;
        const req = (m.requirements || "").replace(/###/g, "").replace(/##/g, "▦ ").replace(/#/g, "Σ ");
        $("#gallery").replaceChildren(
            el("div", {class: "mstrmojo-VIGallery"}, el("div", {class: "mstrmojo-VIGalleryList"},
                el("div", {class: "item ic-" + m.styleName, title: m.desc}, el("div", {}, el("div", {}))))),
            el("div", {},
                el("strong", {}, m.desc), el("span", {class: "muted"}, ` · ${m.categories}`),
                m.summary ? el("div", {}, m.summary) : null,
                m.useCase ? el("div", {class: "muted"}, m.useCase) : null,
                req ? el("div", {class: "muted"}, req) : null,
                !(m.summary && m.useCase && m.requirements) ? el("div", {class: "muted"}, "(gallery tooltip needs summary + use-case + requirements together)") : null));
    }

    // ---- Wiring -------------------------------------------------------------------------------------

    function wrapEvent(e) {
        return {e, getTarget: () => e.target};
    }

    function wireEvents(viz) {
        const node = viz.domNode;
        node.addEventListener("click", (e) => {
            closeMenu();
            if (typeof viz.onclick === "function") {
                viz.onclick(wrapEvent(e));
            }
        });
        node.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            if (typeof viz.oncontextmenu === "function") {
                viz.oncontextmenu(wrapEvent(e));
            }
        });
        node.addEventListener("mousemove", (e) => {
            if (typeof viz.onmousemove === "function") {
                viz.onmousemove(wrapEvent(e));
            }
        });
        node.addEventListener("mouseleave", () => hideTooltip(true));
        document.addEventListener("click", (e) => {
            if (!$("#menu").contains(e.target) && !node.contains(e.target)) {
                closeMenu();
            }
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                closeMenu();
                hideTooltip(false);
            }
        });

        let pending = false;
        new ResizeObserver(() => {
            if (!pending && grid) {
                pending = true;
                requestAnimationFrame(() => {
                    pending = false;
                    render();
                });
            }
        }).observe($("#frame"));
    }

    function setTheme(dark) {
        document.documentElement.dataset.theme = dark ? "dark" : "light";
        window.mstrApp._svTheme = dark ? "mojo-theme-dark" : "";
        $("#theme").checked = dark;
    }

    function navigate(changes) {
        const next = new URLSearchParams(location.search);
        Object.entries(changes).forEach(([k, v]) => next.set(k, v));
        location.search = next.toString();
    }

    window.SvHarness = {
        log,
        render: () => render(),
        onPropertiesChanged: () => renderPropsUI(),
        showTooltip,
        hideTooltip,
        showContextMenu,
        onRaiseEvent: (viz, evt) => {
            if (evt && evt.name === "renderFinished") {
                state.renderFinished = true;
            }
        }
    };

    async function main() {
        const plugins = await fetch("plugins.json").then((r) => r.json());
        state.plugin = params.get("plugin") || plugins[0];
        state.dataset = window.SV_DATASETS.find((d) => d.id === params.get("dataset")) || window.SV_DATASETS[0];
        setTheme(params.get("theme") === "dark");

        $("#plugin").replaceChildren(...plugins.map((p) => el("option", {value: p, selected: p === state.plugin}, p)));
        $("#dataset").replaceChildren(...window.SV_DATASETS.map((d) => el("option", {value: d.id, selected: d === state.dataset}, d.name)));
        $("#plugin").addEventListener("change", (e) => navigate({plugin: e.target.value}));
        $("#dataset").addEventListener("change", (e) => navigate({dataset: e.target.value}));
        $("#theme").addEventListener("change", (e) => {
            setTheme(e.target.checked);
            render();
        });
        $("#reset-zones").addEventListener("click", () => {
            initialZones();
            dataChanged();
        });
        $("#export").addEventListener("click", () => {
            window.mstrApp.isExporting = true;
            render();
            window.mstrApp.isExporting = false;
            log("export", state.renderFinished ? "renderFinished raised during export render ✓" : "renderFinished NOT raised during export render");
        });
        $("#clear-log").addEventListener("click", () => $("#log").replaceChildren());

        const meta = state.meta = await readPluginMeta(state.plugin);
        document.title = `${meta.desc} · Strategy viz harness`;
        $("#plugin-title").textContent = meta.desc;

        await Promise.all([loadCss(meta.base + "style/global.css"), loadCss(meta.base + "style/Html5ViPage.css")]);
        if (meta.dropZones) {
            await loadScript(classFile(meta.base, meta.name, meta.dropZones));
        }
        if (meta.editorModel) {
            await loadScript(classFile(meta.base, meta.name, meta.editorModel));
        }
        await loadScript(classFile(meta.base, meta.name, meta.mojoClass));

        const VizClass = state.VizClass = resolveClass(meta.mojoClass);
        if (typeof VizClass !== "function") {
            throw new Error(`mstrmojo.${meta.mojoClass} is not defined after loading its script — check scriptClass and the declare() target.`);
        }
        const expectedScriptClass = "mstrmojo." + meta.mojoClass;
        if (VizClass.prototype.scriptClass !== expectedScriptClass) {
            warn(`scriptClass is "${VizClass.prototype.scriptClass}", expected "${expectedScriptClass}"`);
        }

        for (const lib of VizClass.prototype.externalLibraries || []) {
            log("externalLibrary", lib.url);
            await loadScript(lib.url);
        }

        if (meta.dropZones) {
            const DZ = resolveClass(meta.dropZones);
            if (typeof DZ !== "function") {
                throw new Error(`mstrmojo.${meta.dropZones} is not defined`);
            }
            state.zonesModel = new DZ({});
        }

        const domNode = $("#viz");
        domNode.className = "custom-vis-layout " + (VizClass.prototype.cssClass || "");
        const viz = state.viz = new VizClass({domNode, k: "W1", zonesModel: state.zonesModel || undefined});
        if (state.zonesModel) {
            state.zonesModel.host = viz;
        }

        if (meta.editorModel) {
            const EM = resolveClass(meta.editorModel);
            if (typeof EM !== "function") {
                throw new Error(`mstrmojo.${meta.editorModel} is not defined`);
            }
            state.editor = new EM({host: viz});
        }

        renderGallery();
        initialZones();
        grid = buildGrid();
        renderZonesUI();
        render();
        renderPropsUI();
        wireEvents(viz);
    }

    main().catch((e) => {
        console.error(e);
        $("#viz").replaceChildren(el("pre", {class: "framework-error"}, "Harness could not load the plugin:\n" + (e.stack || e.message)));
        log("error", e.message);
    });
}());
