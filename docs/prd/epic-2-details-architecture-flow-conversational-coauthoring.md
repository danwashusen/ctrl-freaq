# Epic 2 Details — Architecture Document Creation Flow + Conversational Co-Authoring
## Goal
Deliver a guided authoring flow for an AI-optimized Architecture document with section-aware chat, proposal diffs, approval gating, and traceability — all running locally with Clerk auth. Provide near real-time streamed responses in the UI; for production (Phase 2) use AWS Lambda Response Streaming over HTTPS.

## Stories
1) Architecture Document Schema & Validation
- AC1: JSON schema defines sections/fields, required/optional, and types.
- AC2: Runtime validation enforces schema in UI and on save/export.
- AC3: Schema version recorded in doc metadata.

2) Authoring Wizard (Guided Flow + Assumptions Resolution)
- AC1: Stepper UI with save/resume; section statuses (draft/ready).
- AC2: Field-level validation messages; cannot publish with blockers.
- AC3: Draft persists locally (SQLite) under user account (Clerk).
- AC4: Comprehensive “Resolve Assumptions” process before drafting each section: per-assumption status (✅/❔/❌), focused Q&A/options, explicit approvals, and a final ordered assumptions list captured to metadata.
 - AC5: Section lifecycle states and transitions: idle → assumptions → drafting → review → ready; transitions are visible in the UI.

3) Section-Aware Context Builder
- AC1: Context includes current section, approved prior sections, and selected knowledge items; token budget limits applied.
- AC2: Redacts secrets; adds doc/section IDs for grounding.
- AC3: Configurable model params via Vercel AI SDK.
 - AC4: User can select sections from the TOC as explicit context; a "Chat about selected" action opens/updates the Document QA panel with those sections.

4) Conversational Co‑Authoring (Read)
- AC1: Section-scoped chat can “explain, outline, suggest” without writing.
- AC2: Responses include citations to doc sections and knowledge sources.
- AC3: [Phase 2] Chat transcript stored with section (user, timestamp, refs).

5) Conversational Co‑Authoring (Write Proposals)
- AC1: Chat can propose edits; diff preview shows insertions/deletions.
- AC2: User must approve to apply; decline discards with reason.
- AC3: On approve, draft updated and changelog entry added.

6) Streaming UX for Near Real-Time Responses
- AC1: UI renders streamed model output incrementally with <300ms time-to-first-chunk in local dev.
- AC2: Local dev uses Node streams/SSE or Web Streams; Phase 2 production targets AWS Lambda Response Streaming over HTTPS.
- AC3: Graceful fallback to non-streamed responses retains functional parity.

7) Citations & Traceability
- AC1: Each applied AI change records source refs (doc sections, knowledge IDs).
- AC2: Traceability matrix updates links: requirement ↔ section ↔ decision.
- AC3: View renders back-links from sections to cited sources.
 - AC4: Clicking a citation navigates to and highlights the referenced range in the document when available.

8) Export to Markdown + Versioning
- AC1: Export renders full doc to `docs/architecture.md`; sharded sections to `docs/architecture/*.md` (e.g., `docs/architecture/introduction.md`).
- AC2: Includes version header, schema version, and changelog delta.
- AC3: Idempotent export (unchanged content yields no diff).

9) Quality Gates & Pre‑Publish Checklist
- AC1: Checklist runs blockers/non-blockers; shows pass/fail summary.
- AC2: Blockers prevent publish; non-blockers logged.
- AC3: Publish action records QA snapshot.

10) Collaboration Hooks (MVP)
- AC1: Section “editing by <user>” indicator using Clerk identity.
- AC2: Conflict warning if another save occurs within 30s window.
- AC3: Events logged for potential upgrade in Epic 4.

11) Project Scoping for Authoring (MVP)
- AC1: Add `projectId` to authoring documents and knowledge items.
- AC2: Session holds `activeProjectId` selected on login (defaults to the user’s personal project) and via sidebar/dashboard selection.
- AC3: All create/list/read operations are filtered by the active project.
- AC4: Tests confirm isolation and default selection behavior.
