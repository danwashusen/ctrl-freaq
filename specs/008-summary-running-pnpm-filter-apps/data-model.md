# Data Model — Document Editor Deep Links And Deterministic Fixtures

## Entity: DocumentFixture

- **Purpose**: Represents high-level architecture document metadata and
  navigation context available during E2E runs.
- **Fields**:
  - `id` (string) — canonical document identifier used in deep links (e.g.,
    `demo-architecture`).
  - `title` (string) — document title shown in editor header.
  - `summary` (string) — short description for overview panels.
  - `tableOfContents` (SectionReference[]) — ordered list of sections with id,
    title, state.
  - `updatedAt` (ISO timestamp string) — last modified time displayed in UI.
  - `lifecycleStatus` (enum: `draft` | `review` | `ready`) — overall document
    state badge.
  - `sections` (Record<string, SectionFixture>) — map of section id to section
    payload for quick lookup.

## Entity: SectionReference

- **Purpose**: Lightweight entry used in the table of contents for navigation.
- **Fields**:
  - `id` (string) — stable section identifier.
  - `title` (string) — display name in toc-panel.
  - `state` (enum: `idle` | `assumptions` | `drafting` | `review` | `ready`) —
    mirrors UI badges per spec.
  - `hasConflicts` (boolean) — indicates assumption conflicts for iconography.

## Entity: SectionFixture

- **Purpose**: Provides deterministic section content, assumption state, and
  edit affordances.
- **Fields**:
  - `id` (string) — matches deep link path parameter.
  - `title` (string) — section heading.
  - `content` (string) — Markdown rendered in preview mode.
  - `editable` (boolean) — whether “Enter edit” button appears.
  - `lifecycleState` (enum: `idle` | `assumptions` | `drafting` | `review` |
    `ready`) — state chip for the section view.
  - `assumptionSession` (AssumptionSessionFixture | null) — conflict modal data
    or null when not applicable.
  - `lastAuthoredBy` (string) — surfaced in activity log UI.
  - `lastUpdatedAt` (ISO timestamp string) — for diff/metadata display.

## Entity: AssumptionSessionFixture

- **Purpose**: Captures prompts, decisions, and resolution outcomes for the
  assumptions conflict modal.
- **Fields**:
  - `sessionId` (string) — unique identifier for analytics.
  - `policy` (enum: `conservative` | `balanced` | `yolo`) — selected
    aggressiveness level (audit requirement).
  - `questions` (AssumptionQuestion[]) — ordered list driving the modal.
  - `unresolvedCount` (number) — drives badge counter.
  - `transcript` (TranscriptMessage[]) — chat-style history shown in QA panel.

## Entity: AssumptionQuestion

- **Fields**:
  - `id` (string) — question identifier.
  - `prompt` (string) — text of the question.
  - `decision` (string) — displayed resolution choice.
  - `status` (enum: `open` | `resolved`) — for UI filters.

## Entity: TranscriptMessage

- **Fields**:
  - `speaker` (enum: `user` | `assistant` | `system`) — conversation actor.
  - `content` (string) — rendered Markdown response.
  - `timestamp` (ISO timestamp string) — supports chronological rendering.

## Relationships & Constraints

- `DocumentFixture.sections` must contain entries for every `tableOfContents.id`
  to keep navigation consistent.
- Section and assumption identifiers must remain stable across runs to avoid
  Playwright selector drift.
- Static transcripts must remain under 10 messages per section to keep fixture
  files manageable.
- Fixture updates must be versioned alongside spec changes to ensure
  traceability.
