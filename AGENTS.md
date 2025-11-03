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

### Project Command Crib Sheet

- `pnpm build`: Turbo build across all workspaces; obeys build graph/caching.
- `pnpm clean`: turbo clean plus delete node_modules; resets workspace caches.
- `pnpm commitlint`: Runs Commitlint against staged message (usually via
  CI/hooks).
- `pnpm dev`: Turbo dev for everything with concurrency cap of 12. This command
  does not exit and must be killed manually.
- `pnpm dev:apps`: Dev mode limited to @ctrl-freaq/web and @ctrl-freaq/api. This
  command does not exit and must be killed manually.
- `pnpm dev:apps:e2e`: Launches API and web together in fixture profile (exports
  `CTRL_FREAQ_PROFILE=fixture`, loads `.env.fixture`, ignores `.env.local`). Use
  this for deterministic dashboard fixture flows. This command does not exit and
  must be killed manually.
- `pnpm --filter @ctrl-freaq/web dev:live`: Vite dev server pointed at live
  services (`VITE_E2E` unset). This command does not exit and must be killed
  manually.
- `pnpm format`: Prettier write on entire repo.
- `pnpm format:check`: Prettier check only (fails on diff).
- `pnpm lint`: Repo-wide Turbo lint with --force (rerun all) then repo ESLint
  cache pass.
- `pnpm lint:quick`: Quick cached Turbo lint then repo ESLint cache pass.
- `pnpm lint:ci`: Repo ESLint with --max-warnings=0.
- `pnpm lint:fix`: Repo ESLint with --fix.
- `pnpm lint:fix:check`: ESLint --fix-dry-run preview.
- `pnpm lint:repo`: Repo ESLint with cache (baseline command).
- `pnpm lint:yaml`: ESLint focused on .yml/.yaml.
- `pnpm test`: Repository gauntlet (Vitest with
  `--force --cache=local:,remote:r`, then fixture and visual Playwright).
- `pnpm test:debug`: Gauntlet with `VITEST_DEBUG` and `PLAYWRIGHT_DEBUG`
  enabled; reserve for diagnosing multi-suite failures that need full logs.
- `pnpm test:quick`: Vitest-only feedback loop across workspaces.
- `pnpm test:unit:ci`: Forces Turbo to rerun every Vitest suite without cache.
- `pnpm test:unit:debug`: Adds `VITEST_DEBUG=1` so Vitest prints all console
  output; use when investigating noisy or flaky specs locally.
- `pnpm test:gauntlet`: Explicit alias when CI scripts need the gauntlet
  directly.
- `pnpm test:ci`: Lint, typecheck, and gauntlet in a single command.
- `pnpm --filter @ctrl-freaq/web test:e2e:quick`: Fixture Playwright suite for
  fast iteration.
- `pnpm --filter @ctrl-freaq/web test:e2e:ci`: Fixture Playwright configured for
  CI parity.
- `pnpm test:e2e:debug`: Fixture Playwright with `PLAYWRIGHT_DEBUG=1`; enables
  verbose reporters and always-on traces for thorny UI failures.
- `pnpm --filter @ctrl-freaq/web test:live`: Live Playwright harness (opt-in).
- `pnpm --filter @ctrl-freaq/web test:visual:quick`: Visual regression quick
  loop.
- `pnpm --filter @ctrl-freaq/web test:visual:ci`: Visual regression with CI
  reporters.
- `pnpm test:visual:debug`: Visual regression with `PLAYWRIGHT_DEBUG=1`; pull
  this out when diffing snapshots and you need extra artifacts.
- `pnpm typecheck`: Builds the repo first, then runs Turbo typecheck with
  `--force` (no cache).
- `pnpm typecheck:noemit`: TypeScript `--noEmit` pass assuming build outputs are
  already in place.
- `pnpm typecheck:quick`: Quick cached Turbo typecheck.

To scope any command to one workspace, add `--filter <package>` (e.g.
`pnpm --filter @ctrl-freaq/web lint`).

### Fixture Profile Expectations

- `CTRL_FREAQ_PROFILE=fixture` prompts the API and web loaders to apply
  `.env.fixture` before `.env.local`, ensuring consistent simple-auth settings.
- Fixture mode relies on committed assets at `apps/api/.env.fixture`,
  `apps/web/.env.fixture`, and `apps/api/fixtures/simple-auth-users.yaml`. Do
  not modify these files locally; create overrides in `.env.local` when you are
  not running fixture mode.

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
coverage deltas. Contract tests in `specs/` must stay green before merging. When
your change hits the integration triggers in `CONSTITUTION.md` (new or updated
public APIs, shared schemas, inter-service flows, etc.), add or update
integration tests before opening a PR.

## Commit & Pull Request Guidelines

Adopt Conventional Commits (e.g. `feat: add section placeholder state`). Squash
locally so each pull request merges cleanly. PRs should include problem context,
solution summary, screenshots for UI changes, and references to spec items
(Story 2.2, etc.). Confirm `pnpm lint`, `pnpm test`, `pnpm test:contracts`, and
`pnpm build` succeed before requesting review. Link any related issues and call
out follow-up work explicitly.

## Runtime Conventions

- Do not use Python 2. If you need Python, default to Python 3.
- Consult the context7 MCP server for updated API guidance.
- To convert YAML → JSON first try `yq eval -o=json <file>`, if `yq` is not
  available, then fallback to Python 3 with PyYAML.

## MCP Usage Guidance

### Playwright MCP

When using `mcp__playwright__browser_take_screenshot` on the Playwright MCP
server:

- use the image format `jpeg` for the `type` argument (do **NOT** use `png`)
- use a value of 70 for the `quality` argument
- after taking a screenshot using the `resize` command to down-size to 75%

## Constitutional Compliance

Read and follow the [Constitutional Compliance](CONSTITUTION.md) guidelines.
