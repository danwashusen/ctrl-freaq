# Contract: Project Listing for Dashboard Shell

**Endpoint**: `GET /api/projects` (consumed via `ApiClient.listProjects`)  
**Purpose**: Provide the sidebar and main dashboard with identical project
datasets.

## Request

| Parameter         | Type    | Required | Notes                                                            |
| ----------------- | ------- | -------- | ---------------------------------------------------------------- |
| `limit`           | number  | optional | Default 20 (matches existing dashboard behaviour).               |
| `offset`          | number  | optional | Paginates archived lists; defaults to 0.                         |
| `search`          | string  | optional | Trimmed search query; empty string ignored.                      |
| `includeArchived` | boolean | optional | When true, includes archived projects with `status: "archived"`. |

- Authentication: Clerk JWT supplied through existing `ApiProvider`.
- Headers: `Accept: application/json`, `Authorization: Bearer <token>`.

## Response (200 OK)

```json
{
  "projects": [
    {
      "id": "proj_123",
      "ownerUserId": "user_456",
      "name": "Architecture Overhaul",
      "slug": "architecture-overhaul",
      "description": "Rebuild the architecture pipeline.",
      "visibility": "workspace",
      "status": "active",
      "archivedStatusBefore": null,
      "goalTargetDate": "2025-12-01",
      "goalSummary": "Launch beta-ready docs portal.",
      "createdAt": "2025-09-01T10:00:00.000Z",
      "updatedAt": "2025-10-28T14:30:00.000Z",
      "createdBy": "user_456",
      "updatedBy": "user_789",
      "deletedAt": null,
      "deletedBy": null
    }
  ],
  "total": 6,
  "limit": 20,
  "offset": 0
}
```

### Field Notes

- `status` MUST map to known lifecycle badges: `draft`, `active`, `paused`,
  `completed`, `archived`.
- `archivedStatusBefore` MUST be non-null when `status` equals `archived` so
  restore messaging remains accurate.
- `goalTargetDate` MAY be null; UI formats fallback copy via
  `formatGoalTargetDate`.

## Error Responses

| Status                      | Body                                                    | UX Handling                                                     |
| --------------------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| `401 Unauthorized`          | `{ "error": { "message": "Unauthorized" } }`            | Redirect handled globally by auth provider.                     |
| `500 Internal Server Error` | `{ "error": { "message": "Failed to list projects" } }` | Sidebar shows inline error copy with retry affordance (FR-005). |

## Usage Requirements

- The sidebar MUST consume the same response object as the main card list to
  avoid divergent views.
- Loading placeholders should rely on TanStack Query status flags (`isLoading`,
  `isFetching`).
- Errors surfaced here should trigger UX defined in US3 acceptance scenarios
  without mutating cached data.

## No New Endpoints

All user interactions required for the dashboard shell rely on existing project
contracts. No additional API contracts are introduced by this feature.
