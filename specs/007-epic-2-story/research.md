# Research Findings: Section Editor & WYSIWYG Capabilities

**Date**: 2025-09-25 **Feature**: Section Editor & WYSIWYG Capabilities
(007-epic-2-story)

## Technical Context Clarifications

### Coding Standards Resolution

**Decision**: Continue enforcing the repository ESLint flat config, Prettier
formatting, and Husky pre-commit gates defined in `eslint.config.js`,
`prettier.config.js`, and `.husky/` scripts.

**Rationale**:

- Architecture doc (`/docs/architecture.md`) calls out these tools as the
  authoritative quality gates.
- Constitution protects quality-control configs from modification, so adopting
  the existing stack keeps us compliant.
- Tooling already integrated with pnpm scripts (`pnpm lint`, `pnpm format`,
  `pnpm typecheck`) and CI pipelines.

**Alternatives considered**:

- Switching to Biome for formatting + linting was rejected because migration
  would violate the constitutional guardrail on quality gate changes.
- Disabling Husky during local development was rejected because it weakens the
  enforced TDD workflow.

### Test Strategy & Standards

**Decision**: Use Vitest with React Testing Library for unit/integration tests,
Playwright for end-to-end flows, and contract tests under `/apps/api/tests/`
using Zod schema assertions.

**Rationale**:

- `/docs/ui-architecture.md` and `/docs/architecture.md` specify Vitest +
  Playwright as standard tooling for the monorepo.
- Constitution mandates TDD and colocated unit tests, which Vitest supports.
- Existing contract suites under `/apps/api/tests/contract/` demonstrate the
  pattern to follow for new endpoints.

**Alternatives considered**:

- Jest was rejected because the repo is already optimized for Vitest + Vite.
- Cypress was rejected; Playwright coverage already satisfies the UI spec and
  provides better cross-browser validation.

## Workflow Research

### Conflict Detection Lifecycle

**Decision**: Track `approvedVersion` and `draftBaseVersion` per section and run
version comparison during edit entry and manual save. When mismatched, request a
server-side rebase that merges latest approved content with local draft patches
before resuming edits.

**Rationale**:

- Clarification mandates detection both on entry and save; version tokens allow
  constant-time detection.
- Rebase aligns with existing Git-style patch engine in
  `/packages/editor-core/src/patch-engine.ts`.
- Server-managed merges avoid leaking stale draft content across clients.

**Alternatives considered**:

- Optimistic locking via timestamps risks collision due to client clock drift.
- Rejecting saves outright would violate the UX requirement to reapply edits.

### Manual Draft Persistence Strategy

**Decision**: Persist manual saves via the `editor-persistence` package backed
by IndexedDB through localforage, while the API stores canonical drafts with
`draftVersion` and `summaryNote` metadata.

**Rationale**:

- Manual "Save Draft" aligns with Clarifications (no autosave).
- `editor-persistence` already abstracts browser storage and replay of patches.
- Aligns with library-first approach by reusing shared persistence utilities
  instead of duplicating logic in the web app.

**Alternatives considered**:

- Auto-save intervals were rejected because spec explicitly disables automatic
  sync.
- Using raw localStorage was rejected due to payload size and lack of async API.

### Diff Presentation & Review

**Decision**: Generate draft vs approved diffs through `editor-core` patch
engine, expose via `/sections/{id}/diff` endpoint returning structured hunks,
and render using a dedicated React diff viewer that highlights additions and
removals alongside metadata.

**Rationale**:

- FR-004 requires an at-a-glance comparison before review submission.
- Reusing existing diff utilities keeps implementation consistent.
- Structured response enables accessible diff rendering without text parsing on
  the client.

**Alternatives considered**:

- Computing diffs on the client was rejected because it risks inconsistent
  results and large payloads.

### Unsupported Formatting Highlighting

**Decision**: Implement a Milkdown plugin that inspects ProseMirror node marks
against allowed syntax and wraps unsupported content with a warning mark that
maps to a shadcn/ui callout in read-only preview.

**Rationale**:

- FR-003 allows applying formatting even when invalid but must highlight
  violations.
- Milkdown plugin system already used in `/apps/web/src/features/section-editor`
  so the behavior can remain encapsulated.
- Visual highlight ensures the user can fix formatting before finalize.

**Alternatives considered**:

- Blocking invalid formatting entirely contradicts the clarification.
- Post-save validation only would delay feedback and risk data loss.

### Performance & Accessibility Alignment

**Decision**: Preload section content and editor assets before switching to edit
mode, reuse the existing skeleton UI for non-blocking loads, and enforce
keyboard shortcuts defined in `/docs/front-end-spec.md` to stay under the 300 ms
transition target.

**Rationale**:

- Clarifications require 300 ms edit mode entry; preloading resources reduces
  runtime work.
- Accessibility requirement (FR-007) demands keyboard and screen reader support.
- Aligns with UI architecture guidance around streaming-friendly UX.

**Alternatives considered**:

- Lazy-loading Milkdown at edit time exceeded the 300 ms budget in tests from
  prior stories; eager loading in background is safer.

## Additional Notes

- Specification assets live in `specs/007-epic-2-story/` (provided as
  `$ARGUMENTS`) and serve as the canonical reference during execution.
- Constitution rules around observability apply; new endpoints must log
  `requestId`, authentication context, and conflict outcomes.

## Resolved Unknowns

All NEEDS CLARIFICATION markers from the plan template and spec kit
configuration have concrete decisions documented above. No open questions
remain.

## System Context

- CTRL FreaQ is a pnpm workspace targeting Node.js 22 and TypeScript 5.4 with
  React 18 on the web and Express 5 on the API; all commands run from the repo
  root (`/`).
- Quality gates are enforced by `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:contracts`, and Husky pre-commit hooks; modifying lint/type configs
  is prohibited by the constitution.
- Section editing relies on shared libraries: `@ctrl-freaq/shared-data` for
  SQLite access, `@ctrl-freaq/editor-core` for diff + patch helpers, and
  `@ctrl-freaq/editor-persistence` for IndexedDB-backed manual drafts.
- Authentication is provided by Clerk middleware already wired into
  `/apps/api/src/routes/sections.ts`; all new endpoints must validate JWTs, emit
  structured logs with `requestId`, `sectionId`, and `draftId`, and honour rate
  limiting.
- Frontend state management uses TanStack Query for API fetching and Zustand for
  editor state; Milkdown 7.15 powers the WYSIWYG experience and must preload
  assets to keep edit-mode transitions under 300 ms.
- Observability requirements from the constitution demand structured logging,
  telemetry for edit-mode timing, and audit trails for approvals and conflict
  resolution events.

## Codebase Summary

- **API**: `/apps/api/src/app.ts` boots Express. Feature modules live under
  `/apps/api/src/modules`; register services via
  `/apps/api/src/services/container.ts` and expose routes in
  `/apps/api/src/routes/sections.ts`. Contract tests reside in
  `/apps/api/tests/contract/` and should assert Zod schemas defined in
  `/apps/api/src/modules/section-editor/validation/`.
- **Shared Data**: `/packages/shared-data/src` houses Zod schemas and repository
  classes using better-sqlite3. New schemas must be exported through
  `models/index.ts`, `repositories/index.ts`, and the package root index after
  adding SQL migrations in `/packages/shared-data/migrations/`.
- **Editor Core**: `/packages/editor-core/src/patch-engine.ts` supplies diff
  helpers. Extend this module (or add a sibling under `diff/`) for structured
  diff hunks consumed by both API services and React components.
- **Persistence**: `/packages/editor-persistence/src` wraps localforage for
  IndexedDB storage with telemetry hooks. Manual "Save Draft" flows should reuse
  these helpers instead of introducing new storage abstractions.
- **Web App**: Section editor features live in
  `/apps/web/src/features/section-editor/`, while document-level wiring lives in
  `/apps/web/src/features/document-editor/`. Keep components, hooks, and stores
  colocated with matching `*.test.tsx` files.
- **Testing**: Vitest integration suites for the web app reside in
  `/apps/web/tests/integration/`, Playwright E2E suites in
  `/apps/web/tests/e2e/`, and editor performance telemetry should surface via
  Playwright custom measurements. Contract tests drive TDD for API endpoints.
- **Documentation**: Update `/docs/ui-architecture.md` and feature quickstart
  guides when workflows change so future automation has authoritative context.
- **Tooling**: Use pnpm workspaces, lint-staged, and Husky defaults. Run
  `pnpm build` prior to release to ensure all packages compile with new
  entities, services, and bundles.
