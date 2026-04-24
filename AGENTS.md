# AGENTS.md

## Project overview

MCP app that lets AI assistants build Kibana dashboards using ES|QL and Elastic Charts. Monorepo with three workspaces: `shared`, `server`, `preview`.

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
```

Run `npm run test` and `npm run lint` before committing. Both must pass.

Do not use `npx vitest` directly — workspace configs set required environments (e.g. `jsdom` for preview).

## Workspaces

| Workspace | Purpose                            |
| --------- | ---------------------------------- |
| `shared`  | Shared types and utilities         |
| `server`  | MCP server, tools, translators     |
| `preview` | React preview app (Elastic Charts) |

Build order matters: `shared` → `server` → `preview`. `npm run build` handles this.

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

## Git rules

- Conventional commit prefixes (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`)
- No "Generated with" or "Co-authored" sections in commit messages
- Only `git add` files related to the current task
- Questions are not instructions — answer and stop. Do not make changes until explicitly told.
