# Contributing

Thanks for your interest in this project. This document describes how to set up a local environment, how we expect changes to be tested and reviewed, and how releases work.

## License

By contributing, you agree that your contributions are licensed under the [Elastic License 2.0](LICENSE.txt), the same license as the project.

## Architecture

For Mermaid diagrams (system context, data flows, monorepo build order), see [ARCHITECTURE.md](ARCHITECTURE.md).

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
│  └── Data via callServerTool(“run_esql_query”)  │
├─────────────────────────────────────────────────┤
│  Elasticsearch  ←→  Kibana                      │
└─────────────────────────────────────────────────┘
```

The server supports two transports: **stdio** (default) for standard MCP clients, and **HTTP** (`--http` flag) with streamable HTTP and session management. The MCP App communicates with the server entirely via the MCP Apps protocol (postMessage) — no localhost server dependency. App-only tools (`visibility: [“app”]`) handle all UI↔server interaction including data fetching, layout persistence, and time field detection.

## Development setup

**Prerequisites:** Node.js 22+, npm, and—if you run integration tests—Docker.

```bash
git clone https://github.com/elastic/example-mcp-dashbuilder.git
cd example-mcp-dashbuilder
npm install
```

`postinstall` builds the `preview` workspace. For a full build and interactive Elasticsearch/Kibana configuration:

```bash
npm run build
npm run setup   # writes a gitignored .env with connection details
```

To run the MCP server from a clone, use the repo’s `start-server.sh` and point your MCP client at it (see [README.md](README.md)).

## Project structure

```
├── server/                    # MCP Server
│   └── src/
│       ├── index.ts           # Entry point (stdio default, --http flag)
│       ├── server.ts          # MCP server factory (tools, resources)
│       ├── app.ts             # HTTP transport (Express, session mgmt)
│       ├── types.ts           # Shared types
│       ├── tools/             # MCP tool implementations
│       │   ├── view-dashboard.ts  # MCP Apps inline preview + resources
│       │   └── app-only-tools.ts  # App-only tools (visibility: [“app”])
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
├── scripts/                   # bundle.sh (release bundler)
└── eslint.config.js           # Linting (no-explicit-any enforced)
```

Build order: `setup` → `server` → `preview`. `npm run build` runs the full chain.

`AGENTS.md` in the repo root summarizes commands, style, and testing expectations for day-to-day work.

## Inline dashboard preview internals

The preview app is bundled into a single HTML file and served as an MCP App resource:

1. `npm run build --workspace=preview` builds the React app into a single self-contained HTML file (~2.5MB, ~577KB gzipped) using `vite-plugin-singlefile`
2. The MCP server reads this file and serves it as an MCP App resource with `mimeType: ‘text/html;profile=mcp-app’`
3. The host renders the HTML in a sandboxed iframe
4. The app communicates with the MCP server via the ext-apps client SDK (`callServerTool()` over postMessage)
5. Charts render with Elastic Charts + Borealis theme

The sandbox does not allow loading external scripts, so the app always uses the pre-built bundle.

| What changed                   | What to do                                   |
| ------------------------------ | -------------------------------------------- |
| Frontend code (`preview/src/`) | Rebuild: `npm run build --workspace=preview` |
| Server code (`server/src/`)    | Restart the MCP server in your client        |

## Scripts

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
```

## What to run before opening a PR

```bash
npm run check    # format:check + lint + typecheck
npm test         # all unit tests
npm run build    # full workspace build
```

If your change affects server behavior against Elasticsearch/Kibana, run integration tests locally (Docker required):

```bash
cd server
npm run test:integration
```

CI runs the same checks plus integration tests against ES/Kibana 9.3.0 and 9.4.0-SNAPSHOT. Fix anything that fails in CI before asking for review.

**Do not run `npx vitest` at the repo root** without the workspace config — use `npm test` or `npm run test --workspace=<workspace>` so the right environment (e.g. `jsdom` for `preview`) is applied.

## Testing

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

### Integration tests

Integration tests exercise the full MCP client → server → Elasticsearch/Kibana roundtrip using [testcontainers](https://testcontainers.com/). They spin up real ES + Kibana containers with security enabled, seed test data, and interact with the server via both stdio and HTTP transports.

```bash
cd server
npm run test:integration              # Default stack version
npm run test:integration:9.3          # ES/Kibana 9.3.0 (saved objects API)
npm run test:integration:9.4          # ES/Kibana 9.4.0-SNAPSHOT (Dashboard API)
npm run test:integration:all          # Both versions sequentially
```

**Requirements:** Docker must be running. First run pulls the ES/Kibana images (~1GB each).

The same suite runs against both **9.3** (saved objects API path) and **9.4** (new Dashboard API path) to verify both code paths in `export_to_kibana` and `import_from_kibana`. The stack version is configurable via `STACK_VERSION` (or `ES_IMAGE`/`KIBANA_IMAGE` for full control).

Tests should live next to code: `foo.ts` → `foo.test.ts`. When you change behavior, add or update tests. Do not weaken tests to make them pass — when fixing a bug, keep the test that exposed it.

## Code style

- TypeScript strict; ESLint disallows `any` (`@typescript-eslint/no-explicit-any: error`).
- Prettier is the source of truth for formatting. A Husky pre-commit hook runs `lint-staged` on staged files and `typecheck` on the tree.
- Every new or touched `.ts` / `.tsx` file must keep the **Elastic License 2.0** file header.
- Use **named imports** only; do not add barrel re-exports (`export * from`).
- Prefix unused bindings with `_`.
- Prefer clear names; avoid cryptic abbreviations except common acronyms.

## Pull requests: titles and commits

This repository **squash-merges** into `main`. The **PR title** becomes the squash commit message, and [semantic-release](https://github.com/semantic-release/semantic-release) uses it to pick the next version.

- The [PR title workflow](.github/workflows/pr-title.yml) enforces [Conventional Commits](https://www.conventionalcommits.org/)-style titles.
- Allowed types: `feat`, `fix`, `refactor`, `perf`, `build`, `chore`, `docs`, `revert` (no scope required).
- The **subject** must start with an **uppercase** letter (e.g. `feat: Add heatmap color ramp to export`).

Use the same prefix style in your own commits if you use multiple commits in a branch; the squash title still drives the release note.

## Releases

Releases are automated via the `Release` GitHub Actions workflow — no manual version bumping.

**How it works:**

1. PRs are squash-merged into `main`. The PR title becomes the commit message.
2. Go to **Actions → Release → Run workflow** from `main` to trigger a release.
3. The workflow runs all checks and tests, bundles the release artifacts (`.mcpb` + `.tgz`), then runs `semantic-release`.
4. `semantic-release` analyses commits since the last tag, determines the version bump (`feat` → minor, everything else → patch, `BREAKING CHANGE:` footer → major), and publishes a GitHub release with the artifacts attached.

You do not need to hand-edit version numbers in a normal contribution.

## Getting help

- [README.md](README.md) — product behavior, setup, and troubleshooting.
- [ARCHITECTURE.md](ARCHITECTURE.md) — architecture with Mermaid diagrams.
- [AGENTS.md](AGENTS.md) — short reference for maintainers and tooling (commands, style, tests).

Open an issue or discussion on the project’s issue tracker if something in this document is wrong or missing.
