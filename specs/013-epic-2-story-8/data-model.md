# Data Model — Quality Gates Integration

## Status Vocabulary

- `Pass`
- `Warning`
- `Blocker`
- `Neutral` (validation not yet executed)

All models reference this shared enumeration.

## SectionQualityGateResult

| Field              | Type                                          | Notes                                                                  |
| ------------------ | --------------------------------------------- | ---------------------------------------------------------------------- |
| `sectionId`        | `string` (UUID)                               | Foreign key → Section                                                  |
| `documentId`       | `string` (UUID)                               | Denormalized for fast lookups                                          |
| `runId`            | `string` (UUID)                               | Correlates API/CLI run, telemetry, audit                               |
| `status`           | `Pass` \| `Warning` \| `Blocker` \| `Neutral` | Current overall gate outcome                                           |
| `rules`            | `Array<GateRuleResult>`                       | Ordered by severity desc                                               |
| `lastRunAt`        | `Date`                                        | Completion timestamp (used for freshness SLA)                          |
| `lastSuccessAt`    | `Date \| null`                                | Null until first pass/warning-only run                                 |
| `triggeredBy`      | `string` (userId)                             | Authenticated collaborator                                             |
| `source`           | `enum('auto','manual','dashboard')`           | Debounce auto-run, manual section action, or dashboard-triggered batch |
| `durationMs`       | `number`                                      | Execution time for telemetry                                           |
| `remediationState` | `enum('pending','in-progress','resolved')`    | Tracks follow-up status for UI                                         |

### GateRuleResult

| Field        | Type                                           | Notes                             |
| ------------ | ---------------------------------------------- | --------------------------------- |
| `ruleId`     | `string`                                       | Stable identifier from QA ruleset |
| `title`      | `string`                                       | Short label for UI display        |
| `severity`   | `Pass` \| `Warning` \| `Blocker`               | Mirrors status vocabulary         |
| `guidance`   | `Array<string>`                                | Bulleted remediation steps        |
| `docLink`    | `string \| null`                               | Optional `View policy` link       |
| `location`   | `{ path: string; start: number; end: number }` | Inline highlight anchor           |
| `resolvedAt` | `Date \| null`                                 | When author confirmed remediation |

## DocumentQualityGateSummary

| Field             | Type                                                                  | Notes                                                        |
| ----------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| `documentId`      | `string` (UUID)                                                       | Primary key                                                  |
| `statusCounts`    | `{ pass: number; warning: number; blocker: number; neutral: number }` | Aggregated section totals                                    |
| `blockerSections` | `Array<string>`                                                       | Section IDs with blockers for quick disable checks           |
| `warningSections` | `Array<string>`                                                       | Section IDs with warnings                                    |
| `lastRunAt`       | `Date`                                                                | Most recent batch run                                        |
| `triggeredBy`     | `string` (userId)                                                     | Who triggered the batch                                      |
| `requestId`       | `string`                                                              | Echoed in telemetry/audit footer                             |
| `publishBlocked`  | `boolean`                                                             | Convenience field (true if blockers > 0 or missing coverage) |
| `coverageGaps`    | `Array<RequirementGap>`                                               | Requirements without passing coverage                        |

### RequirementGap

| Field            | Type                                           | Notes                               |
| ---------------- | ---------------------------------------------- | ----------------------------------- |
| `requirementId`  | `string`                                       | Reference into requirements catalog |
| `reason`         | `enum('no-link','blocker','warning-override')` | Why publish is blocked              |
| `linkedSections` | `Array<string>`                                | Sections contributing to gap        |

## TraceabilityLink

| Field             | Type                                             | Notes                                          |
| ----------------- | ------------------------------------------------ | ---------------------------------------------- |
| `requirementId`   | `string`                                         | Primary key part                               |
| `sectionId`       | `string`                                         | Linked section                                 |
| `documentId`      | `string`                                         | Denormalized                                   |
| `revisionId`      | `string`                                         | Content revision captured after validation     |
| `gateStatus`      | `Pass` \| `Warning` \| `Blocker` \| `Neutral`    | Latest validation result for linked content    |
| `coverageStatus`  | `enum('covered','warning','blocker','orphaned')` | Derived for dashboard filters                  |
| `lastValidatedAt` | `Date`                                           | Timestamp displayed in matrix                  |
| `validatedBy`     | `string` (userId)                                | Actor from audit trail                         |
| `notes`           | `string[]`                                       | Optional compliance notes                      |
| `auditTrail`      | `Array<TraceabilityAuditEvent>`                  | Historical actions (reassign, orphan, resolve) |

### TraceabilityAuditEvent

| Field       | Type                                                                    | Notes                                          |
| ----------- | ----------------------------------------------------------------------- | ---------------------------------------------- |
| `eventId`   | `string` (UUID)                                                         | Unique audit entry                             |
| `type`      | `enum('link-created','link-updated','link-orphaned','link-reassigned')` | Event category                                 |
| `timestamp` | `Date`                                                                  | When action occurred                           |
| `actorId`   | `string`                                                                | User responsible                               |
| `details`   | `Record<string, string>`                                                | Structured metadata (e.g., previous sectionId) |

## Relationships & Workflows

- **SectionQualityGateResult** (1) ←→ (1) **Section**; latest result replaces
  prior entry, history retained via audit log.
- **DocumentQualityGateSummary** aggregates all `SectionQualityGateResult`
  records for the same `documentId` after each batch run.
- **TraceabilityLink** entries update immediately after gate completion,
  referencing the `revisionId` produced by the editor.
- Each gate run emits:
  1. Persist section result
  2. Update document summary
  3. Synchronize traceability links + coverage gaps
  4. Append audit + telemetry events with `runId` correlation
