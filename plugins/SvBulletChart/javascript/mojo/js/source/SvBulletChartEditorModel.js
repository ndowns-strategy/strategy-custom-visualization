(function () {
    // Define this code as a plugin in the mstrmojo object
    if (!mstrmojo.plugins.SvBulletChart) {
        mstrmojo.plugins.SvBulletChart = {};
    }

    mstrmojo.requiresCls(
        "mstrmojo.vi.models.editors.CustomVisEditorModel"
    );

    var $WT = mstrmojo.vi.models.editors.CustomVisEditorModel.WIDGET_TYPE;

    /**
     * Format panel for the bullet chart. Property names and defaults live in SvBulletChart.js (DEFAULT_PROPS).
     * No callbacks are configured, so every change re-runs plot().
     *
     * @class mstrmojo.plugins.SvBulletChart.SvBulletChartEditorModel
     * @extends mstrmojo.vi.models.editors.CustomVisEditorModel
     */
    mstrmojo.plugins.SvBulletChart.SvBulletChartEditorModel = mstrmojo.declare(
        mstrmojo.vi.models.editors.CustomVisEditorModel,
        null,
        {
            scriptClass: "mstrmojo.plugins.SvBulletChart.SvBulletChartEditorModel",

            getCustomProperty: function getCustomProperty() {
                return [{
                    name: "Bullet Chart",
                    value: [
                        {
                            style: $WT.EDITORGROUP,
                            items: [
                                {
                                    style: $WT.TWOCOLUMN,
                                    items: [
                                        {style: $WT.LABEL, width: "40%", labelText: "Sort"},
                                        {
                                            style: $WT.PULLDOWN,
                                            width: "60%",
                                            propertyName: "sortOrder",
                                            items: [
                                                {name: "Data order", value: "none"},
                                                {name: "Actual, high to low", value: "actualDesc"},
                                                {name: "% of target, high to low", value: "attainmentDesc"},
                                                {name: "% of target, low to high", value: "attainmentAsc"}
                                            ]
                                        }
                                    ]
                                },
                                {style: $WT.CHECKBOXANDLABEL, propertyName: "showValues", labelText: "Show value labels"},
                                {style: $WT.CHECKBOXANDLABEL, propertyName: "showAttainment", labelText: "Show % of target"}
                            ]
                        },
                        {
                            style: $WT.EDITORGROUP,
                            items: [
                                {style: $WT.LABEL, labelText: "Performance bands (% of target)"},
                                {
                                    style: $WT.TWOCOLUMN,
                                    items: [
                                        {style: $WT.LABEL, width: "60%", labelText: "Poor below"},
                                        {style: $WT.STEPPER, width: "40%", propertyName: "poorBelow", min: 0, max: 300}
                                    ]
                                },
                                {
                                    style: $WT.TWOCOLUMN,
                                    items: [
                                        {style: $WT.LABEL, width: "60%", labelText: "Good from"},
                                        {style: $WT.STEPPER, width: "40%", propertyName: "goodFrom", min: 0, max: 300}
                                    ]
                                },
                                {style: $WT.CHECKBOXANDLABEL, propertyName: "showBands", labelText: "Show bands"}
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
                                },
                                {
                                    style: $WT.CHECKBOXANDLABEL,
                                    propertyName: "useThresholdColors",
                                    labelText: "Use metric threshold colors"
                                }
                            ]
                        }
                    ]
                }];
            }
        }
    );
}());
//@ sourceURL=SvBulletChartEditorModel.js
