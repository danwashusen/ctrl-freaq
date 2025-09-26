# Implementation Plan: Section Editor & WYSIWYG Capabilities

**Branch**: `007-epic-2-story` | **Date**: 2025-09-25 | **Spec**:
[spec.md](/specs/007-epic-2-story/spec.md) **Input**: Feature specification from
`/specs/007-epic-2-story/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by
other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Deliver a section editing workflow that keeps read-only previews informative,
surface approval metadata with a clear edit CTA, loads Milkdown-based rich text
editing within 300 ms, supports manual "Save Draft" with formatting highlights,
performs conflict detection on entry and save using version tokens, and exposes
diff + review submission endpoints so staff engineers can compare drafts with
approved content, approve sections, and close the loop with auditable metadata.

## Technical Context

**Language/Version**: TypeScript 5.4.x, Node.js 22.x, React 18.x  
**Primary Dependencies**: Milkdown 7.15.x, TanStack Query 5.x, Zustand 4.x,
Express 5.x, better-sqlite3 9.x  
**Storage**: SQLite via `@ctrl-freaq/shared-data` repositories; IndexedDB (via
`editor-persistence`) for manual drafts  
**Testing**: Vitest + React Testing Library, Playwright E2E, contract suites in
`/apps/api/tests/contract` with Zod schemas; toolbar/hotkey and approval flows
are covered by automated specs before implementation  
**Target Platform**: Web (Chromium, Firefox, Safari) backed by local Express API
on Node.js 22  
**Project Type**: web (React frontend + Express backend inside pnpm monorepo)  
**Performance Goals**: <300 ms edit mode entry, <150 ms diff generation, 60 fps
editor interactions with automated measurement hooks, including long-section
rendering telemetry  
**Constraints**: Manual save only (no autosave), highlight-but-allow unsupported
formatting, enforce rebase-before-save conflicts, maintain accessibility (WCAG
2.1 AA) with full-editor coverage, and expose toolbar controls plus keyboard
shortcuts defined in FR-003  
**Scale/Scope**: Up to 500 sections per document, one active review queue per
section, multiple user drafts stored concurrently  
**Documentation Source**: specs/007-epic-2-story/ (supplied via `$ARGUMENTS`)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Library-First Architecture**: ✅ PASS

- Builds on existing libraries (`packages/editor-core`,
  `packages/editor-persistence`, `packages/shared-data`) instead of embedding
  logic inside apps.
- New backend surfaces live under `apps/api/src/modules/section-editor` with
  clear module boundary and CLI exposure through existing packages.

**CLI Interface Standard**: ✅ PASS

- Libraries stay CLI-accessible (no UI-only logic); persistence + patch engine
  already expose commands.
- Any new helpers will extend current CLI entry points rather than bypass them.

**Test-First Development (TDD)**: ✅ PASS

- Plan creates contract specs + Vitest scaffolds before implementation.
- Quickstart enumerates E2E + integration scenarios that must fail prior to
  code.
- Husky + pnpm workflows enforce lint/type/test gates per constitution.

**Integration Testing & Observability**: ✅ PASS

- Conflict detection endpoints require structured logging with `requestId`,
  status, and resolution path; data model documents audit surfaces.
- Plan calls for contract tests in `/apps/api/tests/contract`, Playwright
  validation for the full editor (read-only, edit transitions, diff review), and
  accessibility/performance instrumentation across the editor surface.

**Simplicity & Versioning**: ✅ PASS

- Reuses version tokens + patch engine rather than inventing new diff systems.
- No optional autosave paths; single manual save flow keeps scope constrained.
- Avoids creating new top-level packages; extends existing module trees.

_No constitutional deviations detected; Complexity Tracking remains empty._

## Project Structure

### Documentation (this feature)

```
specs/007-epic-2-story/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── section-editor.yaml
```

### Source Code (repository root)

```
apps/
├── api/
│   ├── src/
│   │   ├── modules/
│   │   │   └── section-editor/
│   │   │       ├── routes/
│   │   │       ├── services/
│   │   │       └── dto/
│   │   ├── middleware/
│   │   └── validation/
│   └── tests/
│       ├── contract/
│       ├── integration/
│       └── fixtures/
├── web/
│   ├── src/
│   │   ├── features/
│   │   │   ├── document-editor/
│   │   │   └── section-editor/
│   │   │       ├── components/
│   │   │       ├── hooks/
│   │   │       ├── lib/
│   │   │       └── stores/
│   │   ├── components/
│   │   ├── lib/
│   │   └── tests/
│   └── tests/
│       ├── integration/
│       └── e2e/
packages/
├── editor-core/
│   └── src/
│       ├── editor/
│       ├── extensions/
│       └── patch-engine/
├── editor-persistence/
│   └── src/
└── shared-data/
    └── src/
```

**Structure Decision**: Web application structure (React frontend + Express API)
with feature-specific modules under existing directory trees.

## Phase 0: Outline & Research

Research captured in `/specs/007-epic-2-story/research.md` resolves all
unknowns:

- Applied SPEC_KIT_CONFIG technical context by reaffirming ESLint/Prettier/Husky
  gates and Vitest + Playwright testing stack.
- Defined conflict detection lifecycle using
  `approvedVersion`/`draftBaseVersion` tokens tied to patch engine capabilities.
- Selected manual draft persistence through `editor-persistence` with IndexedDB,
  aligning with manual save requirement.
- Documented Milkdown plugin strategy for highlighting unsupported formatting
  without blocking edits.
- Benchmarked long-section rendering assumptions and documented telemetry plan
  to keep scroll performance at 60 fps with fallback indicators.
- Established preloading and accessibility tactics to meet the 300 ms edit
  target and WCAG obligations.

All NEEDS CLARIFICATION markers cleared; ready for design.

## Phase 1: Design & Contracts

Artifacts produced:

- `/specs/007-epic-2-story/data-model.md` defines `SectionRecord`,
  `SectionDraft`, `DraftConflictLog`, `FormattingAnnotation`, and
  `SectionReviewSummary` with validation and state machines.
- `/specs/007-epic-2-story/contracts/section-editor.yaml` specifies endpoints
  for conflict checks, manual saves, diff retrieval, review submission, and
  conflict logs.
- `/specs/007-epic-2-story/quickstart.md` codifies Playwright E2E flows, Vitest
  integration tests, and contract test scaffolds that will fail until the
  feature is implemented.
- `.specify/scripts/bash/update-agent-context.sh codex` executed to record the
  new technical context for this plan.

Re-run Constitution check: ✅ PASS (design adheres to library-first, TDD, and
observability principles with no new risks).

## Phase 2: Task Planning Approach

_Design only; `/tasks` will generate the numbered list._

**Task Generation Strategy**:

- Derive backend tasks from OpenAPI contract (routes, services, validation,
  contract tests).
- Derive frontend tasks from data model + quickstart scenarios (read-only
  metadata view, Zustand store, Milkdown plugin, diff viewer, conflict dialogs,
  manual save UX, approval controls).
- Layer accessibility tooling (keyboard/ARIA checks, axe audits) and performance
  telemetry for edit-mode entry before final polish.
- Leverage existing packages to extend patch engine + persistence APIs before
  touching app layers.

**Expected Task Buckets**:

1. **Domain & Persistence** [P]: Extend shared-data schemas, add draft +
   conflict storage, capture approval audit fields, wire repository interfaces.
2. **Backend Services**: Implement Express routes for conflict check, draft
   save, diff retrieval, review submission, approval transitions; add contract
   tests per endpoint.
3. **Frontend State & Editor**: Build section draft hook/store, integrate
   conflict detection handshake, implement formatting highlight plugin.
4. **UI Components**: Create diff viewer, conflict dialog, manual save controls,
   review submission modal with summary note.
5. **Testing & Observability**: Implement Vitest integration tests, Playwright
   scenarios, structured logging assertions, and long-section performance
   telemetry validation.

**Ordering Strategy**:

- Follow TDD: contract tests → service implementation → client integrations.
- Work bottom-up: data model and persistence before services, services before
  React components.
- Mark independent backend/frontend tasks for parallel execution ([P]) once
  contracts and data shapes are codified.

## Phase 3+: Future Implementation

**Phase 3**: `/tasks` generates tasks.md.  
**Phase 4**: Engineers execute tasks adhering to TDD + constitutional rules.  
**Phase 5**: Validation via quickstart scenarios, automated tests, and manual
review.

## Complexity Tracking

_No constitutional deviations or complexity exceptions required._

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---

_Based on Constitution v1.1.0 - See `SPEC_KIT_CONFIG.constitution.path`_
