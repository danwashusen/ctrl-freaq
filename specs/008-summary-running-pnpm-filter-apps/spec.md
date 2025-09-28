# Feature Specification: Document Editor Deep Links And Deterministic Fixtures

**Feature Branch**: `008-summary-running-pnpm-filter-apps`  
**Created**: 2025-09-27  
**Status**: Draft  
**Input**: User description: "Restore document editor navigation and
deterministic fixtures so Playwright document and section specs pass without
backend dependencies."

## Execution Flow (main)

```
1. Automated QA enables the documented E2E mode so the web client serves
   deterministic document fixtures.
2. User or test runner opens `/documents/:documentId/sections/:sectionId` from
   dashboard navigation, a direct link, or test harness.
3. The application resolves the requested identifiers against the fixture set
   and prepares the document context (metadata, table of contents, section
   content, assumption state).
4. Document editor surfaces the full reading experience with table of contents,
   section preview, edit entry points, and quality gate context matching
   `/docs/front-end-spec.md`.
5. When the scenario requires interaction (e.g., opening the assumption
   conflict modal), the deterministic data enables predictable UI responses
   without live API calls.
6. On exit, the session returns to standard mode so production users continue to
   rely on live services and data.
```

---

## ⚡ Quick Guidelines

- Preserve deep link behavior so users and tests experience the same navigation
  flow described in `/docs/front-end-spec.md`.
- Keep deterministic fixtures aligned with schemas and examples maintained in
  `/templates/` and cross-referenced in `/docs/prd.md`.
- Communicate access or authentication requirements using language consistent
  with the PRD change log and existing dashboard messaging.

### Section Requirements

- Mandatory coverage: document navigation, section editing entry points, and
  assumption workflows available through deep links.
- Optional coverage: confirm whether review or edit-specific routes must share
  the same deterministic experience before expanding scope.

### For AI Generation

1. Supply fixtures that illustrate conversational co-authoring and QA chat
   states so AI features appear available even without live services.
2. Maintain section lifecycle indicators (idle, drafting, review, ready) to
   match expectations outlined in `/docs/prd.md`.
3. Provide static, scripted AI transcripts during mocked runs so Playwright
   assertions remain deterministic while still showcasing chat UI states.

---

## Clarifications

### Session 2025-09-27

- Q: Which mechanism should activate deterministic fixture mode for the document
  editor during E2E runs? → A: Introduce `VITE_E2E=true` flag to toggle
  fixtures.

---

## User Scenarios & Testing _(mandatory)_

### Primary User Story

As a QA engineer running the Playwright suite, I can open a document section
link while the backend is unavailable and the editor renders consistent fixture
content so scripted flows complete successfully.

### Acceptance Scenarios

1. **Given** E2E mode is enabled with deterministic fixtures, **When** a test
   visits `/documents/demo-architecture/sections/sec-api`, **Then** the Document
   Editor displays table of contents, section preview, and edit affordances
   without redirecting to the dashboard.
2. **Given** a contributor receives a shared deep link for a section, **When**
   they authenticate and the requested document exists, **Then** the editor
   loads the same content, assumption state, and quality indicators described in
   the fixtures so collaboration can proceed immediately.

### Edge Cases

- What happens when the requested document or section identifier is missing from
  the deterministic fixture set?
- How does the system handle authentication-required states when a deep link is
  opened outside automated runs?
- What user feedback appears if fixture data is stale relative to `/templates/`
  schemas?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST treat `/documents/:documentId/sections/:sectionId` as
  a canonical, user-facing deep link and avoid redirecting recognized IDs to the
  dashboard.
- **FR-002**: Document Editor MUST present table of contents, section preview,
  edit entry points, and quality gate context for recognized fixture documents
  in alignment with `/docs/front-end-spec.md`.
- **FR-003**: E2E mode MUST deliver deterministic document, section, assumption,
  and status data so Playwright scenarios (e.g., assumptions conflict modal,
  section editing) execute without live API dependencies.
- **FR-004**: The application MUST expose a predictable mechanism to enable
  mocked data for automated tests by honoring a dedicated `VITE_E2E=true` flag
  (e.g., via `pnpm --filter @ctrl-freaq/web dev:e2e`) without affecting
  production sessions.
- **FR-005**: When fixture data is unavailable or corrupted, the system MUST
  display an informative error with a path back to dashboard navigation instead
  of failing silently.
- **FR-006**: Authentication-required states MUST present consistent messaging
  so tests and users understand how to proceed when deep links require sign-in.
- **FR-007**: Deterministic fixtures MUST be documented and versioned alongside
  spec updates so contributors know how to refresh them when the architecture
  schema evolves.

### Key Entities _(include if feature involves data)_

- **Document Fixture**: Represents the high-level architecture document metadata
  and table of contents used during deterministic runs.
- **Section Fixture**: Contains section-specific content, lifecycle state, and
  edit affordances referenced by Playwright specs.
- **Assumption Session Fixture**: Captures assumption prompts, decisions, and
  conflict data to keep QA flows stable without backend calls.

---

## Review & Acceptance Checklist

_GATE: Automated checks run during main() execution_

### Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness

- [ ] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status

_Updated by main() during processing_

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed

---
