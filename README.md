# example-mcp-dashbuilder

An MCP (Model Context Protocol) app that lets AI assistants build Kibana dashboards using ES|QL and Elastic Charts. Create visualizations through natural language, preview them live with Kibana's grid layout, and export directly to Kibana as real Lens dashboards.

## What it does

```
You (in an MCP client) → "Build me an ecommerce analytics dashboard"
    ↓
AI explores your Elasticsearch data via ES|QL
    ↓
Creates charts (bar, line, pie, metric, heatmap) with Elastic Charts
    ↓
Interactive dashboard rendered inline in the chat (MCP Apps)
    ↓
One-click export to Kibana as Lens visualizations
```

## Features

- **Natural language dashboard creation** — describe what you want, the AI builds it
- **Deep data analysis** — open-ended exploration flow that runs aggregations, surfaces patterns, builds charts for key findings, and suggests drill-down queries (triggered by prompts like "analyze my X")
- **ES|QL powered** — all queries use ES|QL for data retrieval
- **Inline dashboard preview** — full interactive dashboard rendered directly in the chat via MCP Apps
- **Kibana grid layout** — same 48-column drag-and-drop grid as Kibana dashboards
- **Borealis theme** — matches Kibana's latest visual design
- **Collapsible sections** — organize panels into groups
- **Export to Kibana** — creates real Kibana dashboards with Lens visualizations
- **Import from Kibana** — import existing ES|QL-based Kibana dashboards for AI-assisted editing
- **Custom color themes** — apply custom palettes to charts, heatmaps, and metrics
- **Time picker** — filter data by time range with automatic time field detection
- **Multiple dashboards** — create, switch between, and manage multiple dashboards
- **Session isolation** — parallel chat conversations work on separate dashboards via `dashboardId` threading
- **Elastic Cloud support** — works with local Elasticsearch and Elastic Cloud (Cloud ID + API key)
- **Server instructions** — workflow, tips, and capabilities exposed to every MCP client via the `initialize` response
- **Dataviz best practices** — built-in guidelines for chart selection and dashboard composition
- **ES|QL reference** — built-in language reference for correct query syntax

## Architecture

```
┌─────────────────────────────────────────────────┐
│  MCP Host (Cursor, Claude Desktop, etc.)        │
│  ↕ MCP Protocol (stdio or HTTP)                 │
├─────────────────────────────────────────────────┤
│  MCP Server (TypeScript)                        │
│  ├── Tools: query, chart, metric, heatmap, ...  │
│  ├── App-only tools: data fetch, layout, etc.   │
│  ├── Resources: dataviz guidelines, ES|QL ref   │
│  ├── Instructions: workflow, tips, capabilities │
│  └── Export: Kibana saved objects API           │
├─────────────────────────────────────────────────┤
│  MCP App (single-file HTML, in host iframe)     │
│  ├── ext-apps client SDK (postMessage ↔ server) │
│  ├── Elastic Charts (bar, line, pie, etc.)      │
│  ├── kbn-grid-layout (drag, resize, sections)   │
│  ├── Borealis theme                             │
│  └── Data via callServerTool("run_esql_query")  │
├─────────────────────────────────────────────────┤
│  Elasticsearch  ←→  Kibana                      │
└─────────────────────────────────────────────────┘
```

The server supports two transports: **stdio** (default) for standard MCP clients, and **HTTP** (`--http` flag) with streamable HTTP and session management. The MCP App communicates with the server entirely via the MCP Apps protocol (postMessage) — no localhost server dependency. App-only tools (`visibility: ["app"]`) handle all UI↔server interaction including data fetching, layout persistence, and time field detection.

## Prerequisites

- Node.js 20+
- Elasticsearch (local or Elastic Cloud)
- Kibana (for export/import)
- An MCP client: [Cursor](https://cursor.com) (v2.6+ for MCP Apps inline preview), [Claude Desktop](https://claude.ai/download), [Claude Code](https://claude.ai/claude-code), or [VS Code Copilot](https://code.visualstudio.com/)

## Quick install

No need to clone the repo — pick the method that matches your MCP client.

**Claude Desktop:** Download the latest `.mcpb` file from [GitHub Releases](https://github.com/elastic/example-mcp-dashbuilder/releases) and double-click it. Claude Desktop will prompt you for your Elasticsearch credentials.

**Cursor / Claude Code / VS Code:** Point your MCP config at the release tarball — no clone, no npm install:

```json
{
  "mcpServers": {
    "example-mcp-dashbuilder": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "https://github.com/elastic/example-mcp-dashbuilder/releases/latest/download/example-mcp-dashbuilder.tgz"
      ]
    }
  }
}
```

Set your Elasticsearch credentials as environment variables (`ES_NODE`, `ES_API_KEY` or `ES_USERNAME`/`ES_PASSWORD`, `KIBANA_URL`) or run `npm run setup` after cloning.

## Setup (from source)

### 1. Install dependencies

```bash
git clone https://github.com/elastic/example-mcp-dashbuilder.git
cd example-mcp-dashbuilder
npm install
```

This also auto-builds the MCP App (the inline dashboard preview).

### 2. Configure Elasticsearch connection

Run the setup wizard to configure your Elasticsearch and Kibana credentials:

```bash
npm run setup
```

The wizard supports both local and Elastic Cloud deployments:

- **Local:** Elasticsearch URL + username/password
- **Elastic Cloud:** Cloud ID + username/password or API key

Credentials are saved to a `.env` file (gitignored).

### 3. Configure your MCP client

No environment variables are needed if you ran `npm run setup` — credentials are loaded from `.env` automatically.

The repo includes a `start-server.sh` script that handles nvm/node path resolution automatically. This is the recommended way to configure the server.

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "example-mcp-dashbuilder": {
      "type": "stdio",
      "command": "./start-server.sh"
    }
  }
}
```

**Claude Code** (`.mcp.json` in project root — already included):

```json
{
  "mcpServers": {
    "example-mcp-dashbuilder": {
      "type": "stdio",
      "command": "./start-server.sh"
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json` — found in `~/Library/Application Support/Claude/` on macOS or `%APPDATA%\Claude\` on Windows):

For the easiest experience, download the `.mcpb` file from [Releases](https://github.com/elastic/example-mcp-dashbuilder/releases). For manual setup from source:

```json
{
  "mcpServers": {
    "example-mcp-dashbuilder": {
      "command": "/absolute/path/to/example-mcp-dashbuilder/start-server.sh"
    }
  }
}
```

Note: Claude Desktop requires an absolute path.

### 4. Open the project in your MCP client

Open the `example-mcp-dashbuilder` folder in your MCP client. The MCP server will auto-connect. In Cursor, you should see it listed in Settings > MCP.

### Troubleshooting

- **`npx: command not found`** — Cursor/Claude Desktop may not inherit your shell PATH when launched from the dock. Either open your client from the terminal (e.g. `cursor .`) or use the `start-server.sh` script which loads nvm automatically.
- **`EPERM: operation not permitted`** — Claude Desktop's macOS sandbox blocks access to `~/Documents`. Move the repo to a non-protected location like `~/example-mcp-dashbuilder` or `/tmp`.
- **Wrong Node version** — The project requires Node 18+. If you use nvm, `start-server.sh` handles this. For manual config, use the full path to your Node binary: `/Users/you/.nvm/versions/node/v22.x.x/bin/node`.

## Usage

### Example prompts

**Quick start:**

> "Build me a dashboard from kibana_sample_data_ecommerce with revenue metrics, order trends, and category breakdowns"

**Detailed:**

> "Create a new dashboard called 'Flight Operations'. Show metrics for total flights, average delay, and cancellation rate. Add a bar chart of flights by carrier, a line chart of delays over time, and a pie chart of flight status distribution. Organize into sections."

**Exploratory:**

> "Explore the kibana_sample_data_logs index and build me the most insightful dashboard you can"

**Analysis:**

> "Analyze my logs data"

> "What's interesting in the ecommerce orders index?"

**Export / Import:**

> "Export the current dashboard to Kibana"

> "Import the Kibana dashboard at http://localhost:5601/app/dashboards#/view/abc-123"

**Multi-dashboard:**

> "List my dashboards" / "Switch to the ecommerce dashboard" / "Create a new dashboard called 'Log Analysis'"

### Available MCP tools

| Tool                    | Description                                         |
| ----------------------- | --------------------------------------------------- |
| `create_dashboard`      | Create a new dashboard                              |
| `list_dashboards`       | List all saved dashboards                           |
| `switch_dashboard`      | Switch to a different dashboard                     |
| `delete_dashboard`      | Delete a dashboard                                  |
| `run_esql`              | Execute ES\|QL queries                              |
| `list_indices`          | Discover available indices                          |
| `get_fields`            | Get field mappings for an index                     |
| `create_chart`          | Create bar, line, area, or pie charts               |
| `create_metric`         | Create metric/KPI panels with trend sparklines      |
| `create_heatmap`        | Create heatmap visualizations                       |
| `create_section`        | Create collapsible dashboard sections               |
| `move_panel_to_section` | Assign panels to sections                           |
| `remove_section`        | Remove a section                                    |
| `remove_chart`          | Remove a chart                                      |
| `set_dashboard_title`   | Set the dashboard title                             |
| `get_dashboard`         | Get the active dashboard configuration              |
| `clear_dashboard`       | Reset the active dashboard                          |
| `export_to_kibana`      | Export to Kibana as Lens visualizations             |
| `import_from_kibana`    | Import an existing Kibana dashboard (ES\|QL panels) |
| `view_dashboard`        | Display the full dashboard inline in the chat       |

### Available MCP resources

| Resource                | Description                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `dataviz://guidelines`  | Chart selection, dashboard composition, and anti-patterns                                     |
| `esql://reference`      | ES\|QL commands, functions, and visualization query patterns                                  |
| `analysis://guidelines` | Structured flow for open-ended analysis — trigger phrases, four-section response, drill-downs |

## Supported chart types

| Type    | Best for                       | Example                            |
| ------- | ------------------------------ | ---------------------------------- |
| Bar     | Comparing categories           | Revenue by product category        |
| Line    | Trends over time               | Daily order count                  |
| Area    | Volume over time               | Traffic over time                  |
| Pie     | Part-of-whole (max 6 slices)   | Orders by status                   |
| Metric  | Single KPI with optional trend | Total revenue with daily sparkline |
| Heatmap | Patterns across 2 dimensions   | Orders by day of week × hour       |

## HTTP transport

Start the server in HTTP mode:

```bash
npm run start -- --http
```

The server listens on `http://0.0.0.0:3001/mcp` by default. Override with environment variables:

```bash
HOST=127.0.0.1 PORT=3002 npm run start -- --http
```

## Docker

Build and run with Docker Compose:

```bash
docker compose up --build
```

Or build and run directly:

```bash
docker build -t elastic-mcp-dashbuilder .
docker run -p 3001:3001 --env-file .env elastic-mcp-dashbuilder
```

## Inline dashboard preview (MCP Apps)

The `view_dashboard` tool renders the full interactive dashboard directly inside the chat using [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview). The preview app is bundled into a single HTML file and served as an MCP App resource.

**How it works:**

1. `npm run build --workspace=preview` builds the preview app into a single self-contained HTML file (~2.5MB, ~577KB gzipped) using `vite-plugin-singlefile`
2. The MCP server reads this file and serves it as an MCP App resource with `mimeType: 'text/html;profile=mcp-app'`
3. The host renders the HTML in a sandboxed iframe
4. The app communicates with the MCP server via the ext-apps client SDK (`callServerTool()` over postMessage)
5. Charts render with Elastic Charts + Borealis theme

**Requirements:**

- Cursor v2.6+ (MCP Apps support) — also supported by Claude Desktop, Claude.ai, VS Code Copilot

## Export to Kibana

The export tool translates each panel to a Lens visualization:

| MCP Chart         | Kibana Lens Type |
| ----------------- | ---------------- |
| bar / line / area | XY Visualization |
| pie               | Partition (Pie)  |
| metric            | Metric           |
| heatmap           | Heatmap          |

Grid positions are preserved 1:1 (same 48-column system). ES|QL queries transfer directly. Time fields are auto-detected via field_caps so Kibana's time picker works immediately. Custom colors (series palettes, metric backgrounds, heatmap ramps) are preserved on export.

## Development

### Project structure

```
├── server/                    # MCP Server
│   └── src/
│       ├── index.ts           # Entry point (stdio default, --http flag)
│       ├── server.ts          # MCP server factory (tools, resources)
│       ├── app.ts             # HTTP transport (Express, session mgmt)
│       ├── types.ts           # Shared types
│       ├── tools/             # MCP tool implementations
│       │   ├── view-dashboard.ts  # MCP Apps inline preview + resources
│       │   └── app-only-tools.ts  # App-only tools (visibility: ["app"])
│       ├── utils/             # ES client, dashboard store, translators
│       ├── resources/         # Instructions, dataviz guidelines, ES|QL ref
│       └── integration-tests/ # MCP integration tests (testcontainers)
├── preview/                   # MCP App (React, built to single HTML file)
│   ├── vite.mcp-app.config.ts # Single-file build config
│   └── src/
│       ├── App.tsx            # Main app with grid layout
│       ├── components/        # ChartPanel, PanelChrome
│       ├── grid-layout/       # kbn-grid-layout (from Kibana)
│       ├── hooks/             # ES|QL query hook
│       └── theme.ts           # Borealis palette
├── setup/                     # Setup wizard (interactive CLI)
│   └── src/
│       ├── cli.ts             # CLI entry point
│       ├── prompts.ts         # Interactive prompts (local/cloud)
│       ├── config.ts          # Config resolution
│       ├── connection.ts      # ES connection testing
│       ├── display.ts         # Display helpers
│       ├── env.ts             # .env file read/write
│       └── types.ts           # Shared types
├── .cursor/mcp.json           # Cursor MCP configuration
├── .cursorrules               # Cursor-specific AI instructions
├── .github/workflows/         # CI, Release (semantic-release), PR-title check
├── .releaserc.js              # semantic-release config
├── scripts/                   # bundle.sh (release bundler), bump-version.mjs
└── eslint.config.js           # Linting (no-explicit-any enforced)
```

### Applying changes to the MCP App

The MCP App sandbox does not allow loading external scripts, so the MCP App always uses the pre-built bundle.

| What changed                   | What to do                                   |
| ------------------------------ | -------------------------------------------- |
| Frontend code (`preview/src/`) | Rebuild: `npm run build --workspace=preview` |
| Server code (`server/src/`)    | Restart the MCP server in your client        |

### Scripts

```bash
npm run setup                         # Interactive setup wizard (ES credentials)
npm run build                         # Build both server and preview
npm run test                          # Run all tests (server + preview)
npm run lint                          # ESLint check
npm run typecheck                     # TypeScript check (both projects)
npm run format                        # Format all files with Prettier
npm run format:check                  # Check formatting without writing
npm run check                         # Run all checks (format + lint + typecheck)
npm run build --workspace=preview     # Build single-file MCP App

# Integration tests (require Docker)
cd server
npm run test:integration              # Run against default stack version
npm run test:integration:9.3          # Run against ES/Kibana 9.3.0
npm run test:integration:9.4          # Run against ES/Kibana 9.4.0-SNAPSHOT
npm run test:integration:all          # Run against both versions sequentially
```

### Testing

Tests use [Vitest](https://vitest.dev/) and [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/).

```bash
npm test                              # Run all unit tests
npm run test --workspace=server       # Server unit tests only
npm run test --workspace=preview      # Preview unit tests only
npm run test --workspace=setup        # Setup unit tests only
```

**Setup tests** cover `.env` parsing and writing (quote stripping, file permissions), config resolution, connection testing, and display helpers.

**Server unit tests** cover pure utility functions (ES|QL transforms, index pattern parsing, time field detection, slugify), the Lens forward/reverse translators, round-trip export-then-import fidelity, and dashboard translation.

**Preview tests** cover chart component rendering (correct chart type for each config), the `useEsqlQuery` hook (fetch, loading, error, abort, time range), and empty data states.

#### Integration tests

Integration tests exercise the full MCP client → server → Elasticsearch/Kibana roundtrip using [testcontainers](https://testcontainers.com/). They spin up real ES + Kibana containers with security enabled, seed test data, and interact with the server via both stdio and HTTP transports.

```bash
cd server
npm run test:integration              # Default stack version
npm run test:integration:9.3          # ES/Kibana 9.3.0 (saved objects API)
npm run test:integration:9.4          # ES/Kibana 9.4.0-SNAPSHOT (Dashboard API)
npm run test:integration:all          # Both versions sequentially
```

**Requirements:** Docker must be running. First run pulls the ES/Kibana images (~1GB each).

The same test suite runs against both **9.3** (saved objects API path) and **9.4** (new Dashboard API path) to verify both code paths in `export_to_kibana` and `import_from_kibana`. The stack version is configurable via the `STACK_VERSION` env var (or `ES_IMAGE`/`KIBANA_IMAGE` for full control).

### Releasing

Releases are cut by [semantic-release](https://github.com/semantic-release/semantic-release) from commit history — no hand-picked version numbers.

**How it works**

1. PRs are squash-merged into `main`. The PR title becomes the commit message.
2. A PR title must follow [Conventional Commits](https://www.conventionalcommits.org/) — enforced by the `PR title` workflow. Allowed types: `feat`, `fix`, `refactor`, `perf`, `build`, `chore`, `docs`, `revert`.
3. Trigger the `Release` workflow manually from `main` (Actions → Release → Run workflow). semantic-release:
   - Analyses commits since the last tag and decides the bump level (`feat` → minor, everything else → patch, `BREAKING CHANGE:` footer → major)
   - Bumps `manifest.json` + `server/package.json` and commits back to `main` with `[skip ci]`
   - Generates/updates `CHANGELOG.md`
   - Creates a GitHub release with the `.mcpb` + `.tgz` artifacts attached

**Local dry run** (no GitHub credentials needed):

```bash
npx semantic-release --dry-run --no-ci
```

### Code quality

- TypeScript strict mode enabled
- `no-explicit-any` enforced via ESLint
- Prettier formatting enforced
- Pre-commit hook runs lint-staged (format + lint on staged files)
- CI pipeline on GitHub Actions (format check + lint + typecheck + build + tests)
- Integration tests run against ES/Kibana 9.3 and 9.4 in parallel on CI
- Emotion theme types properly declared for EUI integration

## Credits

- [Elastic Charts](https://elastic.github.io/elastic-charts) for visualization rendering
- [@elastic/esql](https://github.com/nicolo-ribaudo/elastic-esql-js) for ES|QL query parsing
- [kbn-grid-layout](https://github.com/elastic/kibana) for the dashboard grid (adapted from Kibana)
- [Model Context Protocol](https://modelcontextprotocol.io) for AI tool integration
- [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) for inline UI rendering
- ES|QL reference docs adapted from Kibana's NL-to-ES|QL feature

## Licence

Licensed under [Elastic License 2.0](./LICENSE.txt).
