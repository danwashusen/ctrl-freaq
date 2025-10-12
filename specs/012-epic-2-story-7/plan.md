# Implementation Plan: Streaming UX for Document Editor

**Branch**: `[012-epic-2-story-7]` | **Date**: 2025-10-09 | **Spec**:
`/specs/012-epic-2-story-7/spec.md` **Input**: Feature specification from
`/specs/012-epic-2-story-7/spec.md`

## Summary

Deliver responsive AI-assisted editing by enforcing per-section streaming
serialization, allowing cross-section concurrency, and guaranteeing fallback
parity. Extend existing SSE flows (co-authoring, document QA review, assumption
loop) to meet the 0.3s latency target for 40+ simultaneous interactions while
preserving accessible announcements, resequencing out-of-order events, and
telemetry coverage.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS and React 19  
**Primary Dependencies**: Express.js SSE transport, Vercel AI SDK, TanStack
Query, Clerk auth middleware, shared streaming utilities in
`packages/editor-core`  
**Storage**: SQLite (MVP) with session state mirrored in application memory and
telemetry pipeline (Redshift target later)  
**Testing**: Vitest (unit, contract), Playwright fixtures (UI), pnpm quality
gates (`lint`, `typecheck`, `test`)  
**Target Platform**: Express API running on Linux containers + modern browsers
via Vite web app  
**Project Type**: pnpm monorepo with `apps/api`, `apps/web`, and reusable
packages  
**Performance Goals**: Median time-to-first-update ≤0.3s, sustained streaming
under 40+ concurrent interactions per workspace, fallback completion within
existing SLA (<5s)  
**Constraints**: Single active stream per section, newest-request queue
replacement, accessible ARIA/live regions for every streaming state change,
telemetry capturing request IDs and fallback reasons  
**Scale/Scope**: Document editors with dozens of sections per workspace,
multiple staff engineers collaborating simultaneously (tens of concurrent
streams)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Rule I – Library-First Architecture**: Changes remain within existing
  libraries (`packages/editor-core`, `packages/shared-data`) and apps; no new
  orphan modules introduced. **Status: PASS**
- **Rule II – CLI Interface Standard**: Any new library utilities must expose a
  CLI surface (extend `packages/ai` replay tool if new behavior is added).
  **Status: PASS w/ reminder**
- **Rule III – Test-First Development (Non-Negotiable)**: Commit to writing
  failing Vitest/Playwright specs for streaming queue replacement, concurrency,
  and fallback parity before implementation. **Status: PASS**
- **Accessibility & Observability Mandates** (Constitution §UI / §Logging): Plan
  includes ARIA live announcements and telemetry instrumentation updates.
  **Status: PASS**

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
apps/
├── api/
│   ├── src/routes/
│   ├── src/services/co-authoring/
│   ├── src/services/assumptions/
│   └── tests/
└── web/
    ├── src/features/document-editor/
    ├── src/lib/streaming/
    └── tests/

packages/
├── editor-core/
├── shared-data/
├── ai/
└── qa/
```

**Structure Decision**: Utilize existing monorepo structure—API-side streaming
logic lives under `apps/api/src/services/co-authoring` and assumption modules,
with shared telemetry/types in `packages/shared-data`. Frontend streaming UX
extends `apps/web/src/features/document-editor` and shared streaming utilities.

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |

## Phase 0: Outline & Research

1. Research task: streaming queue replacement best practices for SSE in Node.js
   to ensure 40+ concurrent interactions without head-of-line blocking.
2. Research task: accessibility announcements for live SSE content focusing on
   ARIA polite vs assertive regions during rapid updates.
3. Research task: telemetry schema updates capturing per-section concurrency and
   fallback transitions for analytics.
4. Compile findings into `research.md`, documenting decisions, rationale, and
   alternatives.

## Phase 1: Design & Contracts

_Prerequisites: `research.md` complete_

1. Build `data-model.md` describing `StreamingInteractionSession`,
   `StreamingProgressEvent`, and `StreamingFallbackRecord` fields, identity, and
   state transitions across co-authoring, document QA, and assumptions,
   including ordered sequence handling and discrepancy logging.
2. Author REST + SSE contract definitions under
   `/specs/012-epic-2-story-7/contracts/` covering request kickoff,
   cancel/retry, progress stream payloads, and fallback delivery for
   co-authoring, document QA review, and assumption loops.
3. Draft `quickstart.md` detailing how to exercise streaming flows in local dev,
   including parallel section requests, document QA review, out-of-order event
   simulations, and fallback behaviors.
4. Run `.specify/scripts/bash/update-agent-context.sh codex` to capture any new
   tooling or patterns introduced by the plan. _(Script currently missing; log a
   follow-up to restore or document alternative workflow.)_
5. Re-evaluate Constitution Check after design artifacts—ensure test-first and
   accessibility requirements remain satisfied and document the outcome below.

## Phase 2: Task Planning Approach

_This section describes what `/speckit.tasks` will do—do not execute during
`/speckit.plan`._

**Task Generation Strategy**:

- Base tasks on Phase 1 outputs, ensuring each user story (P1–P3) maps to tests,
  API changes, UI updates, and telemetry work.
- Front-load shared infrastructure tasks (queue manager, telemetry schema,
  accessibility utilities) before story-specific work.
- Mark independent workstreams (API vs Web) with `[P]` for parallel execution.
- Finish with fallback validation, documentation updates, and regression test
  suites.

**Expected Outputs from `/speckit.tasks`**:

- `tasks.md` containing setup, shared infrastructure, and user-story phases with
  acceptance test references.
- Updated MVP guidance and dependency graph aligning with streaming/telemetry
  priorities.
- Parallel execution guidance ensuring API and frontend teams can coordinate
  without blocking each other.

## Post-Design Constitution Check

- Re-affirmed Rule III (Test-First): Plan mandates new failing specs prior to
  implementation across API (`apps/api/...`) and UI (`apps/web/...`).
- Accessibility commitments remain intact via ARIA announcement strategy.
- Observability requirements satisfied by telemetry schema extensions.
- No new libraries introduced without CLI surfaces; existing tooling extends
  current packages. Overall status: **PASS**.
