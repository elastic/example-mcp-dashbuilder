/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

/**
 * Server-level instructions sent to every MCP client via the initialize response.
 * This is the MCP equivalent of a system prompt — clients receive it automatically.
 */
export const SERVER_INSTRUCTIONS = `\
Elastic Dashbuilder provides tools and resources for creating \
Elasticsearch visualizations using ES|QL and Elastic Charts.

## Workflow

1. Read the \`dataviz://guidelines\` and \`esql://reference\` resources before creating charts.
2. Create a new dashboard with \`create_dashboard\` (or use the active one).
3. Use \`list_indices\` and \`get_fields\` to explore available data.
4. Use \`run_esql\` to test queries before creating charts.
5. Create visualizations with \`create_chart\`, \`create_metric\`, \`create_heatmap\`.
6. Organize with \`create_section\` and \`move_panel_to_section\`.
7. Call \`view_dashboard\` to show the interactive preview.
8. Export with \`export_to_kibana\` when ready.

## Tips

- When the user asks for a "themed" dashboard (e.g. "pink themed"), pass matching hex colors \
via the \`palette\`, \`colorRamp\`, and \`color\` parameters on the chart/metric/heatmap tools.
- Pie charts should have max 6 slices — use \`| SORT value DESC | LIMIT 6\` in the query.
- For time series, always use \`BUCKET(@timestamp, interval)\` and \`SORT\` by the time field.
- Always set \`timeField\` to the primary date field of the index so the time picker filters correctly. \
Set it to the same date field you use in the ES|QL query (e.g. if you \`BUCKET(order_date, 1 day)\`, \
set \`timeField: "order_date"\`). For \`@timestamp\` you can omit it (auto-detected), \
but for any other date field, always set it explicitly.
- Metric panels benefit from a subtitle for context (e.g. "Last 7 days", "All documents").
- When importing from Kibana, panels using index-pattern queries (not ES|QL) will be skipped.

## Capabilities

Supported: bar, line, area, pie, metric, and heatmap charts; \
ES|QL queries; index and field exploration; collapsible sections; \
export to Kibana as Lens visualizations; import existing Kibana dashboards (ES|QL panels only); \
interactive previews inline.

Not supported: non-ES|QL data sources; \
chart types other than bar, line, area, pie, metric, heatmap; \
Kibana alerts, rules, or saved searches; \
import of dashboards with index-pattern-based (formBased) queries.
`;
