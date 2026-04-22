---
name: elasticsearch-canvas-dashboard
description: Build standalone Cursor Canvas dashboards from Elasticsearch or ES|QL data, including timerange controls, refresh interactions, KPI/trend/breakdown layout, and optional companion MCP dashboards. Use when the user wants Elasticsearch data, logs, metrics, or ES|QL query results turned into a Canvas dashboard, or wants a live Elastic dashboard mirrored in a canvas.
---

# Elasticsearch Canvas Dashboard

## Purpose

Use this skill when the deliverable is a `Cursor Canvas` built from Elasticsearch data.

Default to a standalone snapshot canvas.

If the user also wants a live Elastic dashboard, treat that as a companion deliverable, not a replacement for the canvas.

## Quick Start

1. Confirm the data source:
   - index or index pattern
   - time field
   - main KPIs
   - main trends
   - main breakdowns
2. Decide the source of truth:
   - If a saved dashboard JSON already exists, read it first and mirror its structure.
   - Otherwise, inspect Elasticsearch fields and validate the ES|QL queries before designing the canvas.
3. Build the canvas as a self-contained artifact:
   - exactly one `.canvas.tsx` file
   - import only from `cursor/canvas`
   - embed all data inline
   - no `fetch()`, no network calls
4. Add lightweight interaction:
   - timerange selector via `useCanvasState`
   - refresh button that updates snapshot state or timestamp
5. Tell the user clearly whether the canvas is:
   - a live dashboard, or
   - a standalone snapshot of Elasticsearch data

## Workflow

## 1. Clarify the Deliverable

Choose the path up front:

- `Canvas only`: user wants a standalone artifact in Cursor.
- `Canvas + MCP dashboard`: user wants a canvas and also wants the live Elastic dashboard preview/export flow.
- `MCP dashboard only`: do not use this skill unless the user still wants the canvas as part of the result.

For this repository, remember:

- dashboard creation belongs to the MCP workflow
- the canvas is the standalone presentation layer

## 2. Gather the Data Shape

Prefer the smallest reliable path:

- Read an existing dashboard JSON if one already captures the desired KPI/trend/breakdown shape.
- Otherwise:
  - discover indices
  - inspect fields
  - test ES|QL queries
  - confirm time bucketing and aggregation names

For Elasticsearch-driven canvases, capture:

- a primary KPI row
- 1-2 time-series views
- 1-2 categorical breakdowns
- any top-N table that explains the outliers

Keep the canvas focused. Usually 4-8 panels is enough.

## 3. Design the Canvas

Use a dashboard composition that matches the Canvas SDK well:

1. Header:
   - title
   - short description
   - source / coverage / refresh metadata pills
2. Controls row:
   - timerange pills or select
   - refresh button
3. KPI strip:
   - `Grid` + `Stat`
4. Trends:
   - `LineChart` or `BarChart`
5. Breakdowns:
   - `PieChart`, `BarChart`, `Table`
6. Caveat / note:
   - `Callout` explaining snapshot vs live behavior

Do not build a wall of identical cards.

Mix open sections with cards. Tables should usually sit directly under a heading unless the table itself is part of a named panel.

## 4. Implement Canvas Interaction

Use `useCanvasState` for persistent controls.

Recommended pattern:

- selected timerange key: `full`, `last30`, `last7`, etc.
- last refreshed timestamp

The refresh button should:

- update snapshot state when the canvas is static, or
- only represent a refresh event in the canvas if live querying is not possible

Do not imply live Elasticsearch re-query support unless the canvas really has it.

## 5. Handle Data Correctly

Canvas files must be standalone, so:

- aggregate and normalize data before writing the canvas
- store only what the canvas needs
- keep labels preformatted when useful
- avoid giant raw payload dumps

Good embedded data:

- day labels
- series arrays
- KPI totals
- top-N request rows
- pie slices

Bad embedded data:

- full unfiltered documents
- redundant duplicate datasets
- query results the canvas never renders

## 6. Optional Companion MCP Dashboard

If the user also wants the live Elastic dashboard:

1. Read the project instructions and MCP resources first.
2. Read:
   - `dataviz://guidelines`
   - `esql://reference`
3. Create a new dashboard with `create_dashboard`.
4. Pass `dashboardId` on every subsequent tool call.
5. Build panels with:
   - `create_metric`
   - `create_chart`
   - `create_heatmap`
   - `create_section`
6. Always call `view_dashboard`.

Use the MCP dashboard for live querying and export flows.

Use the canvas for the standalone artifact.

## 7. Validation

Before finishing:

- verify the canvas imports only from `cursor/canvas`
- confirm there is exactly one `.canvas.tsx` file for the artifact
- check the canvas for lints
- read the `.canvas.status.json` sidecar if present
- make sure timerange controls update the displayed snapshot
- make sure the refresh button has honest behavior
- mention any limitation around live data explicitly

## Output Pattern

Use this structure by default:

```markdown
H1 title
short summary
metadata pills
timerange controls + refresh
KPI grid
trend section
breakdown section
table section
snapshot/live callout
```

## Naming Guidance

Prefer descriptive names:

- `logs-operations-overview.canvas.tsx`
- `search-latency-overview.canvas.tsx`
- `security-alert-summary.canvas.tsx`

Match the canvas filename to the dashboard topic.

## Additional Resources

- For prompt and layout examples, see [examples.md](examples.md)
