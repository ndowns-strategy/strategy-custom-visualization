/*
 * Sample datasets for the preview harness. Each dataset is a flat table:
 *   attributes: [{id, name}], metrics: [{id, name, format, threshold}], rows: [[attr values..., metric values...]]
 * Metric values are summed when the harness aggregates rows to the attributes in use.
 * `threshold: true` makes the mock DataInterface attach red/amber/green threshold colors (by tertile).
 */
(function () {
    "use strict";

    // Small deterministic PRNG so the data is identical on every load.
    function rng(seed) {
        return function () {
            seed = (seed * 1664525 + 1013904223) % 4294967296;
            return seed / 4294967296;
        };
    }

    function salesRows() {
        var rand = rng(42),
            regions = ["Northeast", "Southeast", "Central", "West", "International"],
            categories = ["Books", "Electronics", "Movies", "Music"],
            channels = ["Online", "Retail"],
            rows = [];
        regions.forEach(function (region, ri) {
            categories.forEach(function (category, ci) {
                channels.forEach(function (channel) {
                    var base = 120000 + ri * 45000 + ci * 30000 + rand() * 90000,
                        revenue = Math.round(base * (channel === "Online" ? 1.15 : 0.85)),
                        target = Math.round(revenue * (0.82 + rand() * 0.45)),
                        profit = Math.round(revenue * (0.08 + rand() * 0.18) - (rand() < 0.08 ? revenue * 0.3 : 0)),
                        units = Math.round(revenue / (18 + rand() * 30));
                    rows.push([region, category, channel, revenue, target, profit, units]);
                });
            });
        });
        return rows;
    }

    window.SV_DATASETS = [
        {
            id: "sales",
            name: "Retail sales (Region × Category × Channel)",
            attributes: [
                {id: "ATTR_REGION", name: "Region"},
                {id: "ATTR_CATEGORY", name: "Category"},
                {id: "ATTR_CHANNEL", name: "Channel"}
            ],
            metrics: [
                {id: "MET_REVENUE", name: "Revenue", format: {prefix: "$"}, threshold: true},
                {id: "MET_TARGET", name: "Revenue Target", format: {prefix: "$"}},
                {id: "MET_PROFIT", name: "Profit", format: {prefix: "$"}},
                {id: "MET_UNITS", name: "Units Sold", format: {}}
            ],
            rows: salesRows()
        },
        {
            // Totals by stage match the funnel example: 268 / 94 / 74 / 37 / 14.
            id: "pipeline",
            name: "Sales pipeline (Sales Stage × Region)",
            attributes: [
                {id: "ATTR_STAGE", name: "Sales Stage"},
                {id: "ATTR_SREGION", name: "Region"}
            ],
            metrics: [
                {id: "MET_OPP_COUNT", name: "Opportunity Count", format: {}},
                {id: "MET_PIPE_VALUE", name: "Pipeline Value", format: {prefix: "$"}}
            ],
            rows: [
                ["Lead", "Americas", 120, 2400000], ["Lead", "EMEA", 90, 1710000], ["Lead", "APAC", 58, 980000],
                ["Qualify", "Americas", 40, 1120000], ["Qualify", "EMEA", 30, 810000], ["Qualify", "APAC", 24, 590000],
                ["Solution", "Americas", 33, 1060000], ["Solution", "EMEA", 25, 760000], ["Solution", "APAC", 16, 450000],
                ["Proposal", "Americas", 17, 690000], ["Proposal", "EMEA", 12, 470000], ["Proposal", "APAC", 8, 280000],
                ["Finalize", "Americas", 6, 310000], ["Finalize", "EMEA", 5, 240000], ["Finalize", "APAC", 3, 120000]
            ]
        },
        {
            // Modeled on the KPI reference: Mar 2023 profit $16,000,000.00 is 14.8% below cost.
            id: "monthly",
            name: "Monthly profit vs. cost (12 months)",
            attributes: [
                {id: "ATTR_MONTH", name: "Month"}
            ],
            metrics: [
                {id: "MET_M_PROFIT", name: "Profit", format: {prefix: "$", decimals: 2}},
                {id: "MET_M_COST", name: "Cost", format: {prefix: "$", decimals: 2}},
                {id: "MET_M_REVENUE", name: "Revenue", format: {prefix: "$", decimals: 2}}
            ],
            rows: [
                ["Apr 2022", 16450000, 19210000, 35660000],
                ["May 2022", 16020000, 18640000, 34660000],
                ["Jun 2022", 16980000, 19870000, 36850000],
                ["Jul 2022", 16710000, 19380000, 36090000],
                ["Aug 2022", 16090000, 18850000, 34940000],
                ["Sep 2022", 15930000, 18710000, 34640000],
                ["Oct 2022", 16240000, 18980000, 35220000],
                ["Nov 2022", 16480000, 19160000, 35640000],
                ["Dec 2022", 16390000, 18900000, 35290000],
                ["Jan 2023", 16620000, 19240000, 35860000],
                ["Feb 2023", 16710000, 19050000, 35760000],
                ["Mar 2023", 16000000, 18779342.72, 34779342.72]
            ]
        },
        {
            id: "kpis",
            name: "Department KPIs (long labels, a negative value)",
            attributes: [
                {id: "ATTR_DEPT", name: "Department"}
            ],
            metrics: [
                {id: "MET_ACTUAL", name: "Actual", format: {suffix: "%", decimals: 1}, threshold: true},
                {id: "MET_PLAN", name: "Plan", format: {suffix: "%", decimals: 1}},
                {id: "MET_PRIOR", name: "Prior Year", format: {suffix: "%", decimals: 1}}
            ],
            rows: [
                ["Customer Success & Support Operations", 92.4, 90, 88.1],
                ["Finance", 71.2, 85, 80.3],
                ["Human Resources", 64.0, 75, 70.9],
                ["Information Technology Infrastructure", 98.7, 95, 93.2],
                ["Legal", 55.3, 80, 61.0],
                ["Marketing", 103.9, 90, 84.4],
                ["Procurement", -4.5, 20, 12.0],
                ["Research & Development", 81.6, 85, 79.5],
                ["Sales — North America", 112.1, 100, 97.6],
                ["Sales — EMEA", 88.8, 100, 91.3]
            ]
        },
        {
            id: "single",
            name: "Single row",
            attributes: [{id: "ATTR_COMPANY", name: "Company"}],
            metrics: [
                {id: "MET_ARR", name: "ARR", format: {prefix: "$", suffix: "M", decimals: 1}},
                {id: "MET_ARR_GOAL", name: "ARR Goal", format: {prefix: "$", suffix: "M", decimals: 1}}
            ],
            rows: [["Total", 48.6, 55]]
        },
        {
            id: "empty",
            name: "No rows (filtered to nothing)",
            attributes: [{id: "ATTR_REGION", name: "Region"}],
            metrics: [
                {id: "MET_REVENUE", name: "Revenue", format: {prefix: "$"}},
                {id: "MET_TARGET", name: "Revenue Target", format: {prefix: "$"}}
            ],
            rows: []
        }
    ];
}());
