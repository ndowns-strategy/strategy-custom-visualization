(function () {
    // Define this code as a plugin in the mstrmojo object
    if (!mstrmojo.plugins.SvKpiBenchmark) {
        mstrmojo.plugins.SvKpiBenchmark = {};
    }

    mstrmojo.requiresCls(
        "mstrmojo.vi.models.CustomVisDropZones",
        "mstrmojo.array"
    );

    var $ARR = mstrmojo.array;

    /**
     * Drop zones for the KPI benchmark period comparison: the period attribute (Timeline), the metric
     * shown as the KPI (Value), the metric it is compared against (Benchmark) and extra tooltip objects.
     *
     * Metric columns arrive in drop-zone order (Value, then Benchmark, then Tooltip), so SvKpiBenchmark
     * reads them positionally; the same metric is therefore not allowed in both Value and Benchmark.
     *
     * @class mstrmojo.plugins.SvKpiBenchmark.SvKpiBenchmarkDropZones
     * @extends mstrmojo.vi.models.CustomVisDropZones
     */
    mstrmojo.plugins.SvKpiBenchmark.SvKpiBenchmarkDropZones = mstrmojo.declare(
        mstrmojo.vi.models.CustomVisDropZones,
        null,
        {
            scriptClass: "mstrmojo.plugins.SvKpiBenchmark.SvKpiBenchmarkDropZones",

            getCustomDropZones: function getCustomDropZones() {
                var ENUM_ALLOW_DROP_TYPE = mstrmojo.vi.models.CustomVisDropZones.ENUM_ALLOW_DROP_TYPE;
                return [
                    {
                        name: "Timeline",
                        title: mstrmojo.desc(13828, "Drag attributes here"),
                        maxCapacity: 1,
                        allowObjectType: ENUM_ALLOW_DROP_TYPE.ATTRIBUTE
                    }, {
                        name: "Value",
                        title: mstrmojo.desc(13827, "Drag metrics here"),
                        maxCapacity: 1,
                        allowObjectType: ENUM_ALLOW_DROP_TYPE.METRIC
                    }, {
                        name: "Benchmark",
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
                var me = this;
                return {
                    allowedItems: $ARR.filter(dragObjects, function (object) {
                        switch (me.getDropZoneName(zone)) {
                        case "Value":
                            return !me.isObjectInZone(object, "Benchmark");
                        case "Benchmark":
                            return !me.isObjectInZone(object, "Value");
                        default:
                            return true;
                        }
                    })
                };
            },

            getActionsForObjectsDropped: function getActionsForObjectsDropped(zone, droppedObjects, idx, replaceObject, extras) {
                return [];
            },

            getActionsForObjectsRemoved: function getActionsForObjectsRemoved(zone, objects) {
                return [];
            },

            // When switching from another visualization: first attribute -> Timeline, first metric -> Value,
            // second metric -> Benchmark, everything else -> Tooltip.
            customDropZonesTransition: function customDropZonesTransition(attributes, metrics) {
                if (attributes[0]) {
                    this.transitionObjectsToZone("Timeline", attributes[0]);
                }
                if (attributes.length > 1) {
                    this.transitionObjectsToZone("Tooltip", attributes.slice(1));
                }
                if (metrics[0]) {
                    this.transitionObjectsToZone("Value", metrics[0]);
                }
                if (metrics[1]) {
                    this.transitionObjectsToZone("Benchmark", metrics[1]);
                }
                if (metrics.length > 2) {
                    this.transitionObjectsToZone("Tooltip", metrics.slice(2));
                }
            },

            getDefaultTooltipOrder: function getDefaultTooltipOrder() {
                var SUFFIX = mstrmojo.vi.models.CustomVisDropZones.CUSTOM_DZ_SUFFIX;
                return [
                    ["Timeline", "Tooltip" + SUFFIX.ATTRIBUTE],
                    ["Value", "Benchmark", "Tooltip" + SUFFIX.METRIC]
                ];
            }
        }
    );
}());
//@ sourceURL=SvKpiBenchmarkDropZones.js
