(function () {
    // Define this code as a plugin in the mstrmojo object
    if (!mstrmojo.plugins.SvTemplate) {
        mstrmojo.plugins.SvTemplate = {};
    }

    mstrmojo.requiresCls(
        "mstrmojo.vi.models.CustomVisDropZones",
        "mstrmojo.array"
    );

    /**
     * Drop zones shown in the Editor panel, top to bottom. Grid columns arrive in this zone order.
     *
     * @class mstrmojo.plugins.SvTemplate.SvTemplateDropZones
     * @extends mstrmojo.vi.models.CustomVisDropZones
     */
    mstrmojo.plugins.SvTemplate.SvTemplateDropZones = mstrmojo.declare(
        mstrmojo.vi.models.CustomVisDropZones,
        null,
        {
            scriptClass: "mstrmojo.plugins.SvTemplate.SvTemplateDropZones",

            getCustomDropZones: function getCustomDropZones() {
                var ENUM_ALLOW_DROP_TYPE = mstrmojo.vi.models.CustomVisDropZones.ENUM_ALLOW_DROP_TYPE;
                return [
                    {
                        name: "Category",
                        title: mstrmojo.desc(13828, "Drag attributes here"),
                        allowObjectType: ENUM_ALLOW_DROP_TYPE.ATTRIBUTE
                    }, {
                        name: "Value",
                        title: mstrmojo.desc(13827, "Drag metrics here"),
                        maxCapacity: 1,
                        allowObjectType: ENUM_ALLOW_DROP_TYPE.METRIC
                    }, {
                        name: "Tooltip",
                        isAdditionalInfo: true,
                        title: mstrmojo.desc(13258, "Drag objects here"),
                        allowObjectType: ENUM_ALLOW_DROP_TYPE.ATTRIBUTE_AND_METRIC
                    }
                ];
            },

            shouldAllowObjectsInDropZone: function shouldAllowObjectsInDropZone(zone, dragObjects, idx, edge, context) {
                return {allowedItems: dragObjects};
            },

            getActionsForObjectsDropped: function getActionsForObjectsDropped(zone, droppedObjects, idx, replaceObject, extras) {
                return [];
            },

            getActionsForObjectsRemoved: function getActionsForObjectsRemoved(zone, objects) {
                return [];
            }
        }
    );
}());
//@ sourceURL=SvTemplateDropZones.js
