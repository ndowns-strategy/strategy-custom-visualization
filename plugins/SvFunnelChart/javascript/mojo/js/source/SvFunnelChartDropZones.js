(function () {
    // Define this code as a plugin in the mstrmojo object
    if (!mstrmojo.plugins.SvFunnelChart) {
        mstrmojo.plugins.SvFunnelChart = {};
    }

    mstrmojo.requiresCls(
        "mstrmojo.vi.models.CustomVisDropZones",
        "mstrmojo.array"
    );

    /**
     * Drop zones for the funnel chart: the stages, the one metric that sizes the bars,
     * and anything extra for the tooltip.
     *
     * @class mstrmojo.plugins.SvFunnelChart.SvFunnelChartDropZones
     * @extends mstrmojo.vi.models.CustomVisDropZones
     */
    mstrmojo.plugins.SvFunnelChart.SvFunnelChartDropZones = mstrmojo.declare(
        mstrmojo.vi.models.CustomVisDropZones,
        null,
        {
            scriptClass: "mstrmojo.plugins.SvFunnelChart.SvFunnelChartDropZones",

            getCustomDropZones: function getCustomDropZones() {
                var ENUM_ALLOW_DROP_TYPE = mstrmojo.vi.models.CustomVisDropZones.ENUM_ALLOW_DROP_TYPE;
                return [
                    {
                        name: "Stage",
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
            },

            // When switching from another visualization: attributes -> Stage, first metric -> Value,
            // remaining metrics -> Tooltip.
            customDropZonesTransition: function customDropZonesTransition(attributes, metrics) {
                this.transitionObjectsToZone("Stage", attributes);
                if (metrics[0]) {
                    this.transitionObjectsToZone("Value", metrics[0]);
                }
                if (metrics.length > 1) {
                    this.transitionObjectsToZone("Tooltip", metrics.slice(1));
                }
            }
        }
    );
}());
//@ sourceURL=SvFunnelChartDropZones.js
