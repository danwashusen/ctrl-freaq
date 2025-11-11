# Data Model – Surface Document Editor

This model captures the data required to surface the document editor from the
Project view, bootstrap live document content, support collaboration, and expose
template/export workflows without prescribing implementation details.

## Entities

### ProjectDocumentSnapshot

- **Description**: Read model returned from the project discovery endpoint so
  the Project page can render workflow card states.
- **Key Fields**
  - `projectId` (UUID) – owning project.
  - `primaryDocumentId` (UUID \| null) – current primary document; `null` when
    none exists.
  - `firstSectionId` (UUID \| null) – first editable section when the document
    exists.
  - `documentStatus` (`missing` \| `loading` \| `ready` \| `archived`) –
    high-level status for UI badges.
  - `templateDecision` (TemplateValidationDecision \| null) – most recent
    upgrade requirement.
  - `lastUpdatedAt` (timestamp) – freshness stamp for caching and optimistic UI.
- **Relationships**: References `DocumentMetadata` and
  `TemplateValidationDecision`.
- **Invariants**
  - `firstSectionId` must be null when `primaryDocumentId` is null.
  - Status `archived` implies document has `archivedAt` in persistence.

### DocumentMetadata

- **Description**: Core details the editor needs after bootstrap.
- **Key Fields**
  - `documentId` (UUID)
  - `projectId` (UUID)
  - `title` (string)
  - `lifecycleStatus` (`draft` \| `review` \| `published`)
  - `lastModifiedAt` (timestamp)
  - `templateId` (string)
  - `templateVersion` (string)
  - `templateSchemaHash` (string)
- **Relationships**: Has many `SectionView` records; belongs to one `Project`.
- **Invariants**
  - Template identifiers must be non-empty when document exists.
  - Lifecycle transitions obey backend state machine (e.g., `draft` → `review` →
    `published`).

### SectionView

- **Description**: Represents a rendered section inside the editor.
- **Key Fields**
  - `sectionId` (UUID)
  - `documentId` (UUID)
  - `title` (string)
  - `orderIndex` (integer, 0-based)
  - `depth` (integer) – ToC nesting.
  - `status` (`idle` \| `assumptions` \| `drafting` \| `review` \| `ready`)
  - `content` (rich-text/structured object)
  - `summaryNote` (string \| null)
  - `lastSavedAt` (timestamp \| null)
  - `lastSavedBy` (user id \| null)
  - `pendingDraft` (SectionDraftSnapshot \| null)
  - `qualityStatus` (`pass` \| `warning` \| `blocker` \| `neutral`)
- **Relationships**: Contains zero or more `SectionDraftSnapshot` records per
  collaborator; links to `AssumptionSession` and `QualityGateRun`.
- **Invariants**
  - `orderIndex` is unique per document.
  - `pendingDraft` must include `baselineVersion` when present.
  - `status=review` requires `summaryNote` to be non-empty.

### SectionDraftSnapshot

- **Description**: Local draft metadata used for manual save and conflict
  resolution.
- **Key Fields**
  - `draftKey` (string) – deterministic key combining
    project/document/section/author.
  - `baselineVersion` (string) – server version when draft was created.
  - `patch` (string) – serialized patch or markdown diff.
  - `status` (`draft` \| `rebased` \| `blocked`)
  - `lastEditedAt` (timestamp)
  - `authorId` (string)
- **Relationships**: Attached to `SectionView`; stored locally (persisted via
  `editor-persistence`) and mirrored server-side when submitted.
- **Invariants**
  - `baselineVersion` must align with the server’s latest section revision on
    submission; mismatches surface conflict states.

### AssumptionSession

- **Description**: Tracks assumption generation/approval per section.
- **Key Fields**
  - `sessionId` (UUID)
  - `sectionId` (UUID)
  - `documentId` (UUID)
  - `status` (`idle` \| `streaming` \| `completed` \| `failed`)
  - `assumptions` (array of { id, text, status })
  - `resolvedAt` (timestamp \| null)
- **Relationships**: Belongs to `SectionView`; updates feed the assumptions
  sidebar.
- **Invariants**
  - Only one active session per section at a time.
  - Completed sessions must record `resolvedAt`.

### CoAuthoringSession

- **Description**: Represents collaborative authoring interactions per section.
- **Key Fields**
  - `sessionId` (UUID)
  - `documentId` (UUID)
  - `sectionId` (UUID)
  - `intent` (`summarize` \| `rewrite` \| `critique` \| `custom`)
  - `status` (`queued` \| `streaming` \| `awaiting-approval` \| `fallback` \|
    `canceled` \| `error`)
  - `transcript` (ordered turns)
  - `pendingProposalId` (string \| null)
  - `diffHash` (string \| null)
  - `lastUpdatedAt` (timestamp)
- **Relationships**: Linked to `SectionView`; interacts with telemetry for
  quotas; cancellation updates propagate to UI.
- **Invariants**
  - `pendingProposalId` exists only when status is `awaiting-approval`.
  - `transcript` records both user and assistant turns in chronological order.

### DocumentQaSession

- **Description**: Handles QA review conversations per section.
- **Key Fields**
  - `sessionId` (UUID)
  - `documentId` (UUID)
  - `sectionId` (UUID)
  - `status` (`running` \| `completed` \| `failed` \| `canceled`)
  - `prompt` (string)
  - `queuePosition` (integer \| null)
  - `streamLocation` (URL \| null)
  - `requestId` (string)
  - `lastEventAt` (timestamp)
- **Relationships**: Belongs to `SectionView`; may subscribe to SSE via Event
  Hub.
- **Invariants**
  - `streamLocation` required when status `running`.
  - Canceled sessions retain `requestId` for audit logs.

### DocumentQualityRun

- **Description**: Aggregate for document-level quality gate results.
- **Key Fields**
  - `runId` (UUID)
  - `documentId` (UUID)
  - `triggeredBy` (user id or system id)
  - `status` (`running` \| `ready` \| `failed`)
  - `durationMs` (integer \| null)
  - `statusCounts` ({ pass, warning, blocker, neutral })
  - `publishBlocked` (boolean)
  - `lastRunAt` (timestamp \| null)
- **Relationships**: Summary references per-section `QualityGateSnapshot`
  entries stored in section store.
- **Invariants**
  - `publishBlocked` true implies `statusCounts.blocker > 0`.
  - `durationMs` recorded only when status is `ready` or `failed`.

### TemplateValidationDecision

- **Description**: Most recent template upgrade requirement displayed on the
  Project page.
- **Key Fields**
  - `decisionId` (UUID)
  - `templateId` (string)
  - `currentVersion` (string)
  - `requestedVersion` (string)
  - `action` (`approved` \| `pending` \| `blocked`)
  - `submittedBy` (user id)
  - `submittedAt` (timestamp)
- **Relationships**: Associated with `DocumentMetadata` and surfaced via
  `ProjectDocumentSnapshot`.
- **Invariants**
  - `action=blocked` implies the UI must render recovery CTA; `requestedVersion`
    must differ from `currentVersion`.

### ExportJob

- **Description**: Tracks project export requests initiated from the Project
  page.
- **Key Fields**
  - `jobId` (UUID)
  - `projectId` (UUID)
  - `requestedBy` (user id)
  - `requestedAt` (timestamp)
  - `status` (`queued` \| `running` \| `completed` \| `failed`)
  - `artifactUrl` (string \| null) – download link on completion.
  - `format` (`markdown` \| `zip` \| `pdf` \| `bundle`)
  - `errorMessage` (string \| null)
- **Relationships**: Optional link to `DocumentMetadata` when export is
  document-scoped; results stored for audit trail.
- **Invariants**
  - `artifactUrl` must exist when status `completed`.
  - `errorMessage` populated only when status `failed`.

## Relationships & Derived Views

- **ProjectDocumentSnapshot → DocumentMetadata**: lookup by `primaryDocumentId`;
  ensures UI can fetch detailed metadata only when navigating to the editor.
- **DocumentMetadata → SectionView**: one-to-many; sections provide ordered
  content and statuses for navigation and the ToC.
- **SectionView → SectionDraftSnapshot / AssumptionSession / CoAuthoringSession
  / DocumentQaSession / QualityGateSnapshot**: each section can maintain draft,
  assumption, collaboration, QA, and quality state concurrently; hooks
  coordinate updates through Zustand stores.
- **DocumentQualityRun → Section Quality**: aggregated counts inform publish
  eligibility and dashboard copy.
- **TemplateValidationDecision** informs Project workflow banners and must align
  with template store data.
- **ExportJob** provides progress/feedback for Project workflow cards and can be
  polled or streamed.

## State Transitions (Informational)

- **Document lifecycle**: `draft` → `review` (manual save + approval) →
  `published`; archiving moves document out of discovery results.
- **Section status**: `idle` → `assumptions` (running assumption flow) →
  `drafting` (active edits) → `review` (manual save submitted) → `ready`
  (approved). Conflicts return section to `drafting` with `pendingDraft`
  flagged.
- **CoAuthoring session**: `queued` → `streaming` → `awaiting-approval` →
  (`fallback` \| `canceled` \| `error`) → `completed` (after apply).
  Cancellation returns editor control immediately.
- **Document QA session**: `running` → `completed`/`failed`; cancellation
  short-circuits to `canceled`.
- **Export job**: `queued` → `running` → `completed` (artifact available) or
  `failed` (error surfaced).

All transitions must be reflected in UI stores to keep manual save prompts,
quality dashboards, and workflow cards consistent with backend state.
