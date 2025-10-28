# Data Model: Project Lifecycle Management

**Date**: 2025-10-25  
**Spec**: [spec.md](/specs/016-a-user-should-be-able/spec.md)  
**Decisions Referenced**: D001–D007 (see `research.md`)

## Entity Catalogue

### Project

| Field            | Type           | Required | Notes                                                                        | Validation/Constraints                                                       |
| ---------------- | -------------- | -------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `id`             | UUID           | Yes      | Primary key                                                                  | Auto-generated; format validated via Zod UUID                                |
| `ownerUserId`    | UUID           | Yes      | Workspace member that created the project                                    | Must correspond to authenticated user; enforced via auth middleware          |
| `name`           | string         | Yes      | Display name shown on dashboard cards                                        | 1–120 chars; trimmed; unique per owner + visibility scope                    |
| `slug`           | string         | Yes      | URL-safe identifier for deep links                                           | Lowercase `[a-z0-9-]`, 1–50 chars, unique with soft-delete filtering         |
| `description`    | string \| null | No       | Dashboard/detail summary; optional on create, persisted as null when omitted | ≤500 chars                                                                   |
| `visibility`     | enum           | Yes      | Sharing scope                                                                | One of `private`, `workspace`; default `workspace` (D003)                    |
| `status`         | enum           | Yes      | Lifecycle stage (D001)                                                       | One of `draft`, `active`, `paused`, `completed`, `archived`; default `draft` |
| `goalTargetDate` | date \| null   | No       | Target completion date (D004)                                                | Optional; must be ≥ creation date                                            |
| `goalSummary`    | string \| null | No       | Short text describing upcoming milestone                                     | ≤280 chars; optional                                                         |
| `createdAt`      | date           | Yes      | Audit timestamp                                                              | Set automatically; immutable                                                 |
| `createdBy`      | UUID           | Yes      | Actor who created project                                                    | Mirrors `ownerUserId` for MVP; future-proof for delegation                   |
| `updatedAt`      | date           | Yes      | Last mutation timestamp                                                      | Drives concurrency guard (D005); returned to clients                         |
| `updatedBy`      | UUID           | Yes      | Actor of last mutation                                                       | Captured from auth context                                                   |
| `deletedAt`      | date \| null   | No       | Soft-delete marker                                                           | Set when archived (Rule 15)                                                  |
| `deletedBy`      | UUID \| null   | No       | Actor who archived                                                           | Null until archive occurs                                                    |

### ProjectAccess

| Field       | Type | Required | Notes                    | Validation/Constraints                                  |
| ----------- | ---- | -------- | ------------------------ | ------------------------------------------------------- |
| `projectId` | UUID | Yes      | Foreign key → Project.id | ON DELETE restrict; filtered to non-archived by default |
| `userId`    | UUID | Yes      | Member with access       | Must exist in users table (Clerk/simple auth)           |
| `role`      | enum | Yes      | Access level             | `owner`, `editor`, `viewer`; owner seeded automatically |
| `createdAt` | date | Yes      | Added timestamp          | Auto-set                                                |
| `createdBy` | UUID | Yes      | Actor granting access    | Audit compliance                                        |
| `updatedAt` | date | Yes      | Last modification        |                                                         |
| `updatedBy` | UUID | Yes      | Actor modifying role     |                                                         |

> **Note**: ProjectAccess persists future multi-member support. For MVP we seed
> only owner row but downstream logic should use this table for permission
> checks.

## Relationships

- `ProjectAccess.projectId` → `Project.id` (1:N). Owner row inserted on project
  creation; additional rows allowed as features expand.
- `Project.ownerUserId` should match a `ProjectAccess` entry with
  `role="owner"`.
- Soft-deleted projects (`status=archived` or `deletedAt != null`) must be
  excluded from default queries, but `restore` operations may reference them
  explicitly.

## Lifecycle & State Transitions

```
draft → active → paused → active → completed
     \→ archived (from any non-archived state)
archived → (restore) → paused
```

- `draft`: Newly created project; minimal metadata. Dashboard may prompt setup.
- `active`: Primary working state once documents exist or user promotes project.
- `paused`: Temporarily on hold; restore endpoint reactivates to `paused` so
  owners must explicitly resume to `active`.
- `completed`: Finalized; still visible but editing limited to metadata.
- `archived`: Soft-deleted; hidden from dashboard and counts; stored with
  `deletedAt`/`deletedBy`.

**Transition Rules**

- Only owners (or future editors with manage permission) can move between
  states.
- `archived` is terminal for dashboard unless `restore` invoked.
- `completed` cannot revert directly to `draft`; must go through `paused` or
  `active`.
- Restore sets `status=paused` and clears `deletedAt/deletedBy`.

## Validation Rules (summary)

| Rule            | Applies To      | Details                                                                                      |
| --------------- | --------------- | -------------------------------------------------------------------------------------------- |
| Name uniqueness | Project         | Reject duplicate `name` for same owner when status != archived; use slug collision detection |
| Visibility      | Project         | Enum validated in API + shared-data; archived/restored retains visibility                    |
| Goal target     | Project         | Optional date >= today; include warning if > 5 years ahead (UI only)                         |
| Concurrency     | Project update  | Require `If-Unmodified-Since` header; compare to stored `updatedAt` (`±1s` tolerance)        |
| Archive guard   | Project delete  | Only allow when project status not already archived; idempotent for repeated calls           |
| Restore guard   | Project restore | Require archived state; rehydrate timestamps and reset status to `paused`                    |

## Derived Views

- **ProjectListItem DTO**: Subset for dashboard cards — includes `id`, `name`,
  `description`, `status`, `visibility`, `goalTargetDate`, `updatedAt`,
  `memberAvatars`, `documentsCount`.
- **ProjectSummary Stats**: Aggregates for dashboard hero cards (total active
  projects, completed count). Computed server-side for dashboards.

## Data Migration Notes

- Add columns (`status`, `visibility`, `goal_target_date`, `goal_summary`) with
  defaults (`draft`, `workspace`, `NULL`, `NULL`) and backfill existing rows.
- Ensure indexes on (`owner_user_id`, `deleted_at`) for faster listing and on
  (`slug`) for uniqueness.
- Update repository queries to filter `deleted_at IS NULL` by default; provide
  override for restore operations.
