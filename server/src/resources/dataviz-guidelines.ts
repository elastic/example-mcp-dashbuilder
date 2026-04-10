/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

export const DATAVIZ_GUIDELINES = `
# Data Visualization Best Practices

## Choosing the Right Chart Type

### Bar Chart
- **Use for**: Comparing values across categories (revenue by product, count by status)
- **Avoid when**: More than 15-20 categories (aggregate or use top N)
- **Tips**: Sort bars by value (DESC) for easier reading. Use horizontal bars if labels are long.
- **Split field**: Use sparingly — limit to 3-5 series max. More than that becomes unreadable.

### Line Chart
- **Use for**: Trends over time (daily orders, monthly revenue, hourly traffic)
- **Avoid when**: Data has no natural ordering on x-axis, or fewer than 5 data points
- **Tips**: Always use a time field on x-axis. Use BUCKET() for consistent intervals.
- **Split field**: Good for comparing 2-4 series over time. Beyond that, use separate charts.

### Area Chart
- **Use for**: Same as line chart, but when you want to emphasize volume/magnitude
- **Avoid when**: Multiple overlapping series (areas obscure each other)
- **Tips**: Best with 1-2 series. For multiple series, consider stacked area.

### Pie Chart
- **Use for**: Part-of-whole relationships (market share, distribution by category)
- **Avoid when**: More than 6 slices — humans can't compare angles well
- **Tips**: Always sort by value. If you have many small slices, group them into "Other".
- **Anti-pattern**: Never use pie charts for time series or comparisons across categories.

### Metric
- **Use for**: Single KPI values (total revenue, order count, average price)
- **Tips**: Add a trend sparkline for context. Use meaningful prefixes/suffixes ($, %, " orders").
- **Color**: Use color to indicate status (green = good, red = alert). Don't use random colors.
- **Subtitle**: Always add a subtitle explaining the time range or scope ("Last 30 days", "All regions").

### Heatmap
- **Use for**: Showing patterns across two categorical dimensions (day × hour, category × region)
- **Avoid when**: One dimension has more than 20 values (cells become too small)
- **Tips**: Use meaningful sort orders (days of week in order, hours 00-23).

## ES|QL Query Best Practices for Visualization

### Aggregation
- Always use STATS for aggregated visualizations — don't send raw rows to charts
- Name your aggregations clearly: \`STATS total_revenue = SUM(taxful_total_price)\` not \`STATS s = SUM(taxful_total_price)\`
- Use ROUND() for cleaner numbers in metrics: \`STATS avg_price = ROUND(AVG(price), 2)\`

### Time Bucketing
- Use BUCKET() for time series: \`BY BUCKET(order_date, 1 day)\`
- Choose appropriate intervals: hourly for <3 days, daily for <3 months, weekly for <1 year, monthly for >1 year
- Always SORT by the time field ascending for line/area charts

### Limiting Data
- Use \`| SORT field DESC | LIMIT 10\` for "top N" bar charts
- For pie charts, limit to 5-6 slices max
- For heatmaps, limit both dimensions to ~10-15 values each

### Naming Conventions
- Use human-readable aliases: \`STATS order_count = COUNT(*)\` not \`STATS c = COUNT(*)\`
- These aliases become axis labels and legend entries

## Dashboard Composition

### Layout
- **Top row**: 2-4 metric panels showing key KPIs (use smaller panel size w:12)
- **Middle**: Main detail charts (bar, line) at half-width (w:24) for 2-column layout
- **Bottom**: Supplementary views (heatmaps, pie charts, tables)

### Sections
- Group related panels into sections: "Revenue Metrics", "Order Trends", "Customer Analysis"
- Keep sections focused — 2-4 panels per section
- Use descriptive section titles

### Visual Consistency
- Use the same time range across all time-series panels
- Don't mix too many chart types — a dashboard with 6 different chart types is confusing
- 4-8 panels per dashboard is ideal. More than 10 becomes overwhelming.

### Titles and Context
- Every panel needs a clear, descriptive title
- Include the unit in the title if not obvious: "Revenue (USD)", "Response Time (ms)"
- Metric subtitles should explain scope: "Last 7 days", "All customers", "US region"

## Anti-Patterns to Avoid
- Pie charts with >6 slices
- 3D charts (never — they distort perception)
- Dual y-axes (confusing — use separate panels instead)
- Rainbow color palettes (not accessible, hard to read)
- Truncated y-axes that exaggerate small differences
- Dashboard with >10 panels without sections
- Using raw document counts without meaningful aggregation
`;
