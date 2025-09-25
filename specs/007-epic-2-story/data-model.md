# Data Model: Section Editor & WYSIWYG Capabilities

**Feature**: Section Editor & WYSIWYG Capabilities (007-epic-2-story) **Date**:
2025-09-25

## Overview

This data model captures the entities required to deliver manual section drafts,
conflict detection, diff previews, and section approval flows while preserving
the existing document hierarchy produced by prior stories.

## Core Entities

### SectionRecord

Represents canonical section content and metadata stored in the persistence
layer.

```typescript
interface SectionRecord {
  id: string; // UUID for section
  documentId: string; // Parent document
  templateKey: string; // Matches template guidance key
  title: string; // Display name
  depth: number; // Nesting level for ToC
  orderIndex: number; // Order within parent

  approvedVersion: number; // Monotonic version of approved content
  approvedContent: string; // Markdown body of approved section
  approvedAt: string; // ISO timestamp when approved
  approvedBy: string; // User id of approver
  lastSummary: string | null; // Reviewer-provided change summary

  status: 'idle' | 'drafting' | 'review' | 'ready';
  qualityGate: 'pending' | 'passed' | 'failed';
  accessibilityScore: number | null; // Latest a11y audit result

  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}
```

### SectionDraft

Represents a manual draft saved by a user while editing.

```typescript
interface SectionDraft {
  id: string; // UUID for draft entry
  sectionId: string; // Target section
  documentId: string; // Denormalized for queries
  userId: string; // Owner of draft

  draftVersion: number; // Client incremented version for optimistic locking
  draftBaseVersion: number; // Approved version the draft is based on
  contentMarkdown: string; // Draft markdown (may include unsupported marks)
  formattingAnnotations: FormattingAnnotation[]; // Highlight unsupported marks
  summaryNote: string; // Section-level change summary requested in FR-005

  conflictState: 'clean' | 'rebase_required' | 'rebased' | 'blocked';
  conflictReason: string | null; // Explanation when rebase required
  rebasedAt: string | null; // When server provided rebased content

  savedAt: string; // ISO timestamp of manual save
  savedBy: string; // User id of saver
}
```

### FormattingAnnotation

Captures unsupported formatting ranges that must be highlighted in the editor.

```typescript
interface FormattingAnnotation {
  id: string;
  sectionId: string;
  draftId: string;
  startOffset: number; // Character index of start
  endOffset: number; // Character index of end (exclusive)
  markType: string; // e.g., 'unsupported-color', 'font-size'
  message: string; // User-facing warning text
  severity: 'warning' | 'error';
}
```

### DraftConflictLog

Tracks each time a draft encounters conflicting approved content so UX can
explain why a rebase occurred.

```typescript
interface DraftConflictLog {
  id: string;
  sectionId: string;
  draftId: string;
  detectedAt: string; // ISO timestamp when conflict was detected
  detectedDuring: 'entry' | 'save'; // Clarification requires both checkpoints
  previousApprovedVersion: number;
  latestApprovedVersion: number;
  resolvedBy: 'auto_rebase' | 'manual_reapply' | 'abandoned';
  resolutionNote: string | null;
}
```

### SectionReviewSummary

Stores review context when a draft is submitted for approval.

```typescript
interface SectionReviewSummary {
  id: string;
  sectionId: string;
  documentId: string;
  draftId: string;
  reviewerId: string;
  reviewStatus: 'pending' | 'approved' | 'changes_requested';
  reviewerNote: string; // Provided rationale for decision
  submittedAt: string;
  decidedAt: string | null;
}
```

## Relationships

- `SectionRecord` 1 — \* `SectionDraft` (active user drafts per section).
- `SectionDraft` 1 — \* `FormattingAnnotation` (multiple highlights per draft).
- `SectionDraft` 1 — \* `DraftConflictLog` (historical conflict events).
- `SectionDraft` 1 — 1 `SectionReviewSummary` once a draft is submitted for
  approval.

## State Machines

### Draft Conflict Resolution

```
States: clean → rebase_required → rebased → clean
                       ↘ blocked

Transitions:
- clean → rebase_required: Detected on entry or save when versions mismatch.
- rebase_required → rebased: Server merges latest approved content and returns
  combined draft for user confirmation.
- rebase_required → blocked: Merge failed (structural conflict) and user must
  manually copy edits.
- rebased → clean: User confirms rebased draft and continues editing.
```

### Section Lifecycle

```
States: idle → drafting → review → ready
                  ↘ idle (on abandon)

Transitions:
- idle → drafting: User enters edit mode.
- drafting → review: Draft submitted with summary note.
- review → ready: Reviewer approves and SectionRecord.updatedVersion++.
- review → drafting: Reviewer requests changes.
- drafting → idle: User discards draft without submission.
```

## Validation Rules

- `SectionRecord.approvedContent` maximum 100,000 characters, trimmed before
  save.
- `SectionDraft.contentMarkdown` maximum 80,000 characters, sanitized to prevent
  script injection.
- `SectionDraft.draftVersion` must be greater than previous draft version for
  same `draftId`.
- `SectionDraft.draftBaseVersion` must equal `SectionRecord.approvedVersion`
  unless `conflictState` is not `clean`.
- `FormattingAnnotation` offsets must fall within draft content length and
  `startOffset < endOffset`.
- `DraftConflictLog.latestApprovedVersion` must be greater than
  `previousApprovedVersion` to avoid false conflicts.
- `SectionReviewSummary.reviewStatus` transitions must respect constitution TDD
  rules (no skipping pending state).

## Audit & Observability

- All writes must emit structured logs containing `requestId`, `sectionId`,
  `draftId`, conflict outcome, and reviewer decisions to satisfy constitutional
  observability requirements.
- Soft deletes rely on `deleted_at` columns per constitution; drafts are
  archived instead of hard-deleted.
