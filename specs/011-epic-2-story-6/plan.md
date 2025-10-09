---
description: 'Implementation plan template for feature development'
---

# Implementation Plan: Conversational Co-Authoring Integration

**Branch**: `[011-epic-2-story-6]` | **Date**: 2025-10-06 | **Spec**:
`/specs/011-epic-2-story-6/spec.md`  
**Input**: Feature specification from `/specs/011-epic-2-story-6/spec.md`

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

Section-scoped conversational co-authoring lets an authenticated author open a
sidebar chat, request explanations or outlines without mutating the draft, and
then generate AI proposals that arrive as diff previews mapped to the
originating prompt. Diff approval applies the patch through the existing draft
persistence pipeline, records a changelog entry, and keeps the conversation
visible only for the active session. Each provider call includes the full
document of completed sections so replies stay contextually aware, while
long-running generations surface progress indicators and cancel/retry
affordances instead of enforcing a hard SLA.

## Technical Context

**Language/Version**: TypeScript 5.6 (React 19 frontend, Node 22 Express API)  
**Primary Dependencies**: React 19, TanStack Query 5, Zustand, Milkdown 7,
Vercel AI SDK 3, Express 5, packages/ai, packages/editor-core,
packages/editor-persistence, packages/qa  
**Storage**: SQLite via shared-data repositories for committed documents;
client-side Zustand store for ephemeral conversations; draft diffs continue to
rely on editor-persistence patch APIs  
**Testing**: Vitest (unit + contract), Playwright fixture suites, pnpm gauntlet
(`pnpm lint`, `pnpm typecheck`, `pnpm test`)  
**Target Platform**: Desktop browser (Vite dev server) with local Express API
server  
**Project Type**: web (frontend + backend + shared packages)  
**Performance Goals**: Target streaming first AI tokens within ~3s for 95% of
prompts (progress indicators/cancel affordances kick in at 5s); diff application
to draft store <= 500ms for medium sections  
**Constraints**: Conversation transcripts may not persist after session close;
provider payloads must include the entire completed document; approvals require
explicit human confirmation; adhere to SOC2 logging without leaking draft text;
honor constitution’s library-first and CLI mandates  
**Scale/Scope**: Multi-section architecture documents (~30 sections) with
concurrent authors; expect up to 5 simultaneous assistant requests per document
section

## Constitution Check

- **Library-First Architecture**: Core diff reconciliation and AI provider
  orchestration live in `packages/editor-core` and `packages/ai`;
  frontend/backend import those libraries rather than duplicating logic.
- **CLI Interface Standard**: Extend `packages/ai` CLI to replay proposal runs
  (`pnpm --filter @ctrl-freaq/ai cli coauthor --prompt-file ...`) so assistants
  validate outputs without the UI.
- **Test-First Development**: Add failing Vitest specs for AI proposal services,
  diff metadata mapping, frontend conversation store, and contract tests for new
  co-authoring endpoints before implementation.
- **Observability & Security**: Log request IDs, intent, and response confidence
  without transcript text; reuse QA logging helpers for changelog audits and
  ensure RBAC on new routes.
- **Simplicity & Versioning**: Reuse existing diff/patch engines and draft
  persistence; no additional long-lived storage introduced; session state stays
  client-side to avoid schema churn.

Constitution Gate Status: PASS (no violations identified).

## Project Structure

### Documentation (this feature)

```
specs/011-epic-2-story-6/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── section-coauthoring.openapi.yaml
│   └── proposal-approval.contract.json
├── AGENTS.md
└── spec.md
```

### Source Code (repository root)

```
apps/web/
├── src/features/document-editor/
│   ├── components/co-authoring/
│   │   ├── CoAuthorSidebar.tsx
│   │   ├── ProposalPreview.tsx
│   │   └── SessionProgress.tsx
│   ├── hooks/useCoAuthorSession.ts
│   ├── api/co-authoring.client.ts
│   └── stores/co-authoring-store.ts
├── src/features/section-editor/components/diff-viewer.tsx
└── tests/
    ├── unit/document-editor/
    ├── integration/co-authoring/
    └── e2e/document-editor/

apps/api/
├── src/routes/co-authoring.ts
├── src/services/co-authoring/
│   ├── ai-proposal.service.ts
│   ├── context-builder.ts
│   └── diff-mapper.ts
├── src/middleware/ai-request-audit.ts
└── tests/
    ├── contract/co-authoring/
    └── unit/services/co-authoring/

packages/ai/
├── src/providers/vercel/coauthoring.ts
├── src/session/proposal-runner.ts
└── tests/

packages/editor-core/
├── src/diff/section-proposal.ts
└── tests/diff/

packages/shared-data/
├── src/repositories/changelog/
└── migrations/
```

**Structure Decision**: Web monorepo—frontend `apps/web` hosts the
conversational UI, backend `apps/api` exposes authenticated co-authoring routes,
and shared behavior lives in libraries so both surfaces consume the same diff
and AI abstractions.

## Phase 0: Outline & Research

1. Identify unknowns: provider prompt packaging (full document + snippets),
   streaming transport (SSE vs fetch + ReadableStream), diff alignment with
   existing editor-core utilities, and changelog write model without storing
   transcripts.
2. Research tasks (documented in `research.md`):
   - Evaluate how to assemble whole-document context safely from shared-data
     repositories without leaking unpublished drafts.
   - Compare Vercel AI SDK streaming helpers with native fetch Streams for UI
     progress hooks.
   - Validate editor-core diff APIs for proposal previews and how to annotate
     segments with originating prompt IDs.
   - Confirm changelog repository evolves to accept AI proposal metadata while
     staying audit-friendly.
   - Survey accessibility guidance for live AI streaming, progress
     announcements, and cancel controls.
3. Consolidate outcomes in `research.md` with decision, rationale, and
   alternative notes for each topic.

**Output**: `/specs/011-epic-2-story-6/research.md`

## Phase 1: Design & Contracts

1. Capture entities in `data-model.md`: SectionConversationSession,
   ConversationTurn, AIProposalSnapshot, ProviderContextPayload,
   SectionChangelogEntry, and DiffPreviewAnnotation with relationships and
   constraints.
2. Define REST contracts in
   `/specs/011-epic-2-story-6/contracts/section-coauthoring.openapi.yaml`
   covering `POST /documents/{id}/sections/{sectionId}/co-author/analyze`,
   `POST .../proposal`, and `POST .../apply` (approval).
3. Draft JSON contract exemplar (`proposal-approval.contract.json`) to drive
   contract tests validating approval payload shape and audit metadata.
4. Quickstart guide (`quickstart.md`) walks through bringing up the stack,
   enabling the assistant, generating an outline, requesting a proposal,
   inspecting diff metadata, approving/rejecting, and observing changelog
   updates plus fallback messaging.
5. Generate agent guidance in `AGENTS.md` so coding agents know to preserve
   ephemerality, send whole-document payloads, log appropriately, and keep UI
   accessible.

**Output**: data-model.md, contracts/, quickstart.md, AGENTS.md

## Phase 2: Task Planning Approach

**Task Generation Strategy**:

- Use `/templates/tasks-template.md` as the base numbering scaffold.
- Derive tasks from Phase 1 artifacts: each API path → contract test +
  implementation tasks; each entity → model/service tasks; quickstart steps →
  integration & E2E coverage tasks.
- Mark [P] for work streams that can proceed in parallel (e.g., frontend store
  vs backend service) once shared contracts are in place.

**Ordering Strategy**:

- Author contract tests, unit specs for proposal runner, and conversation store
  tests before production code.
- Implement shared libraries (`packages/ai`, `packages/editor-core`), then
  backend routes, then frontend hooks/components.
- Finish with Playwright coverage validating diff preview, progress indicator,
  cancel/retry, and changelog updates.

**Estimated Output**: ~26-30 ordered tasks in `tasks.md` once `/tasks` runs.

## Phase 3+: Future Implementation

Beyond `/plan` scope—`/tasks` will enumerate execution steps, followed by TDD
implementation and full gauntlet validation per the constitution.

## Complexity Tracking

_No constitutional deviations identified; table intentionally left empty._

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |

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
- [x] Complexity deviations documented (if needed)

**Runtime Notes**:

- Design artifacts ready; update with telemetry once implementation and
  validation complete.

**Quality Gate Evidence**:

- To be populated after implementation (expect `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, Playwright fixture runs).

---

_Based on Constitution v1.1.0 — see `/CONSTITUTION.md`_
