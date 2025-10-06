# Phase 0 Research — Section Draft Persistence

## Draft Storage Mechanism

- **Decision**: Persist drafts with `packages/editor-persistence` backed by
  IndexedDB (via `idb` adapter) and expose a typed API for section-level
  upserts.
- **Rationale**: Library is already the canonical store for editor state, offers
  async persistence primitives, and keeps the solution library-first per the
  constitution.
- **Alternatives Considered**:
  - _localStorage_: synchronous API, quota too small and unreliable for large
    architecture sections.
  - _File System Access API_: inconsistent browser support and elevated
    permissions.

## Draft Identifier Schema

- **Decision**: Compose draft keys from
  `[projectSlug]/[documentSlug]/[sectionTitle]/[authorId]`.
- **Rationale**: Guarantees uniqueness across projects and documents while
  remaining human-inspectable for CLI tooling.
- **Alternatives Considered**:
  - _Numeric section IDs only_: collisions when templates share IDs across
    documents.
  - _Random UUID per draft_: complicates recovery flow and requires additional
    lookup indices.

## Browser Quota Handling

- **Decision**: Detect quota errors raised by IndexedDB writes, prune oldest
  drafts locally, and show a toast plus draft status banner update.
- **Rationale**: Works within browser constraints, keeps drafts client-only, and
  aligns with spec requirement to explain pruning when storage is exhausted.
- **Alternatives Considered**:
  - _Periodic size checks_: no reliable cross-browser API for exact quota.
  - _Server spillover_: violates client-only persistence requirement.

## Accessibility Signaling

- **Decision**: Drive status indicators with visible text (e.g., "Draft saved")
  and announce transitions through an ARIA live region attached to the editor
  root.
- **Rationale**: Meets WCAG 2.1 AA expectations and satisfies clarified
  accessibility requirement.
- **Alternatives Considered**:
  - _Color-only badges_: inaccessible for low-vision users.
  - _Audio cues_: intrusive and not covered by existing UI patterns.

## Compliance Logging Strategy

- **Decision**: When retention policies demand server backups, record a
  compliance warning via the QA logging channel (`packages/qa`) without sending
  draft payloads; surface the message in developer console and server logs after
  reconnection.
- **Rationale**: Satisfies constitutional logging rules while preserving
  client-only storage guarantee.
- **Alternatives Considered**:
  - _Forced server sync_: contradicts security constraint.
  - _Ignoring policy_: creates audit gap and violates compliance requirement.

## Bundled Save Validation Ordering

- **Decision**: Validate drafts section-by-section client-side, send a single
  `PATCH /documents/{id}/sections` request with only approved sections, and map
  per-section validation results to UI feedback.
- **Rationale**: Aligns with FR-004/FR-010 for bundled saves and minimizes
  server load.
- **Alternatives Considered**:
  - _Multiple per-section requests_: increases network chatter and risks partial
    state.
  - _Server-first validation_: delays feedback when offline.

## System Context

- CTRL FreaQ runs as a pnpm monorepo with React 19 frontend (`apps/web`) and
  Express 5 backend (`apps/api`) wired together by shared packages.
- Document editor state relies on `packages/editor-persistence` for local
  storage abstractions and `packages/editor-core` (imported via
  `apps/web/src/features/document-editor`) for diff generation and validation.
- Authentication and identity are provided by Clerk; author IDs surface in
  drafts and compliance logs. Fixtures for local dev live under
  `/apps/web/src/mocks` and `/apps/api/src/mocks`.
- Quality gates and compliance messaging reuse helpers in `packages/qa`, which
  already exposes logging hooks consumed by both frontend and backend.
- Bundled saves ultimately persist architecture documents through existing
  document services in `apps/api/src/services/documents`. The new draft bundle
  endpoint sits in front of those services, applying validated patches.

## Codebase Summary

- **apps/web**: Vite/React app with feature-based modules. Document editor lives
  under `src/features/document-editor/`, leveraging Zustand stores, TanStack
  Query, and Milkdown. Playwright fixture tests reside in `apps/web/tests/e2e`.
- **apps/api**: Express server with route modules in `src/routes`, services in
  `src/services`, and Vitest contract/integration tests in `tests/`. Persistence
  is currently SQLite via `packages/persistence` with repository pattern.
- **packages/editor-persistence**: Provides IndexedDB-backed storage utilities
  exposing async CRUD plus CLI entry points. Tests here use Vitest and fake
  IndexedDB.
- **packages/qa**: Hosts quality gate definitions, logging helpers, and
  compliance utilities consumed across apps.
- **Tooling**: pnpm scripts run lint, test, typecheck, and gauntlet flows; Turbo
  orchestrates builds. Vitest is configured monorepo-wide, and Playwright E2E
  suites run behind `pnpm --filter @ctrl-freaq/web` commands.
- **Testing Philosophy**: Constitution mandates TDD—every implementation task
  must be preceded by failing tests. Contract tests live next to API routes;
  frontend unit tests sit alongside components/hooks, and E2E coverage uses
  fixture data under `apps/web/src/lib/fixtures`.
