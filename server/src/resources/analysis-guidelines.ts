/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

export const ANALYSIS_GUIDELINES = `
# Deep Data Analysis

## When to Use This Guide

This guide drives a structured exploration flow when the user asks for *insight* rather than a specific chart.

Trigger on prompts like:
- "analyze my <index> data"
- "what's interesting in <index>"
- "find patterns in this query"
- "surface anomalies in <data>"
- "what should I look at in <index>"

Do NOT trigger when the user asks for a specific chart ("make a bar chart of X", "show response times over time"). Those are regular chart-creation flows — follow the main workflow instead.

## Where the Analysis Lands

Use the current dashboard — pass the existing \`dashboardId\` on every tool call. Do not create a new dashboard and do not create a new section. Both add complexity without benefit and can cause charts to land where the user cannot see them.

## Critical Rules

- Pass \`dashboardId\` on every tool call — session isolation depends on it.
- Sample rows returned by a \`| LIMIT N\` query are ONLY for understanding the schema. Never analyze or summarize sample rows directly. Insights come from real aggregations over the full dataset.
- Run at most 3 aggregation queries during the analysis phase. Additional queries waste tokens without adding insight.
- Each \`STATS\` should group by at most 2 fields — one is ideal. Always end with \`SORT ... DESC | LIMIT 10\` to keep output bounded.
- Every finding must be backed by numbers from actual query results. Never invent insights to fill the structure.
- If the data is genuinely unremarkable after the probes, say so. *"Nothing notable found"* is a valid, honest conclusion.

## Analysis Process

1. Determine the query shape: does the user's query (or implied data scope) already contain an aggregation (\`STATS\`, \`COUNT\`, \`AVG\`, etc.) or return raw documents?
2. Use \`get_fields\` first if you need schema info. Then run probes.
3. Follow Path A or Path B below.

### Path A: Raw document results

Run 2–3 focused aggregation queries against the full dataset via \`run_esql\`. Good probe shapes:

- Categorical distribution: \`FROM <index> | STATS count = COUNT(*) BY <field> | SORT count DESC | LIMIT 10\`
- Time trend: \`FROM <index> | STATS count = COUNT(*) BY BUCKET(@timestamp, <interval>) | SORT bucket | LIMIT 50\`
- Numeric summary: \`FROM <index> | STATS avg = AVG(<field>), min = MIN(<field>), max = MAX(<field>), p95 = PERCENTILE(<field>, 95)\`

Base your analysis on these aggregation results.

### Path B: Already-aggregated results

The rows ARE the answer. Interpret them directly: rankings, outliers, distributions, patterns. Optionally run 1 complementary query to deepen a specific finding.

## Response Structure

Your response must have all four sections in order.

### 1. Overview
Short paragraph: what the data represents, total count, time range, key fields.

### 2. Deep Analysis
Walk through findings from the 2–3 queries with real numbers. Highlight patterns, trends, anomalies. No invented insights.

### 3. Visualization

IMPORTANT: You MUST call \`create_chart\` / \`create_metric\` / \`create_heatmap\` here. This is NOT optional. Describing a chart in text or asking the user's permission is not acceptable — the chart must actually exist in the dashboard.

Render the single most important finding. Use the same query that produced the finding. Pass the current \`dashboardId\`. Set \`timeField\` explicitly when the date field is not \`@timestamp\`. Follow chart-choice rules in \`dataviz://guidelines\`.

Create at most 1–2 charts in this phase. The goal is a focused insight, not a full dashboard. Additional charts come via drill-downs if the user asks.

After the charts are created, call \`view_dashboard\` to render the updated dashboard for the user.

### 4. Drill-Down Queries

Suggest 3 follow-up ES|QL queries in esql-tagged code blocks. Do NOT execute them. Each should target a distinct aspect:

1. **Drill-down into the top finding** — filter to the time window, category, or value where the key pattern appears.
2. **Correlation or comparison** — break a metric down by a second field, or compare two time periods.
3. **Outlier / edge case** — filter to extreme values, rare categories, or the tail of a distribution.

For each, give a one-line explanation of what it investigates and why. End the section with:

> *Reply with 1, 2, or 3 and I'll build the chart in this dashboard.*

## On-Demand Capabilities

Invoke ONLY when the user asks explicitly. Do not run these during the default flow. Return only the requested output — skip the four-section structure.

### Field Statistics
*"Show field stats" / "What are the top values for <field>?"*
1. Use columns you already know about, or \`get_fields\` to confirm.
2. Categorical: \`STATS count = COUNT(*) BY <field> | SORT count DESC | LIMIT 10\`. Calculate percentages yourself from the raw counts and total (e.g. "status 200: 12,832 (91.2%)"). Do NOT compute percentages in ES|QL.
3. Numeric: \`STATS min = MIN(<f>), max = MAX(<f>), avg = AVG(<f>), p95 = PERCENTILE(<f>, 95)\`.
4. Timestamp: \`STATS min = MIN(<ts>), max = MAX(<ts>)\` for the range.

### Correlation Discovery
*"Find correlations" / "What varies with <field>?"*
- Cross-tabulate two categorical fields: \`STATS count = COUNT(*) BY <field_a>, <field_b> | SORT count DESC | LIMIT 10\`.
- Report only meaningful correlations — skip noise.

### Time-over-Time Comparison
*"Compare with last week" / "How does today compare to yesterday?"*
- Use a SINGLE bucketed query covering both periods: \`STATS count = COUNT(*) BY BUCKET(@timestamp, 1 week) | SORT bucket | LIMIT 10\`.
- Compare the resulting buckets: absolute values, differences, what grew or shrank.
- Calculate percentage changes yourself in the reply.

## What This Guide Is Not

- Not a replacement for the normal chart-building workflow. If the user knows the chart they want, use the standard tools directly.
- Not a substitute for the user's judgment. Surface findings; don't prescribe decisions.
`;
