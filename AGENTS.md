# Repository Guidelines

## Project Structure & Module Organization

CTRL FreaQ is a pnpm monorepo. User-facing apps live under `apps/` (`web` for
the React client, `api` for the Express backend). Reusable primitives stay in
`packages/` (editor, templates, persistence, qa, etc.); each package exposes a
CLI via `pnpm --filter`. Specification and planning assets reside in
`specs/006-story-2-2/`. Shared documentation sits in `docs/`, while generated
artifacts land in `dist/`. Treat `templates/` as authoritative examples for
document schemas.

## Build, Test & Development Commands

Use `pnpm install` to sync workspace dependencies. `pnpm dev` boots the full
stack (web on 5173, api on 5001). `pnpm build` compiles every package. Validate
code with `pnpm lint`, `pnpm typecheck`, and `pnpm format --check` (when
needed). Run unit suites via `pnpm test`; execute contract coverage with
`pnpm test:contracts` before proposing backend changes. Library CLIs expose
package-specific flows, e.g.
`pnpm --filter @ctrl-freaq/templates cli validate sample.yaml`.

## Coding Style & Naming Conventions

Codebase is TypeScript-first; avoid stray `.js` unless build output. Follow
Prettier (`tabWidth: 2`, single quotes, trailing commas) and ESLint settings
(React, security, import ordering). Prefer descriptive PascalCase for React
components, camelCase for functions/variables, kebab-case for file names, and
snake_case for config keys when required by external schemas. All Markdown
should wrap at 80 characters per repo style.

## Testing Guidelines

Vitest powers unit and integration tests; name files `*.test.ts(x)` alongside
the source. Use Playwright for E2E flows ( see `apps/web/tests`). Add regression
coverage for every bug fix and new feature, keeping mocks in `__mocks__`.
`pnpm test -- --coverage` is available locally; maintain or increase existing
coverage deltas. Contract tests in `specs/` must stay green before merging.

## Commit & Pull Request Guidelines

Adopt Conventional Commits (e.g. `feat: add section placeholder state`). Squash
locally so each pull request merges cleanly. PRs should include problem context,
solution summary, screenshots for UI changes, and references to spec items
(Story 2.2, etc.). Confirm `pnpm lint`, `pnpm test`, `pnpm test:contracts`, and
`pnpm build` succeed before requesting review. Link any related issues and call
out follow-up work explicitly.

## Agent Workflow Notes

Flag ambiguities as **Open Questions**, propose options, and record decisions
inline or in commit messages. Default to repository constraints (library-first,
mandatory TDD) when uncertain, and update this guide if a new pattern becomes
binding.

Within the WebStorm MCP server context:

- Agents must never invoke `execute_terminal_command`; use the approved built-in
  tool instead.
- Agents must never invoke `get_file_text_by_path`; use the approved built-in
  tool instead.

## Runtime Conventions

When working with Python:

- Always prefer Python 3 (`python3`) over the deprecated Python 2 (`python`).
- Do not use `python` (which may be Python 2.x on some systems).
- Use `/usr/bin/env python3` shebang style for inline execution.

When working with YAML:

- First try `yq eval -o=json <file>` to convert YAML → JSON.
- If `yq` is not available, then fallback to Python 3 with PyYAML.

When considering how to interact with a third-party library (e.g. 'localforage',
'react-router-dom', etc.):

- Consult the context7 MCP server for API guidance.

## Constitutional Compliance

Read and follow the [Constitutional Compliance](CONSTITUTION.md) guidelines.
