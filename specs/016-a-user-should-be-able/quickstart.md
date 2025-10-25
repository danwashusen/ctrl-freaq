# Quickstart: Project Lifecycle Management

**Date**: 2025-10-25  
**Spec**: [spec.md](/specs/016-a-user-should-be-able/spec.md)  
**Research References**: US1–US4, D001–D007

## Prerequisites

1. Install dependencies: `pnpm install`
2. Start API and web apps in separate terminals (or use Turbo dev):
   - `pnpm --filter @ctrl-freaq/api dev`
   - `pnpm --filter @ctrl-freaq/web dev:live` (or `dev:e2e` for fixture mode)
3. Ensure SQLite database migrated: `pnpm --filter @ctrl-freaq/shared-data cli migrate`
4. For Clerk-less local runs, enable simple auth users (`SIMPLE_AUTH_USER_FILE`) per existing quickstart guidance.

> Tip: When iterating on API changes, run `pnpm --filter @ctrl-freaq/api test:integration --watch` to keep project routes green.

## Scenario Walkthroughs

### US1 – Create a new project from the dashboard

1. Sign in via simple auth UI or Clerk depending on environment.
2. Navigate to `/dashboard`; TanStack Query should load an empty project list.
3. Trigger the “New Project” CTA, fill required fields (name, description, visibility, goal target date).
4. Submit and confirm:
   - UI displays success toast and closes modal.
   - Dashboard list refetches (verify query devtools) and new project appears with `status=draft`.
5. API validation:
   - `curl -H "Authorization: Bearer <token>" http://localhost:5001/api/v1/projects`
   - Response includes `projects[0].status === "draft"` and `visibility`.

### US2 – Review project summaries on the dashboard

1. Seed multiple projects via CLI (temporary):  
   `pnpm --filter @ctrl-freaq/shared-data cli seed-project --name "Pilot Docs" --visibility workspace`
2. Refresh dashboard; ensure totals update and cards show statuses, goal dates, and last updated timestamps.
3. Confirm sidebar Projects navigation adopts same dataset (highlight active project).
4. For archived projects, toggle “Include archived” filter (if surfaced) or confirm they stay hidden by default.

### US3 – Update an existing project

1. From dashboard, open a project detail page (e.g., `/project/<id>`).
2. Edit metadata (change name, set status to `active`, adjust goal summary).
3. On save, verify:
   - Request includes `If-Unmodified-Since` header with previous `updatedAt`.
   - Successful response updates `updatedAt`; UI refreshes conflict banner (if any).
   - On stale tab, attempt to save with old timestamp to trigger 409 and ensure warning renders.
4. Re-run GET to confirm new slug (if name changed) and goal values persisted.

### US4 – Archive and restore a project

1. From dashboard card overflow menu, select “Archive”.
2. Confirm:
   - API returns 204; activity log entry recorded (check API logs).
   - Project disappears from active list.
3. Hit `POST /api/v1/projects/{id}/restore` (UI should expose “Restore” action in archive filter view).
4. Ensure restored project re-enters list with `status=paused` and audit fields cleared.

## Verification Checklist

- `pnpm lint && pnpm typecheck && pnpm test` — must pass after code changes.
- API coverage: `pnpm --filter @ctrl-freaq/api test:integration --filter projects` to validate new routes.
- Contract coverage: `pnpm --filter @ctrl-freaq/api test:contract --filter projects` once contracts updated.
- Web regression: `pnpm --filter @ctrl-freaq/web test:e2e:quick -- --grep "Dashboard"` to exercise create/list/archive flows.

## Rollback Guidance

- To undo a migration during development: `pnpm --filter @ctrl-freaq/shared-data cli migrate --rollback`.
- Clearing local data: delete `.tmp/sqlite/dev.db` (or configured path) and rerun migrations; re-seed using CLI.
- If TanStack Query caches stale data, call `queryClient.invalidateQueries({ queryKey: ['projects'] })` in browser console during debugging.
