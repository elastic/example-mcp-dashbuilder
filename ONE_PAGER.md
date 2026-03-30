# elastic-dashbuilder: AI-Powered Dashboard Creation via MCP

## What It Does

elastic-dashbuilder is an MCP application that lets AI assistants build Kibana dashboards through natural language conversation. Users describe what they want in Cursor, and the AI explores their Elasticsearch data, creates visualizations, previews them interactively, and exports directly to Kibana.

```
"Build me an ecommerce analytics dashboard with revenue metrics,
 order trends by day, and a category breakdown"
```

The AI then:

1. Explores indices and field mappings via ES|QL
2. Creates charts (bar, line, area, pie, metric, heatmap) with appropriate queries
3. Renders a live, interactive dashboard preview inline in Cursor's chat
4. Exports to Kibana as real Lens visualizations with one command

## Capabilities

**Visualization types:** Bar, line, area, pie charts | Metric panels with sparkline trends | Heatmaps with temperature color scales

**Dashboard features:** Drag-and-drop 48-column grid layout | Collapsible sections | Multi-dashboard management (create, switch, delete) | Time picker with "All data" default and common ranges

**Data pipeline:** Dynamic ES|QL queries (no static data stored) | Automatic time field detection via field_caps | DSL time range filtering | Per-panel loading indicators

**Kibana integration:** Export to Kibana as Lens visualizations | Import existing Kibana dashboards for AI-assisted editing | Preserves grid positions, custom colors, and time field mapping | Round-trip: import → modify → re-export

**AI integration:** 13 MCP tools for the full workflow | Built-in dataviz best practices resource | Built-in ES|QL reference resource | Inline chart screenshots via Puppeteer | Interactive MCP App preview in Cursor's chat

## Example Workflow

```
User: "Create a dashboard from kibana_sample_data_logs"

AI:  list_indices("kibana_sample_data_*")        -- discover data
     get_fields("kibana_sample_data_logs")        -- understand schema
     create_metric(                                -- KPI panel
       title: "Total Log Entries",
       esqlQuery: "FROM kibana_sample_data_logs | STATS total = COUNT(*)",
       valueField: "total"
     )
     create_chart(                                 -- time series
       title: "Bytes Over Time", chartType: "line",
       esqlQuery: "FROM kibana_sample_data_logs
         | STATS bytes = SUM(bytes) BY BUCKET(@timestamp, 1 hour)
         | SORT `BUCKET(@timestamp, 1 hour)`",
       xField: "BUCKET(@timestamp, 1 hour)", yFields: ["bytes"]
     )
     create_chart(                                 -- category comparison
       title: "Response Codes", chartType: "bar",
       esqlQuery: "FROM kibana_sample_data_logs
         | STATS count = COUNT(*) BY response | SORT count DESC",
       xField: "response", yFields: ["count"]
     )
     view_dashboard()                              -- interactive preview in chat
     export_to_kibana()                            -- one-click Kibana export
```

## Technology Stack

| Component           | Technology                               | Notes                                                        |
| ------------------- | ---------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| **Chart rendering** | `@elastic/charts` v67                    | Bar, line, area, pie, metric, heatmap with Borealis theme    |
| **Grid layout**     | `kbn-grid-layout` (vendored from Kibana) | 48-column drag-and-drop system with collapsible sections     |
| \*\*ES              | QL parsing\*\*                           | `@elastic/esql` v1.6                                         | AST-based index pattern extraction (replaces fragile regex) |
| **UI components**   | `@elastic/eui` v114                      | Time picker, buttons, progress bars, icons                   |
| **MCP protocol**    | `@modelcontextprotocol/sdk`              | 13 tools + 2 resources + MCP Apps inline preview             |
| **MCP Apps**        | `@modelcontextprotocol/ext-apps`         | Single-file HTML bundle rendered in Cursor's chat            |
| **ES client**       | `@elastic/elasticsearch` v9              | ES                                                           | QL queries, field_caps, index management                    |
| **Screenshots**     | Puppeteer                                | Headless Chrome renders each chart to PNG for inline display |
| **Build**           | Vite 6 + `vite-plugin-singlefile`        | Dev server with API proxy + single-file MCP App build        |
| **Framework**       | React 18 + TypeScript strict             | RxJS for grid state, Emotion for styling                     |

## Architecture

```
Cursor (AI Assistant)
  |  MCP Protocol (stdio)
  v
MCP Server (Node.js)
  |-- 13 Tools (query, chart, metric, heatmap, section, export, view...)
  |-- 2 Resources (dataviz guidelines, ES|QL reference)
  |-- Puppeteer (chart screenshots)
  |-- Dashboard store (multi-dashboard JSON persistence)
  |-- Auto-starts Vite dev server as child process
  v
Preview App (Vite + React)
  |-- Elastic Charts (6 chart types, Borealis theme)
  |-- kbn-grid-layout (drag, resize, sections)
  |-- Dynamic queries via /api/esql proxy
  |-- Time picker with field_caps detection + DSL filters
  |-- Single-file build for MCP App embedding
  v
Elasticsearch <--> Kibana
```

**Key design decisions:**

- Queries run dynamically
- Time filtering uses DSL `filter` parameter on the `_query` API (not injected into ES|QL) -- clean export to Kibana
- Time field detection via field_caps API with caching -- works with any index without configuration
- MCP App is a single self-contained HTML file (~2.5MB, ~577KB gzipped) -- sandbox limitation prevents external script loading

## What's Needed for Marketplace

### Must Do

**1. Publish `kbn-grid-layout` as an npm package**
The grid layout is currently vendored (copy-pasted) from the Kibana repository. For marketplace distribution, it needs to be:

- Published as `@elastic/kbn-grid-layout` (or similar) on npm
- Versioned and maintained alongside Kibana releases
- Installed via `npm install` instead of copied into the project

**2. Resolve licensing for vendored code**
The grid layout code carries Elastic License 2.0 + SSPL headers from Kibana. Publishing as a separate npm package with clear licensing is required.

### Should Do

**3. Metric trend sparklines via dynamic queries**
The refactored architecture supports trend sparklines (second ES|QL query per metric panel), but the DashboardPanel component needs to handle this for the Puppeteer screenshot path too.

### Nice to Have

**4. Collaborative editing**
Multiple users working on the same dashboard via shared MCP server state.

**5. Template library**
Pre-built dashboard templates for common Elastic data sources (logs, APM, security, ecommerce).

**6. Chart type auto-detection**
AI could analyze query result shape and automatically choose the best chart type instead of requiring explicit selection.
