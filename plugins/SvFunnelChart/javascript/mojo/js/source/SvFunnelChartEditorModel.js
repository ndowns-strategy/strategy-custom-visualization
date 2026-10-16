(function () {
    // Define this code as a plugin in the mstrmojo object
    if (!mstrmojo.plugins.SvFunnelChart) {
        mstrmojo.plugins.SvFunnelChart = {};
    }

    mstrmojo.requiresCls(
        "mstrmojo.vi.models.editors.CustomVisEditorModel"
    );

    var $WT = mstrmojo.vi.models.editors.CustomVisEditorModel.WIDGET_TYPE;

    /**
     * Format panel for the funnel chart. Property names and defaults live in SvFunnelChart.js (DEFAULT_PROPS).
     *
     * @class mstrmojo.plugins.SvFunnelChart.SvFunnelChartEditorModel
     * @extends mstrmojo.vi.models.editors.CustomVisEditorModel
     */
    mstrmojo.plugins.SvFunnelChart.SvFunnelChartEditorModel = mstrmojo.declare(
        mstrmojo.vi.models.editors.CustomVisEditorModel,
        null,
        {
            scriptClass: "mstrmojo.plugins.SvFunnelChart.SvFunnelChartEditorModel",

            getCustomProperty: function getCustomProperty() {
                return [{
                    name: "Funnel Chart",
                    value: [
                        {
                            style: $WT.EDITORGROUP,
                            items: [
                                {
                                    style: $WT.TWOCOLUMN,
                                    items: [
                                        {style: $WT.LABEL, width: "40%", labelText: "Bar labels"},
                                        {
                                            style: $WT.PULLDOWN,
                                            width: "60%",
                                            propertyName: "labelMode",
                                            items: [
                                                {name: "Value", value: "value"},
                                                {name: "% of first stage", value: "percent"},
                                                {name: "Value and %", value: "both"},
                                                {name: "None", value: "none"}
                                            ]
                                        }
                                    ]
                                },
                                {
                                    style: $WT.TWOCOLUMN,
                                    items: [
                                        {style: $WT.LABEL, width: "40%", labelText: "Order"},
                                        {
                                            style: $WT.PULLDOWN,
                                            width: "60%",
                                            propertyName: "sortOrder",
                                            items: [
                                                {name: "Stage order (data)", value: "none"},
                                                {name: "Largest first", value: "desc"}
                                            ]
                                        }
                                    ]
                                },
                                {
                                    style: $WT.CHECKBOXANDLABEL,
                                    propertyName: "showBrackets",
                                    labelText: "Show first / last % brackets"
                                }
                            ]
                        },
                        {
                            style: $WT.EDITORGROUP,
                            items: [
                                {
                                    style: $WT.TWOCOLUMN,
                                    items: [
                                        {style: $WT.LABEL, width: "40%", labelText: "Bar color"},
                                        {
                                            style: $WT.FILLGROUP,
                                            width: "60%",
                                            propertyName: "barFill",
                                            items: [{childName: "fillAlpha", disabled: true}]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }];
            }
        }
    );
}());
//@ sourceURL=SvFunnelChartEditorModel.js
