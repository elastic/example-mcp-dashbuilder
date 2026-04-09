# example-mcp-dashbuilder: AI-Powered Dashboard Creation via MCP

## What It Does

example-mcp-dashbuilder is an MCP application that lets AI assistants build Kibana dashboards through natural language conversation. Users describe what they want, and the AI explores their Elasticsearch data, creates visualizations, previews them interactively, and exports directly to Kibana.

```
"Build me an ecommerce analytics dashboard with revenue metrics,
 order trends by day, and a category breakdown"
```

The AI then:

1. Explores indices and field mappings via ES|QL
2. Creates charts (bar, line, area, pie, metric, heatmap) with appropriate queries
3. Renders a live, interactive dashboard preview inline in the chat
4. Exports to Kibana as real Lens visualizations with one command

## Capabilities

**Visualization types:** Bar, line, area, pie charts | Metric panels with sparkline trends | Heatmaps with temperature color scales

**Dashboard features:** Drag-and-drop 48-column grid layout | Collapsible sections | Multi-dashboard management (create, switch, delete) | Time picker with "All data" default and common ranges

**Data pipeline:** Dynamic ES|QL queries (no static data stored) | Automatic time field detection via field_caps | DSL time range filtering | Per-panel loading indicators

**Kibana integration:** Export to Kibana as Lens visualizations | Import existing Kibana dashboards for AI-assisted editing | Preserves grid positions, custom colors, and time field mapping | Round-trip: import → modify → re-export

**AI integration:** MCP tools for the full workflow | Server-level instructions (workflow, tips, capabilities) sent to every MCP client | Built-in dataviz best practices resource | Built-in ES|QL reference resource | Interactive MCP App preview via ext-apps protocol

## Example Workflow

```
User: "Create a dashboard from kibana_sample_data_logs"

AI:  list_indices("kibana_sample_data_*")        -- discover data
     get_fields("kibana_sample_data_logs")        -- understand schema
     create_metric(                                -- KPI panel
       title: "Total Log Entries",
       query: "FROM kibana_sample_data_logs | STATS total = COUNT(*)",
       valueField: "total"
     )
     create_chart(                                 -- time series
       title: "Bytes Over Time", chartType: "line",
       query: "FROM kibana_sample_data_logs
         | STATS bytes = SUM(bytes) BY BUCKET(@timestamp, 1 hour)
         | SORT `BUCKET(@timestamp, 1 hour)`",
       xField: "BUCKET(@timestamp, 1 hour)", yFields: ["bytes"]
     )
     create_chart(                                 -- category comparison
       title: "Response Codes", chartType: "bar",
       query: "FROM kibana_sample_data_logs
         | STATS count = COUNT(*) BY response | SORT count DESC",
       xField: "response", yFields: ["count"]
     )
     view_dashboard()                              -- interactive preview in chat
     export_to_kibana()                            -- one-click Kibana export
```

## Technology Stack

| Component              | Technology                               | Notes                                                     |
| ---------------------- | ---------------------------------------- | --------------------------------------------------------- |
| **MCP server**         | `@modelcontextprotocol/sdk`              | Tools, resources, server instructions via MCP protocol    |
| **Chart rendering**    | `@elastic/charts` v67                    | Bar, line, area, pie, metric, heatmap with Borealis theme |
| **Grid layout**        | `kbn-grid-layout` (vendored from Kibana) | 48-column drag-and-drop system with collapsible sections  |
| **ES&#124;QL parsing** | `@elastic/esql` v1.6                     | AST-based index pattern extraction                        |
| **UI components**      | `@elastic/eui` v114                      | Time picker, buttons, progress bars, icons                |
| **MCP Apps client**    | `@modelcontextprotocol/ext-apps`         | Preview app communicates with server via postMessage      |
| **ES client**          | `@elastic/elasticsearch` v9              | ES&#124;QL queries, field_caps, index management          |
| **Build**              | Vite 6 + `vite-plugin-singlefile`        | Single-file MCP App build                                 |
| **Framework**          | React 18 + TypeScript strict             | RxJS for grid state, Emotion for styling                  |

## Architecture

```
MCP Host (Cursor, Claude Desktop, etc.)
  |  MCP Protocol (stdio)
  v
MCP Server (Node.js, @modelcontextprotocol/sdk)
  |-- Tools (query, chart, metric, heatmap, section, export, view...)
  |-- Resources (dataviz guidelines, ES|QL reference)
  |-- App-only tools (dashboard config, ES|QL proxy, layout save, time field detection)
  |-- Server instructions (workflow, tips, capabilities)
  |-- Dashboard store (multi-dashboard JSON persistence)
  v
MCP App (single-file HTML, rendered in host iframe)
  |-- ext-apps client SDK (postMessage ↔ host ↔ server)
  |-- Elastic Charts (6 chart types, Borealis theme)
  |-- kbn-grid-layout (drag, resize, sections)
  |-- Dynamic queries via callServerTool("app_only_esql_query")
  |-- Time picker with field_caps detection + DSL filters
  v
Elasticsearch <--> Kibana
```

**Key design decisions:**

- Queries run dynamically — no static data stored
- Time filtering uses DSL `filter` parameter on the `_query` API (not injected into ES|QL) — clean export to Kibana
- Time field detection via field_caps API with caching — works with any index without configuration
- Preview app communicates via MCP Apps protocol (postMessage) — no localhost server dependency
- App-only tools (`visibility: ["app"]`) handle all UI↔server interaction (data fetching, layout persistence)
- MCP App is a single self-contained HTML file (~2.5MB, ~577KB gzipped) — sandbox limitation prevents external script loading
- Server instructions exposed via MCP `initialize` response — works with any MCP client, not just Cursor

## What's Needed for Marketplace

### Should Do Before Publishing

**1. Code review and hardening**
Significant portions of this app were written with LLM assistance. The codebase needs thorough human review, refactoring, and hardening before production use — particularly error handling, edge cases, and security.

**2. Migrate from Saved Objects API to Dashboard API**
The export/import currently uses the legacy `api/saved_objects/dashboard` endpoint. This should be migrated to the new Kibana Dashboard API for better compatibility and forward-proofing.

**3. Secure credential storage**
Credentials are currently stored in plaintext in a `.env` file (gitignored). For marketplace distribution, consider using the system keychain (e.g. `keytar`) or delegating to the MCP client's credential management.

### Should Do After Publishing

**4. Publish `kbn-grid-layout` as an npm package**
The grid layout is currently vendored (copy-pasted) from the Kibana repository. It needs to be:

- Published as `@elastic/kbn-grid-layout` (or similar) on npm
- Versioned and maintained alongside Kibana releases
- Installed via `npm install` instead of copied into the project

**5. Resolve licensing for vendored code**
The grid layout code carries Elastic License 2.0 + SSPL headers from Kibana. Publishing as a separate npm package with clear licensing is required.

**6. Align visualization capabilities with Lens**
Currently the app can create Elastic Charts configurations that have no equivalent in Lens. The AI should be instructed with Lens-specific constraints so that every chart it creates can be faithfully exported to Kibana. The dataviz guidelines resource should document what Lens supports and what it doesn't.

**7. Support more Lens chart types**
Only bar, line, area, pie, metric, and heatmap are supported today. Lens also supports gauge, donut, treemap/mosaic, datatable, and tag cloud. Adding these would increase the coverage of dashboards that can be round-tripped between the MCP app and Kibana.

**8. Error UX in the preview**
When an ES|QL query fails, panels show a basic error message. The preview should display more detailed error information to help users debug query issues.

### Nice to Have

**9. Session isolation**
The MCP server stores dashboard state in memory per process. All chat sessions within one host window share the same state. Introducing session scoping or per-chat namespacing would allow parallel dashboard work.

**10. Collaborative editing**
Multiple users working on the same dashboard via shared MCP server state.

**11. Template library**
Pre-built dashboard templates for common Elastic data sources (logs, APM, security, ecommerce).
