# Research Findings: New Section Content Flow

**Date**: 2025-09-29 **Feature**: New Section Content Flow (009-epic-2-story-4)

## Technical Context Clarifications

### Assumption Prompt Prioritisation

**Decision**: Rank prompts using template-declared priority, unresolved document
risks, then chronological section history, falling back to template order.

**Rationale**:

- `docs/front-end-spec.md` expects the checklist to surface high-impact
  assumptions first so engineers address gating risks before drafting.
- Using template metadata keeps behaviour deterministic across CLI and UI
  consumers.
- Incorporating document risk flags ensures recently escalated issues appear at
  the top without recalculating the entire template.

**Alternatives considered**:

- Purely chronological ordering ignores template guidance and could delay
  critical security or compliance prompts.
- AI-scored priority was rejected because it introduces non-deterministic
  ordering and complicates CLI parity.

### Override Persistence Strategy

**Decision**: Store override decisions and proposal lineage in the
`@ctrl-freaq/editor-persistence` library (IndexedDB) for local resume, while the
API (`packages/shared-data` + SQLite) keeps canonical override audit logs tied
to `AssumptionSession` rows.

**Rationale**:

- Constitution requires library-first reuse; `editor-persistence` already owns
  offline-safe storage and CLI access.
- Persisting overrides server-side lets reviewers audit who skipped prompts and
  blocks submission until all overrides are resolved.
- Dual persistence keeps the UX resilient offline yet authoritative once back
  online.

**Alternatives considered**:

- Storing overrides only on the server would force redundant network calls for
  in-progress sessions, harming performance targets.
- Client-only storage breaks review transparency and contradicts FR-007 audit
  expectations.

### AI Draft Fallback Handling

**Decision**: Provide a deterministic fallback that keeps the section in
drafting mode with the assumption summary visible, prompt the user to retry or
switch to manual authoring, and mark the proposal slot as "AI failed" in the
session history.

**Rationale**:

- Spec requires humans remain in control; fallback must not auto-complete the
  draft with low-confidence content.
- Logging the failed attempt preserves the audit trail so reviewers understand
  why manual content exists.
- Retry plus manual option keeps flow usable when LLM access is throttled or
  offline.

**Alternatives considered**:

- Automatically escalating to reviewers would block engineers from continuing
  their work and create unnecessary notifications.
- Silent failures were rejected because they erode trust and make it unclear why
  no proposal appeared.

## Repository Context

### Changelog Reference

**Decision**: Document lack of `CHANGELOG.md` in this branch and rely on
`docs/prd.md` Epic 2 narrative plus prior specs for historical context.

**Rationale**:

- `.specify.yaml` points to `CHANGELOG.md`, but the file is missing; noting the
  gap signals reviewers to treat PRD + architecture docs as the authoritative
  timeline.
- Avoids duplicating history elsewhere while keeping future updates aligned once
  the changelog is restored.

**Alternatives considered**:

- Creating a placeholder changelog entry now was rejected to prevent accidental
  divergence from the eventual repo-wide log.

## Open Questions

None. Phase 1 may proceed.

## System Context

- `docs/prd.md` positions Epic 2 as the document editor core, requiring
  section-based editing, assumption resolution loops, and traceable audit trails
  for every draft.
- `docs/architecture.md` documents the modular monolith Express API backed by
  SQLite through `@ctrl-freaq/shared-data`, with libraries exposing CLI entry
  points per the constitution.
- `docs/ui-architecture.md` and `docs/front-end-spec.md` define the React
  application structure: feature-based folders under `/apps/web/src/features/`,
  Milkdown editors, TanStack Query for server state, and deterministic fixtures
  for Playwright coverage.
- The constitution mandates library-first reuse, CLI parity, strict TDD, and
  structured logging. New assumption flows must plug into existing CLI wrappers,
  service container wiring, and logging conventions to stay compliant.
- Changelog context is absent (`CHANGELOG.md` missing); treat the PRD and
  existing specs as the authoritative timeline until the repo-wide changelog is
  restored.

## Codebase Summary

- Backend (`/apps/api`) uses Express 5 with a service container
  (`/apps/api/src/services/container.ts`) to wire repositories from
  `@ctrl-freaq/shared-data`. Section-focused routes live in
  `/apps/api/src/routes/sections.ts` and call service layers under
  `/apps/api/src/modules/section-editor/services/` with Zod validation in the
  companion `validation` folder.
- Shared persistence lives in `/packages/shared-data`, which provides SQLite
  migrations, repositories, and TypeScript models. Existing section artifacts
  (drafts, reviews, conflict logs) already use this package and expose CLI
  commands via `packages/shared-data/src/cli.ts`.
- Client-side offline storage and CLI utilities live in
  `/packages/editor-persistence`, offering IndexedDB-backed storage wrappers
  (`storage/`) and sync helpers reused by the web client and CLI flows.
- Frontend code resides in `/apps/web`. Feature modules follow the
  `features/<feature-name>` convention with co-located components, hooks,
  services, and stores. Document editor APIs call
  `/apps/web/src/features/ document-editor/services/sections-api.ts`, and stores
  live in `.../stores/`. Deterministic fixtures for Playwright are provided
  under `/apps/web/src/lib/fixtures/`.
- Tests follow the constitution: Vitest unit/integration specs colocated with
  features and `/apps/api/tests/contract/` for contract tests. Playwright E2E
  suites live under `/apps/web/tests/e2e/` with deterministic fixture mode.
