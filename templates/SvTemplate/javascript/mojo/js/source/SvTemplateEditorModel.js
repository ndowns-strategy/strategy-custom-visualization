(function () {
    // Define this code as a plugin in the mstrmojo object
    if (!mstrmojo.plugins.SvTemplate) {
        mstrmojo.plugins.SvTemplate = {};
    }

    mstrmojo.requiresCls(
        "mstrmojo.vi.models.editors.CustomVisEditorModel"
    );

    var $WT = mstrmojo.vi.models.editors.CustomVisEditorModel.WIDGET_TYPE;

    /**
     * Format panel controls. Each propertyName must also have a default in DEFAULT_PROPS (SvTemplate.js).
     *
     * @class mstrmojo.plugins.SvTemplate.SvTemplateEditorModel
     * @extends mstrmojo.vi.models.editors.CustomVisEditorModel
     */
    mstrmojo.plugins.SvTemplate.SvTemplateEditorModel = mstrmojo.declare(
        mstrmojo.vi.models.editors.CustomVisEditorModel,
        null,
        {
            scriptClass: "mstrmojo.plugins.SvTemplate.SvTemplateEditorModel",

            getCustomProperty: function getCustomProperty() {
                return [{
                    name: "__SV_TITLE__",
                    value: [{
                        style: $WT.EDITORGROUP,
                        items: [
                            {style: $WT.CHECKBOXANDLABEL, propertyName: "showValues", labelText: "Show values"},
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
                    }]
                }];
            }
        }
    );
}());
//@ sourceURL=SvTemplateEditorModel.js
