# Implementation Plan: Surface Document Editor

**Branch**: `015-surface-document-editor` | **Date**: 2025-11-05 | **Spec**:
[`spec.md`](./spec.md)  
**Input**: Feature specification from
`/specs/015-surface-document-editor/spec.md`

This plan captures the `/speckit.plan` workflow with clarifications resolved on
2025-11-05.

## Summary

Surface the document editor from the Project view by discovering or provisioning
a project’s primary document, routing users into the editor with live data, and
enabling full collaboration (manual saves, conflicts, co-authoring, QA, template
validation, export) directly from the UI. Backend additions provide document
discovery/creation/export endpoints while frontend updates replace fixture-only
bootstrapping with live services and wire the existing workflow cards and editor
components accordingly.

## Technical Context

**Language/Version**: TypeScript targeting Node.js 20 (Express backend) and
React 19 (Vite frontend) within a pnpm/Turborepo workspace.  
**Primary Dependencies**: Express.js, React Router 7, TanStack Query, Zustand,
shadcn/ui, `@ctrl-freaq` libraries (templates, shared-data, editor-persistence,
exporter), Event Hub SSE utilities.  
**Storage**: SQLite via `@ctrl-freaq/shared-data`; browser-local drafts handled
by `@ctrl-freaq/editor-persistence`.  
**Testing**: Vitest (unit + contract), Playwright fixture suites, pnpm gauntlet
(`pnpm test`), plus lint/typecheck gates.  
**Target Platform**: Local-first dev stack (macOS/Linux) with Express API and
browser client; supports fixture profile for deterministic tests.  
**Project Type**: pnpm monorepo with `apps/api`, `apps/web`, and reusable
packages under `packages/`.  
**Performance Goals**: Meet spec success criteria (document open ≤5 s for 95%
cases, document creation success 90%, conflict resolution within 2 min,
QA/export feedback ≤30 s).  
**Constraints**: Preserve existing clickable card accessibility pattern (per
clarification), ensure fixture mode compatibility, honour library-first/CLI
mandates, maintain SSE fallbacks, avoid introducing non-TypeScript runtimes.  
**Scale/Scope**: MVP focuses on a single primary architecture document per
project with dozens of collaborators and concurrent editing/streaming needs.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Library-First Architecture**: Backend logic extends existing `apps/api`
  modules and shared repositories; reusable pieces promoted to `packages/` with
  CLI exposure.
- **CLI Interface Standard**: Any new exporter/template capabilities exposed via
  API must also be callable via pnpm CLI commands to satisfy the constitution.
- **Test-First Development (NON-NEGOTIABLE)**: Failing tests precede
  implementation for discovery, creation, editor bootstrap, and workflow
  interactions; final verification requires `pnpm lint`, `pnpm typecheck`, and
  gauntlet.
- **Security & Audit**: New endpoints respect auth middleware, propagate request
  IDs, and log lifecycle events per constitutional logging rules.
- **Quality Gates Discipline**: QA dashboard integration must keep telemetry and
  fixtures deterministic.
- **Simplicity**: No new services are introduced; enhancements build on the
  existing modular monolith.

## Project Structure

### Documentation (this feature)

```
specs/015-surface-document-editor/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md            # produced during /speckit.tasks
```

### Source Code (repository root)

```
apps/
├── api/
│   ├── src/
│   │   ├── routes/
│   │   ├── modules/
│   │   ├── services/
│   │   └── middleware/
│   └── tests/
└── web/
    ├── src/
    │   ├── app/router/
    │   ├── pages/
    │   ├── features/
    │   │   ├── document-editor/
    │   │   └── section-editor/
    │   ├── stores/
    │   └── lib/
    └── tests/

packages/
├── shared-data/
├── templates/
├── exporter/
└── editor-persistence/
```

**Structure Decision**: Reuse the established monorepo layout—backend work lives
in `apps/api` (routes/services/modules) while frontend work touches `apps/web`
pages, document-editor feature modules, and supporting stores. Cross-cutting
utilities may move to `packages/` with CLI support if needed.

## Codebase Reconnaissance

See `research.md` for complete tables keyed by decision IDs.

| Story/Decision | File/Directory                                                                               | Role Today                                                                                     | Helpers/Configs                                                       | Risks & Follow-up                                                                            | Verification Hooks                                                                           |
| -------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| D001 / US1     | /apps/web/src/pages/Project.tsx                                                              | Renders workflow cards; currently calls template store with project id causing upgrade errors. | `useTemplateStore`, TanStack Query, Event Hub, fixture profile guard. | Ensure accessible card pattern retained; prevent duplicate loads, clean up subscriptions.    | Playwright dashboard flow; new RTL tests.                                                    |
| D001 / US1     | /apps/web/src/app/router/document-routes.tsx                                                 | Loader hydrates fixtures only.                                                                 | Fixture provider, React Router loader.                                | Replace with live fetch while preserving fixture override.                                   | Loader unit test; Project→Document e2e path.                                                 |
| D002 / US2     | /apps/api/src/routes/documents.ts                                                            | Handles reads/draft bundle saves; lacks create endpoint.                                       | Template validation middleware, document repository.                  | Add idempotent create returning first section; emit lifecycle telemetry.                     | Contract tests under `/apps/api/tests/contract/documents`.                                   |
| D003 / US3     | /apps/web/src/features/document-editor/hooks/use-document-fixture.ts                         | Seeds editor from fixtures.                                                                    | `editor-persistence`, fixture transformers.                           | Replace with live bootstrap while keeping fixture mode gating.                               | Document editor store tests; fixture Playwright suite; new assumptions-flow contract (T032). |
| D004 / US3     | /apps/web/src/features/section-editor/api/section-editor.client.ts                           | Wraps draft bundle submissions/conflicts.                                                      | API client wrappers, diff mappers.                                    | Wire manual save panel to client; integrate clarified conflict guidance.                     | Section editor unit/integration tests.                                                       |
| D005 / US3     | /apps/web/src/features/document-editor/hooks/useCoAuthorSession.ts                           | Manages co-author SSE sessions.                                                                | Event Hub fallback, telemetry.                                        | Ensure session lifecycle tied to navigation; expose cancel/retry.                            | Hook unit tests (T030) + SSE integration tests.                                              |
| D005 / US3     | /apps/web/src/features/document-editor/quality-gates/components/DocumentQualityDashboard.tsx | Displays quality status; expects live data.                                                    | `useQualityGates`, telemetry emitters.                                | Provide real doc summary, maintain polling fallback.                                         | Quality gate unit tests + QA sidebar Playwright coverage (T031).                             |
| D006 / US3     | /packages/exporter/src                                                                       | Generates export artifacts via CLI.                                                            | CLI commands, markdown renderers.                                     | Wrap with API endpoint; maintain CLI parity.                                                 | Exporter unit tests; new contract tests.                                                     |
| D006 / US3     | /apps/api/src/routes/templates.ts                                                            | Offers template validation endpoints used by banner.                                           | Template upgrade service, resolver, shared-data.                      | Add POST endpoint to persist project-level template validation decisions with logging/tests. | Template decision contract tests.                                                            |

## Complexity Tracking

No constitutional violations requiring justification identified.

## Phase 0: Outline & Research

- All unknowns resolved; clarifications recorded in spec (accessible card
  pattern, conflict guidance).
- Research decisions D001–D006 documented with rationale and alternatives.
- Codebase reconnaissance tables captured in `research.md`, including fixture
  compatibility and testing hooks.

**Status**: Complete.

## Phase 1: Design & Contracts

- Entities and state transitions captured in `data-model.md`
  (ProjectDocumentSnapshot, DocumentMetadata, SectionView, collaboration/QA
  sessions, ExportJob).
- API contract draft `contracts/project-document-workflows.openapi.yaml` defines
  discovery, creation, and export endpoints.
- Quickstart scenarios (`quickstart.md`) map user stories to validation flows.
- No automated agent context script exists; manual updates to `AGENTS.md` remain
  TODO if new tech appears.

**Status**: Complete.

## Phase 2: Task Planning Approach

Will be executed via `/speckit.tasks` using
`.specify/templates/tasks-template.md`, organizing work by priority (P1→P3),
documenting parallel-safe steps with `[P]`, and producing dependency graphs plus
MVP recommendations.
