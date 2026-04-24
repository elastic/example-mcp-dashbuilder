# Contributing

Thanks for your interest in this project. This document describes how to set up a local environment, how we expect changes to be tested and reviewed, and how releases work.

## License

By contributing, you agree that your contributions are licensed under the [Elastic License 2.0](LICENSE.txt), the same license as the project.

## Development setup

**Prerequisites:** Node.js 20+ (CI uses Node 22 for the main check job and Node 20 for integration tests), npm, and—if you run integration tests—Docker.

```bash
git clone https://github.com/elastic/example-mcp-dashbuilder.git
cd example-mcp-dashbuilder
npm install
```

`postinstall` builds the `shared` and `preview` workspaces. For a full build and interactive Elasticsearch/Kibana configuration:

```bash
npm run build
npm run setup   # writes a gitignored .env with connection details
```

To run the MCP server from a clone, use the repo’s `start-server.sh` and point your MCP client at it (see [README.md](README.md)).

## Monorepo layout

| Workspace | Role                                    |
| --------- | --------------------------------------- |
| `shared`  | Shared types and utilities              |
| `setup`   | Interactive setup wizard (CLI)          |
| `server`  | MCP server, tools, translators          |
| `preview` | React MCP App (single-file HTML bundle) |

Build order: `shared` → `setup` → `server` → `preview`. `npm run build` runs the full chain.

`AGENTS.md` in the repo root summarizes commands, style, and testing expectations for day-to-day work.

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

**Do not run `npx vitest` at the repo root** without the workspace config—use `npm test` or `npm run test --workspace=<workspace>` so the right environment (e.g. `jsdom` for `preview`) is applied.

## Code style

- TypeScript strict; ESLint disallows `any` (`@typescript-eslint/no-explicit-any: error`).
- Prettier is the source of truth for formatting. A Husky pre-commit hook runs `lint-staged` on staged files and `typecheck` on the tree.
- Every new or touched `.ts` / `.tsx` file must keep the **Elastic License 2.0** file header.
- Use **named imports** only; do not add barrel re-exports (`export * from`).
- Prefix unused bindings with `_`.
- Prefer clear names; avoid cryptic abbreviations except common acronyms.

Tests should live next to code: `foo.ts` → `foo.test.ts`. When you change behavior, add or update tests. Per project policy: do not “fix” implementation by weakening tests; when fixing a bug, do not change the tests that exposed the bug to make them pass.

## Pull requests: titles and commits

This repository **squash-merges** into `main`. The **PR title** becomes the squash commit message, and [semantic-release](https://github.com/semantic-release/semantic-release) uses it to pick the next version.

- The [PR title workflow](.github/workflows/pr-title.yml) enforces [Conventional Commits](https://www.conventionalcommits.org/)-style titles.
- Allowed types: `feat`, `fix`, `refactor`, `perf`, `build`, `chore`, `docs`, `revert` (no scope required).
- The **subject** must start with an **uppercase** letter (e.g. `feat: Add heatmap color ramp to export`).

Use the same prefix style in your own commits if you use multiple commits in a branch; the squash title still drives the release note.

## Releases

Releases are automated with semantic-release; maintainers trigger the workflow from `main` as documented in [README.md](README.md) under “Releasing”. You do not need to hand-edit version numbers in a normal contribution.

## Getting help

- [README.md](README.md) — product behavior, quick architecture diagram, and troubleshooting.
- [ARCHITECTURE.md](ARCHITECTURE.md) — architecture with diagrams (Mermaid).
- [AGENTS.md](AGENTS.md) — short reference for maintainers and tooling (commands, style, tests).

Open an issue or discussion on the project’s issue tracker if something in this document is wrong or missing.
