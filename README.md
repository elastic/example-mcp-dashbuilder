# elastic-dashbuilder

An MCP (Model Context Protocol) app that lets AI assistants build Kibana dashboards using ES|QL and Elastic Charts. Create visualizations through natural language in Cursor, preview them live with Kibana's grid layout, and export directly to Kibana as real Lens dashboards.

## What it does

```
You (in Cursor) → "Build me an ecommerce analytics dashboard"
    ↓
AI explores your Elasticsearch data via ES|QL
    ↓
Creates charts (bar, line, pie, metric, heatmap) with Elastic Charts
    ↓
Live preview with Kibana's drag-and-drop grid layout
    ↓
Interactive dashboard rendered inline in Cursor's chat (MCP Apps)
    ↓
One-click export to Kibana as Lens visualizations
```

## Features

- **Natural language dashboard creation** — describe what you want, the AI builds it
- **ES|QL powered** — all queries use ES|QL for data retrieval
- **Inline dashboard preview** — full interactive dashboard rendered directly in Cursor's chat via MCP Apps
- **Browser preview** — live preview at `localhost:5173` with drag-and-drop
- **Kibana grid layout** — same 48-column drag-and-drop grid as Kibana dashboards
- **Borealis theme** — matches Kibana's latest visual design
- **Inline chart screenshots** — see rendered chart images directly in Cursor via Puppeteer
- **Collapsible sections** — organize panels into groups
- **Export to Kibana** — creates real Kibana dashboards with Lens visualizations
- **Multiple dashboards** — create, switch between, and manage multiple dashboards
- **Dataviz best practices** — built-in guidelines for chart selection and dashboard composition
- **ES|QL reference** — built-in language reference for correct query syntax

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Cursor (AI Assistant)                          │
│  ↕ MCP Protocol (stdio)                        │
├─────────────────────────────────────────────────┤
│  MCP Server (TypeScript)                        │
│  ├── Tools: query, chart, metric, heatmap, ...  │
│  ├── MCP App: inline dashboard view             │
│  ├── Resources: dataviz guidelines, ES|QL ref   │
│  ├── Puppeteer: inline chart screenshots        │
│  └── Export: Kibana saved objects API           │
├─────────────────────────────────────────────────┤
│  Preview App (Vite + React)                     │
│  ├── Elastic Charts (bar, line, pie, etc.)      │
│  ├── kbn-grid-layout (drag, resize, sections)   │
│  ├── Borealis theme                             │
│  └── Single-file build for MCP App embedding    │
├─────────────────────────────────────────────────┤
│  Elasticsearch  ←→  Kibana                      │
└─────────────────────────────────────────────────┘
```

## Prerequisites

- Node.js 20+
- Elasticsearch running on `localhost:9200`
- Kibana running on `localhost:5601` (for export)
- [Cursor](https://cursor.com) editor (v2.6+ for MCP Apps inline preview)

## Setup

### 1. Install dependencies

```bash
npm install
```

This also auto-builds the MCP App (the inline dashboard preview for Cursor's chat).

### 2. Configure Cursor

The MCP server is configured in `.cursor/mcp.json`. Update the environment variables if your Elasticsearch/Kibana setup differs:

```json
{
  "mcpServers": {
    "elastic-dashbuilder": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "server/src/index.ts"],
      "env": {
        "ES_NODE": "http://localhost:9200",
        "ES_USERNAME": "elastic",
        "ES_PASSWORD": "changeme",
        "KIBANA_URL": "http://localhost:5601"
      }
    }
  }
}
```

### 3. Open the project in Cursor

Open the `elastic-dashbuilder` folder in Cursor. The MCP server will auto-connect and start the preview server automatically. You should see it listed in Cursor Settings > MCP.

The live preview is available at [http://localhost:5173](http://localhost:5173) for browser-based development.

## Usage

### Example prompts

**Quick start:**

> "Build me a dashboard from kibana_sample_data_ecommerce with revenue metrics, order trends, and category breakdowns"

**Detailed:**

> "Create a new dashboard called 'Flight Operations'. Show metrics for total flights, average delay, and cancellation rate. Add a bar chart of flights by carrier, a line chart of delays over time, and a pie chart of flight status distribution. Organize into sections."

**Exploratory:**

> "Explore the kibana_sample_data_logs index and build me the most insightful dashboard you can"

**Export:**

> "Export the current dashboard to Kibana"

**Multi-dashboard:**

> "List my dashboards" / "Switch to the ecommerce dashboard" / "Create a new dashboard called 'Log Analysis'"

### Available MCP tools

| Tool                    | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `create_dashboard`      | Create a new dashboard                             |
| `list_dashboards`       | List all saved dashboards                          |
| `switch_dashboard`      | Switch to a different dashboard                    |
| `delete_dashboard`      | Delete a dashboard                                 |
| `run_esql`              | Execute ES\|QL queries                             |
| `list_indices`          | Discover available indices                         |
| `get_fields`            | Get field mappings for an index                    |
| `create_chart`          | Create bar, line, area, or pie charts              |
| `create_metric`         | Create metric/KPI panels with trend sparklines     |
| `create_heatmap`        | Create heatmap visualizations                      |
| `create_section`        | Create collapsible dashboard sections              |
| `move_panel_to_section` | Assign panels to sections                          |
| `export_to_kibana`      | Export to Kibana as Lens visualizations            |
| `view_dashboard`        | Display the full dashboard inline in Cursor's chat |

### Available MCP resources

| Resource               | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `dataviz://guidelines` | Chart selection, dashboard composition, and anti-patterns    |
| `esql://reference`     | ES\|QL commands, functions, and visualization query patterns |

## Supported chart types

| Type    | Best for                       | Example                            |
| ------- | ------------------------------ | ---------------------------------- |
| Bar     | Comparing categories           | Revenue by product category        |
| Line    | Trends over time               | Daily order count                  |
| Area    | Volume over time               | Traffic over time                  |
| Pie     | Part-of-whole (max 6 slices)   | Orders by status                   |
| Metric  | Single KPI with optional trend | Total revenue with daily sparkline |
| Heatmap | Patterns across 2 dimensions   | Orders by day of week x hour       |

## Inline dashboard preview (MCP Apps)

The `view_dashboard` tool renders the full interactive dashboard directly inside Cursor's chat using [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview). The entire preview app (React + Elastic Charts + grid layout) is bundled into a single HTML file and served as the MCP App resource — no iframe needed.

**How it works:**

1. `npm run build:mcp-app` builds the preview app into a single self-contained HTML file (~2.5MB, ~577KB gzipped) using `vite-plugin-singlefile`
2. The MCP server reads this file and serves it as an MCP App resource with `mimeType: 'text/html;profile=mcp-app'`
3. Cursor renders the HTML directly in a sandboxed environment inside the chat
4. The app fetches `dashboard.json` from the Vite dev server via `fetch()` (enabled by `connectDomains` CSP)
5. Charts render with the same Elastic Charts + Borealis theme as the browser preview

**Requirements:**

- Cursor v2.6+ (MCP Apps support)
- Preview dev server running (`npm run dev:preview`) for dashboard data

## Export to Kibana

The export tool translates each panel to a Lens visualization:

| MCP Chart         | Kibana Lens Type |
| ----------------- | ---------------- |
| bar / line / area | XY Visualization |
| pie               | Partition (Pie)  |
| metric            | Metric           |
| heatmap           | Heatmap          |

Grid positions are preserved 1:1 (same 48-column system). ES|QL queries transfer directly.

## Development

### Project structure

```
├── server/                    # MCP Server
│   └── src/
│       ├── index.ts           # Server entry point
│       ├── types.ts           # Shared types
│       ├── tools/             # MCP tool implementations
│       │   └── view-dashboard.ts  # MCP Apps inline preview
│       ├── utils/             # ES client, dashboard store, translators
│       └── resources/         # Dataviz guidelines, ES|QL reference
├── preview/                   # Preview App (Vite + React)
│   ├── vite.config.ts         # Dev server config
│   ├── vite.mcp-app.config.ts # Single-file build config for MCP Apps
│   └── src/
│       ├── App.tsx            # Main app with grid layout
│       ├── components/        # ChartPanel, PanelChrome
│       ├── grid-layout/       # kbn-grid-layout (from Kibana)
│       ├── hooks/             # Dashboard config polling
│       └── theme.ts           # Borealis palette
├── .cursor/mcp.json           # Cursor MCP configuration
├── .cursorrules               # AI assistant instructions
├── .github/workflows/ci.yml   # CI pipeline
└── eslint.config.js           # Linting (no-explicit-any enforced)
```

### Applying changes to the MCP App

The MCP App sandbox does not allow loading external scripts, so the MCP App always uses the pre-built bundle.

| What changed                                                                                  | What to do                                                        |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Frontend code (`App.tsx`, `ChartPanel.tsx`, `PanelChrome.tsx`, `main.tsx`, grid-layout, etc.) | Rebuild: `cd preview && npm run build:mcp-app`                    |
| Server/API code (`vite.config.ts` — requery endpoint, field_caps, etc.)                       | Restart the MCP server in Cursor (auto-restarts Vite)             |
| `dashboard.json` (new charts, layout changes)                                                 | Nothing — the MCP App polls this from the preview server every 2s |

For frontend development, use the browser preview at `http://localhost:5173` which has HMR.

### Scripts

```bash
npm run dev:preview            # Start preview app (Vite dev server)
npm run build                  # Build both server and preview
npm run lint                   # ESLint check
npm run typecheck              # TypeScript check (both projects)
npm run format                 # Format all files with Prettier
npm run format:check           # Check formatting without writing
npm run check                  # Run all checks (format + lint + typecheck)
cd preview && npm run build:mcp-app  # Build single-file MCP App
```

### Code quality

- TypeScript strict mode enabled
- `no-explicit-any` enforced via ESLint
- Prettier formatting enforced
- Pre-commit hook runs lint-staged (format + lint on staged files)
- CI pipeline on GitHub Actions (format check + lint + typecheck + build)
- Emotion theme types properly declared for EUI integration

## Credits

- [Elastic Charts](https://elastic.github.io/elastic-charts) for visualization rendering
- [kbn-grid-layout](https://github.com/elastic/kibana) for the dashboard grid (adapted from Kibana)
- [Model Context Protocol](https://modelcontextprotocol.io) for AI tool integration
- [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) for inline UI rendering
- ES|QL reference docs adapted from Kibana's NL-to-ES|QL feature
