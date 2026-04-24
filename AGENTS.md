# AGENTS.md

## Project overview

MCP app that lets AI assistants build Kibana dashboards using ES|QL and Elastic Charts. Monorepo with four workspaces: `shared`, `setup`, `server`, `preview`.

## Setup

```bash
npm install
npm run setup        # interactive Elasticsearch/Kibana connection config
npm run build        # build all workspaces (shared → server → preview)
```

## Commands

```bash
npm run test         # run all tests (shared, server, preview)
npm run lint         # eslint across all workspaces
npm run build        # build all workspaces in dependency order
npm run typecheck    # TypeScript check across all workspaces
npm run format       # format all files with Prettier
npm run format:check # check formatting without writing
npm run check        # run format:check + lint + typecheck
```

A pre-commit hook runs `lint-staged` (format + lint on staged files) and `typecheck` automatically. CI runs `format:check + lint + typecheck + build + tests`.

Do not use `npx vitest` directly — workspace configs set required environments (e.g. `jsdom` for preview).

## Workspaces

| Workspace | Purpose                            |
| --------- | ---------------------------------- |
| `shared`  | Shared types and utilities         |
| `setup`   | Interactive setup wizard (CLI)     |
| `server`  | MCP server, tools, translators     |
| `preview` | React preview app (Elastic Charts) |

Build order matters: `shared` → `setup` → `server` → `preview`. `npm run build` handles this.

## Code style

- TypeScript strict, no `any` (`@typescript-eslint/no-explicit-any: error`)
- Prefix unused variables with `_`
- Every `.ts`/`.tsx` file must start with the Elastic License 2.0 header
- Explicit named imports only — no barrel re-exports (`export * from`)
- Meaningful variable names, no abbreviations except widely known acronyms

## File organization

- Test files mirror source files: `foo.ts` → `foo.test.ts`. When splitting a source file, split its tests to match.

## Testing

- Tests use Vitest. Run via `npm run test`.
- Add or update tests for any code you change.
- When fixing tests, do not touch the implementation.
- When fixing a bug, do not touch the tests that surfaced it.

## Technical writing style

Direct factual statements. No filler words (just/simply/basically/very/really). Present tense verbs. Active voice. Under 20 words per sentence. If removing a word preserves meaning, remove it.

## manifest.json

The root `manifest.json` describes the MCP App for registries and installers. Keep it in sync with the server.

- The `tools` array must list every tool registered via `registerTool()` and `registerAppOnlyTool()`/`registerAppTool()` in `server/src/tools/`.
- Exclude internal tools prefixed with `app_only_` — those are implementation details for the preview UI.
- When adding, removing, or renaming a tool, update `manifest.json` in the same commit.
- Tool descriptions in the manifest should be concise (one sentence). They do not need to match the server description verbatim.
- `tools_generated: true` signals that the server may register tools dynamically. The manifest list is still the canonical reference for documentation and registry display.

To audit: compare `manifest.json` tool names against `grep -rh "registerTool\|registerAppOnlyTool\|registerAppTool" server/src/tools/*.ts`.

## Git rules

- Conventional commit prefixes (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`)
- No "Generated with" or "Co-authored" sections in commit messages
- Only `git add` files related to the current task
- Questions are not instructions — answer and stop. Do not make changes until explicitly told.
