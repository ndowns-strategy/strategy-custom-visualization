(function () {
    // Define this code as a plugin in the mstrmojo object
    if (!mstrmojo.plugins.SvKpiBenchmark) {
        mstrmojo.plugins.SvKpiBenchmark = {};
    }

    mstrmojo.requiresCls(
        "mstrmojo.vi.models.editors.CustomVisEditorModel"
    );

    var $WT = mstrmojo.vi.models.editors.CustomVisEditorModel.WIDGET_TYPE;

    function row(label, control) {
        control.width = "55%";
        return {
            style: $WT.TWOCOLUMN,
            items: [{style: $WT.LABEL, width: "45%", labelText: label}, control]
        };
    }

    function color(propertyName) {
        return {style: $WT.FILLGROUP, propertyName: propertyName, items: [{childName: "fillAlpha", disabled: true}]};
    }

    /**
     * Format panel, grouped like Sigma's KPI chart: Value, Comparison, Trend, Layout.
     * Property names and defaults live in SvKpiBenchmark.js (DEFAULT_PROPS).
     *
     * @class mstrmojo.plugins.SvKpiBenchmark.SvKpiBenchmarkEditorModel
     * @extends mstrmojo.vi.models.editors.CustomVisEditorModel
     */
    mstrmojo.plugins.SvKpiBenchmark.SvKpiBenchmarkEditorModel = mstrmojo.declare(
        mstrmojo.vi.models.editors.CustomVisEditorModel,
        null,
        {
            scriptClass: "mstrmojo.plugins.SvKpiBenchmark.SvKpiBenchmarkEditorModel",

            getCustomProperty: function getCustomProperty() {
                var host = this.getHost(),
                    trendOff = host && host.getProperty("showTrend") === "false",
                    labelOff = host && host.getProperty("showCompLabel") === "false";
                return [
                    {
                        name: "Value",
                        value: [{
                            style: $WT.EDITORGROUP,
                            items: [
                                row("Display", {
                                    style: $WT.PULLDOWN,
                                    propertyName: "displayType",
                                    items: [
                                        {name: "Latest period", value: "latest"},
                                        {name: "Total of all periods", value: "total"}
                                    ]
                                }),
                                row("Font size (0 = auto)", {style: $WT.STEPPER, propertyName: "valueFontSize", min: 0, max: 160}),
                                {style: $WT.CHECKBOXANDLABEL, propertyName: "valueBold", labelText: "Bold"},
                                {style: $WT.CHECKBOXANDLABEL, propertyName: "useValueColor", labelText: "Custom text color"},
                                row("Text color", color("valueColor"))
                            ]
                        }]
                    },
                    {
                        name: "Comparison",
                        value: [{
                            style: $WT.EDITORGROUP,
                            items: [
                                row("Display", {
                                    style: $WT.PULLDOWN,
                                    propertyName: "compDisplay",
                                    items: [
                                        {name: "% difference from", value: "pctDiff"},
                                        {name: "Difference from", value: "diff"},
                                        {name: "% of", value: "pctOf"},
                                        {name: "Absolute", value: "absolute"}
                                    ]
                                }),
                                row("Direction", {
                                    style: $WT.PULLDOWN,
                                    propertyName: "direction",
                                    items: [
                                        {name: "Higher is better", value: "higher"},
                                        {name: "Lower is better", value: "lower"},
                                        {name: "None", value: "none"}
                                    ]
                                }),
                                row("Good color", color("goodColor")),
                                row("Neutral color", color("neutralColor")),
                                row("Bad color", color("badColor")),
                                {style: $WT.CHECKBOXANDLABEL, propertyName: "showCompLabel", labelText: "Show label"},
                                row("Label text", {style: $WT.TEXTBOX, propertyName: "compLabel", disabled: labelOff}),
                                {style: $WT.LABEL, labelText: "Empty = \"vs {benchmark} {period}\""}
                            ]
                        }]
                    },
                    {
                        name: "Trend",
                        value: [{
                            style: $WT.EDITORGROUP,
                            items: [
                                {style: $WT.CHECKBOXANDLABEL, propertyName: "showTrend", labelText: "Show trend"},
                                row("Shape", {
                                    style: $WT.PULLDOWN,
                                    propertyName: "trendShape",
                                    disabled: trendOff,
                                    items: [
                                        {name: "Line", value: "line"},
                                        {name: "Area", value: "area"}
                                    ]
                                }),
                                row("Value line", color("valueLineColor")),
                                {style: $WT.CHECKBOXANDLABEL, propertyName: "showBenchmarkTrend", labelText: "Show benchmark line"},
                                row("Benchmark line", color("benchLineColor")),
                                {style: $WT.CHECKBOXANDLABEL, propertyName: "showTimelineAxis", labelText: "Show timeline axis"}
                            ]
                        }]
                    },
                    {
                        name: "Layout",
                        value: [{
                            style: $WT.EDITORGROUP,
                            items: [
                                row("Alignment", {
                                    style: $WT.PULLDOWN,
                                    propertyName: "align",
                                    items: [
                                        {name: "Left", value: "left"},
                                        {name: "Center", value: "center"},
                                        {name: "Right", value: "right"}
                                    ]
                                }),
                                row("Comparison position", {
                                    style: $WT.PULLDOWN,
                                    propertyName: "compPosition",
                                    items: [
                                        {name: "Below", value: "below"},
                                        {name: "Right", value: "right"}
                                    ]
                                })
                            ]
                        }]
                    }
                ];
            }
        }
    );
}());
//@ sourceURL=SvKpiBenchmarkEditorModel.js
