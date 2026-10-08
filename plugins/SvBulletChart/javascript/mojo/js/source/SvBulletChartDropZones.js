(function () {
    // Define this code as a plugin in the mstrmojo object
    if (!mstrmojo.plugins.SvBulletChart) {
        mstrmojo.plugins.SvBulletChart = {};
    }

    mstrmojo.requiresCls(
        "mstrmojo.vi.models.CustomVisDropZones",
        "mstrmojo.array"
    );

    var $ARR = mstrmojo.array;

    /**
     * Drop zones for the bullet chart.
     *
     * Metric columns arrive in the grid in drop-zone order (Actual, then Target, then Tooltip),
     * so SvBulletChart reads them positionally. To keep that reliable, the same metric is not
     * allowed in both Actual and Target.
     *
     * @class mstrmojo.plugins.SvBulletChart.SvBulletChartDropZones
     * @extends mstrmojo.vi.models.CustomVisDropZones
     */
    mstrmojo.plugins.SvBulletChart.SvBulletChartDropZones = mstrmojo.declare(
        mstrmojo.vi.models.CustomVisDropZones,
        null,
        {
            scriptClass: "mstrmojo.plugins.SvBulletChart.SvBulletChartDropZones",

            getCustomDropZones: function getCustomDropZones() {
                var ENUM_ALLOW_DROP_TYPE = mstrmojo.vi.models.CustomVisDropZones.ENUM_ALLOW_DROP_TYPE;
                return [
                    {
                        name: "Category",
                        title: mstrmojo.desc(13828, "Drag attributes here"),
                        allowObjectType: ENUM_ALLOW_DROP_TYPE.ATTRIBUTE
                    }, {
                        name: "Actual",
                        title: mstrmojo.desc(13827, "Drag metrics here"),
                        maxCapacity: 1,
                        allowObjectType: ENUM_ALLOW_DROP_TYPE.METRIC
                    }, {
                        name: "Target",
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
                        case "Actual":
                            return !me.isObjectInZone(object, "Target");
                        case "Target":
                            return !me.isObjectInZone(object, "Actual");
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

            getDropZoneContextMenuItems: function getDropZoneContextMenuItems(cfg, zone, object, el) {
                // Offer the Threshold Editor on the Actual metric so bars can be colored by thresholds.
                if (this.getDropZoneName(zone) === "Actual") {
                    cfg.addSeparator();
                    this.buildThresholdMenuOptions(cfg, {item: object}, true);
                }
            },

            // When switching from another visualization: attributes -> Category, first metric -> Actual,
            // second -> Target, everything else -> Tooltip.
            customDropZonesTransition: function customDropZonesTransition(attributes, metrics) {
                this.transitionObjectsToZone("Category", attributes);
                if (metrics[0]) {
                    this.transitionObjectsToZone("Actual", metrics[0]);
                }
                if (metrics[1]) {
                    this.transitionObjectsToZone("Target", metrics[1]);
                }
                if (metrics.length > 2) {
                    this.transitionObjectsToZone("Tooltip", metrics.slice(2));
                }
            },

            getDefaultTooltipOrder: function getDefaultTooltipOrder() {
                var SUFFIX = mstrmojo.vi.models.CustomVisDropZones.CUSTOM_DZ_SUFFIX;
                return [
                    ["Category", "Tooltip" + SUFFIX.ATTRIBUTE],
                    ["Actual", "Target", "Tooltip" + SUFFIX.METRIC]
                ];
            }
        }
    );
}());
//@ sourceURL=SvBulletChartDropZones.js
