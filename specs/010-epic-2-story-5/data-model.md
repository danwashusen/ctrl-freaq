# Data Model — Section Draft Persistence

## Entity: DocumentDraftState

| Field                      | Type           | Description                                      |
| -------------------------- | -------------- | ------------------------------------------------ |
| `projectSlug`              | string         | Stable slug for the project owning the document. |
| `documentSlug`             | string         | Slug for document; used in draft keys.           |
| `authorId`                 | string         | Clerk user identifier for the signed-in author.  |
| `sections`                 | SectionDraft[] | All section drafts with display order.           |
| `updatedAt`                | ISO timestamp  | Last local modification timestamp.               |
| `rehydratedAt`             | ISO timestamp  | Timestamp when drafts were rehydrated.           |
| `pendingComplianceWarning` | boolean        | Flag for retention policy                        |
| escalation.                |

Relationships:

- A `DocumentDraftState` aggregates many `SectionDraft` records keyed by
  document slug + section title + author.

## Entity: SectionDraft

| Field              | Type                                | Description                                      |
| ------------------ | ----------------------------------- | ------------------------------------------------ |
| `sectionTitle`     | string                              | Display title from template (part of key).       |
| `sectionPath`      | string                              | Stable slug/path representing section hierarchy. |
| `draftKey`         | string                              | `{projectSlug}/{documentSlug}/{sectionTitle}`    |
| `/{authorId}` key. |
| `baselineVersion`  | string                              | Hash of the last published section content.      |
| `patch`            | string                              | Git-style patch diff representing local changes. |
| `lastEditedAt`     | ISO timestamp                       | Timestamp of the author's last local edit.       |
| `status`           | enum (`draft`, `conflict`, `ready`) | Current state of the draft.                      |
| `conflictSummary`  | string?                             | Optional explanation when status = `conflict`.   |

Constraints:

- `draftKey` is unique per author.
- Status transitions: `draft → ready` after validation, `draft → conflict` when
  server baseline changes, `conflict → draft` after manual resolution.

## Entity: DraftBundle

| Field         | Type              | Description                                      |
| ------------- | ----------------- | ------------------------------------------------ |
| `documentId`  | string            | Server identifier for the architecture document. |
| `sections`    | DraftSubmission[] | Sections queued for save after validation.       |
| `submittedBy` | string            | Author ID submitting the bundle.                 |
| `submittedAt` | ISO timestamp     | When bundle dispatched to backend.               |

### Sub-Entity: DraftSubmission

| Field               | Type                  | Description                    |
| ------------------- | --------------------- | ------------------------------ |
| `sectionPath`       | string                | Template path for section.     |
| `patch`             | string                | Git-style patch diff to apply. |
| `baselineVersion`   | string                | Expected server baseline hash. |
| `qualityGateReport` | DraftValidationResult | Outcome of local gates.        |

## Entity: DraftValidationResult

| Field         | Type                  | Description                          |
| ------------- | --------------------- | ------------------------------------ |
| `status`      | enum (`pass`, `fail`) | Outcome of validation.               |
| `issues`      | ValidationIssue[]     | Blocking/non-blocking gate messages. |
| `validatedAt` | ISO timestamp         | When validation ran.                 |

### Sub-Entity: ValidationIssue

| Field      | Type                        | Description                       |
| ---------- | --------------------------- | --------------------------------- |
| `gateId`   | string                      | Identifier of the gate triggered. |
| `severity` | enum (`blocker`, `warning`) | Severity of the issue.            |
| `message`  | string                      | Human-readable description.       |

## Entity: ComplianceWarning

| Field          | Type                            | Description                                  |
| -------------- | ------------------------------- | -------------------------------------------- |
| `projectSlug`  | string                          | Project requiring retention.                 |
| `documentSlug` | string                          | Document impacted.                           |
| `authorId`     | string                          | Author with unsynced drafts.                 |
| `policyId`     | string                          | Identifier for the retention policy.         |
| `detectedAt`   | ISO timestamp                   | When the violation was detected client-side. |
| `status`       | enum (`logged`, `acknowledged`) | Compliance handling state.                   |

Lifecycle:

- `logged` when warning emitted locally and queued for server log.
- `acknowledged` once operations or project owner flags resolution.

## Derived Views

### React Store Snapshot

A Zustand store exposes derived selectors:

- `selectDraftByKey(draftKey)` → `SectionDraft`
- `selectReadyDrafts()` → list of `SectionDraft` with `status = ready`
- `selectComplianceWarnings()` → pending `ComplianceWarning`

### Telemetry Event Payload

| Field                | Type          | Description                                            |
| -------------------- | ------------- | ------------------------------------------------------ |
| `event`              | enum          | `draft.saved` \| `draft.pruned` \| `draft.conflict` \| |
| `compliance.warning` |
| `context`            | object        | Minimal metadata (documentSlug,<br>sectionTitle,       |
| authorId).           |
| `timestamp`          | ISO timestamp | When event emitted.                                    |

No draft content is ever included in telemetry payloads.
