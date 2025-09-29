# Data Model: New Section Content Flow

**Feature**: New Section Content Flow (009-epic-2-story-4) **Date**: 2025-09-29

## Overview

This model captures assumption-driven authoring for blank sections, including
prompt prioritisation, override recording, conflict resolution, and multi
proposal history so reviewers can audit how new content was produced.

## Core Entities

### SectionAssumption

Represents a template-derived prompt bound to a specific section during an
assumption session.

```typescript
interface SectionAssumption {
  id: string; // UUID for prompt instance
  sectionId: string; // Target section (matches template node)
  documentId: string; // Denormalised for querying sessions
  templateKey: string; // Stable key from template YAML
  promptHeading: string; // Short label displayed in checklist
  promptBody: string; // Detailed instructions/question text
  responseType: 'single_select' | 'multi_select' | 'text';
  options: AssumptionOption[]; // Possible answers when not free text
  priority: number; // Calculated rank (lower = earlier)

  status:
    | 'pending'
    | 'answered'
    | 'deferred'
    | 'escalated'
    | 'override_skipped';
  answerValue: string | string[] | null; // Normalised answer payload
  answerNotes: string | null; // Additional context provided by user
  overrideJustification: string | null; // Required when override_skipped
  conflictDecisionId: string | null; // Document-level decision that clashed
  conflictResolvedAt: string | null; // Timestamp of final reconciliation

  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}
```

```typescript
interface AssumptionOption {
  id: string;
  label: string;
  description: string | null;
  defaultSelected: boolean;
}
```

### AssumptionSession

Captures a single run of the new content flow for a blank section.

```typescript
interface AssumptionSession {
  id: string;
  sectionId: string;
  documentId: string;
  startedBy: string; // User id initiating the flow
  startedAt: string; // ISO timestamp
  status: 'in_progress' | 'awaiting_draft' | 'drafting' | 'blocked' | 'ready';
  templateVersion: string; // Template revision used for prompts
  documentDecisionSnapshotId: string; // Hash of doc-level decisions consulted
  unresolvedOverrideCount: number; // Block submission until 0
  answeredCount: number;
  deferredCount: number;
  escalatedCount: number;
  overrideCount: number;
  latestProposalId: string | null;
  summaryMarkdown: string | null; // Generated assumption summary preview
  closedAt: string | null; // When session finished (enter drafting lifecycle)
  closedBy: string | null;
}
```

### DraftProposal

Stores every generated or manually curated draft proposal produced during a
session.

```typescript
interface DraftProposal {
  id: string;
  sessionId: string;
  sectionId: string;
  proposalIndex: number; // Monotonic per session (0..n)
  source: 'ai_generated' | 'manual_revision' | 'ai_retry' | 'fallback_manual';
  contentMarkdown: string;
  rationale: Array<{
    assumptionId: string;
    summary: string; // Human-readable justification for this content block
  }>;
  aiConfidence: number | null; // 0-1 when LLM supplied score
  failedReason: string | null; // Populated when fallback/manual required
  createdAt: string;
  createdBy: string; // Usually same as session starter
  supersededAt: string | null; // When a later proposal replaced this one
  supersededByProposalId: string | null;
}
```

## Relationships

- `AssumptionSession` 1 — \* `SectionAssumption` (one prompt instance per
  session per template key).
- `AssumptionSession` 1 — \* `DraftProposal` (history of proposals for audit).
- `SectionAssumption` may reference at most one `DraftProposal` rationale entry
  per proposal, enabling traceable mapping from assumptions to content.

## State Machines

### Assumption Session Lifecycle

```
States: in_progress → awaiting_draft → drafting → ready
                     ↘ blocked (unresolved overrides)

Transitions:
- in_progress → awaiting_draft: All prompts answered/deferred/escalated without
  unresolved overrides.
- in_progress → blocked: User overrides prompts and has not yet reconciled them.
- awaiting_draft → drafting: User requests first proposal (AI or manual).
- drafting → ready: Section exported to standard drafting lifecycle once
  overrides cleared and proposal selected.
- blocked → in_progress: User reconciles overrides (re-answer or escalate).
```

### Section Assumption Status

```
States: pending → answered → (resolved)
        pending → deferred → pending
        pending → escalated → pending (after stakeholder response)
        pending → override_skipped → blocked → answered
```

Transitions align with FR-002/FR-003: any `override_skipped` state increases the
session's unresolved override count until the user supplies a conforming answer
or escalated resolution.

## Auditing & Telemetry

- Log assumption answers and overrides with `requestId`, `sessionId`, and
  `decisionSnapshotId` for traceability.
- Emit `assumption_session.completed`, `assumption_override.recorded`, and
  `draft_proposal.generated` events so QA dashboards can surface adoption.

## Data Volume Expectations

- ≤20 assumptions per section (derived from templates).
- ≤10 draft proposals per session (per performance constraint).
- Sessions stored for audit; expected retention 180 days (aligned with document
  history retention in `docs/architecture.md`).
