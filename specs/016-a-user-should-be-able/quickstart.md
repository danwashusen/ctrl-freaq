# Quickstart: Project Lifecycle Management

**Date**: 2025-10-25  
**Spec**: [spec.md](/specs/016-a-user-should-be-able/spec.md)  
**Research References**: US1–US4, D001–D007

## Prerequisites

1. Install dependencies: `pnpm install`
2. Start API and web apps in separate terminals (or use Turbo dev):
   - `pnpm --filter @ctrl-freaq/api dev`
   - `pnpm --filter @ctrl-freaq/web dev:live` (or `dev:e2e` for fixture mode)
3. Ensure SQLite database migrated:  
   `pnpm --filter @ctrl-freaq/shared-data cli migrate`
4. For Clerk-less local runs, enable simple auth users (`SIMPLE_AUTH_USER_FILE`)
   per existing quickstart guidance and ensure at least one entry includes
   `manage:projects` so dashboard creation works. The sample
   `docs/examples/simple-auth-users.yaml` ships with `user_alpha` already
   granted this permission.

> Tip: When iterating on API changes, run  
> `pnpm --filter @ctrl-freaq/api test:integration --watch` to keep project
> routes green.

## Scenario Walkthroughs

### US1 – Create a new project from the dashboard

1. Sign in via simple auth UI or Clerk depending on environment.
2. Navigate to `/dashboard`; TanStack Query should load an empty project list.
3. Trigger the “New Project” CTA and provide the project name (minimum
   requirement); add description, visibility, goal summary, or goal target date
   as needed.
4. Submit and confirm:
   - UI displays success toast and closes modal.
   - Dashboard list refetches (verify query devtools) and new project appears
     with `status=draft`.
5. API validation:
   - `curl -H "Authorization: Bearer <token>" \ http://localhost:5001/api/v1/projects`
   - Response includes `projects[0].status === "draft"` and `visibility`.
6. Open the browser console and confirm the telemetry event
   `[projects.telemetry] projects.lifecycle.create` logs with `durationMs`
   comfortably below 60000 ms (SC-001 sample).

### US2 – Review project summaries on the dashboard

1. Seed multiple projects using the supported create flow:
   - **UI**: Reopen the dashboard dialog and add at least two more projects.
     Give them distinct names to exercise list sorting. This requires the simple
     auth user to include `manage:projects`.
   - **API** (optional for automation): Issue POST requests with an authorized
     token. Example:

     ```bash
     curl -X POST http://localhost:5001/api/v1/projects \
       -H 'Content-Type: application/json' \
       -H 'Authorization: Bearer simple:<managerUserId>' \
       -d '{"name":"Pilot Docs","visibility":"workspace"}'
     ```

2. Refresh the dashboard; ensure totals update and cards show statuses, goal
   dates, and last updated timestamps.
3. Confirm sidebar Projects navigation adopts the same dataset (highlight active
   project).
4. For archived projects, toggle “Include archived” (if surfaced) or confirm
   they stay hidden by default.
5. Check `[projects.telemetry] projects.dashboard.hydration` in the console;
   `durationMs` should remain within the 2000 ms SC-002 target.

### US3 – Update an existing project

1. From dashboard, open a project detail page (e.g., `/project/<id>`).
2. Edit metadata (change name, set status to `active`, adjust goal summary).
3. On save, verify:
   - Request includes `If-Unmodified-Since` header with previous `updatedAt`.
   - Successful response updates `updatedAt`; UI refreshes conflict banner (if
     any).
   - On a stale tab, attempt to save with the old timestamp to trigger 409 and
     confirm the warning renders.
4. Re-run GET to confirm new slug (if name changed) and goal values persisted.

### US4 – Archive and restore a project

1. From dashboard card overflow menu, select “Archive”.
2. Confirm:
   - API returns 204; activity log entry recorded (check API logs).
   - Project disappears from active list.
3. Hit `POST /api/v1/projects/{id}/restore` (UI should expose “Restore” in the
   archive filter view).
4. Ensure the restored project re-enters the list with `status=paused` and audit
   fields cleared.

### CLI – Manage project lifecycle via shared-data

The shared-data CLI mirrors API lifecycle operations and is handy for scripted
checks or manual recovery:

- List projects (JSON or table output):

  ```bash
  pnpm --filter @ctrl-freaq/shared-data cli project list \
    --db-path "${DATABASE_PATH:-./data/ctrl-freaq.db}" --json
  ```

- Archive a project (pass actor to record audit trail):

  ```bash
  pnpm --filter @ctrl-freaq/shared-data cli project archive <projectId> \
    --db-path "${DATABASE_PATH:-./data/ctrl-freaq.db}" \
    --actor user_alpha
  ```

- Restore an archived project:

  ```bash
  pnpm --filter @ctrl-freaq/shared-data cli project restore <projectId> \
    --db-path "${DATABASE_PATH:-./data/ctrl-freaq.db}" \
    --actor user_alpha
  ```

The commands respect the same validations as the API and emit JSON when `--json`
is supplied, matching the CLI Interface Standard.

## Telemetry & Success Criteria Tracking

### SC-001 – Create to Visible (< 60 s)

- Capture telemetry by creating three sample projects in fixture mode. Each
  submission should emit `[projects.telemetry] projects.lifecycle.create` in the
  browser console. Record the `durationMs` values in the QA workbook and flag
  any sample above 60000 ms for follow-up.
- If the console log is missing, enable “Verbose” logs in devtools and retry;
  missing telemetry counts as a regression.

### SC-002 – Dashboard Hydration (< 2 s)

- Clear caches (`localStorage.clear()` and `sessionStorage.clear()`), reload
  `/dashboard`, and note `[projects.telemetry] projects.dashboard.hydration`.
  Track the first `durationMs` emitted for each filter/search combination.
- Sample at least 20 loads per milestone. Values trending above 2000 ms should
  trigger investigation (API latency, TanStack retries, or fixture drift).

### SC-003 – Update Success Rate (≥ 85 %)

1. Export at least 20 recent update attempts from API structured logs using the
   query for `"action":"update_project"`.
2. Count successes (info logs) versus failures (`Failed to update project`).
   Document totals and compute `successRate = successes / total`.
3. If the rate drops below 0.85, capture representative request IDs, classify
   failure reasons (conflict vs. infrastructure), and open a follow-up tied to
   SC-003.

### SC-004 – Archived Project Corrections (< 5 %)

- Generate an audit sample (JSON array with `projectId`, `archivedAt`,
  `reviewedAt`, `correctionRequired`, optional metadata) and run:

  ```bash
  pnpm --filter @ctrl-freaq/qa cli audit archived-projects \
    --input audits/archived-sample.json --threshold 5%
  ```

- Review the CLI summary for correction rate, projects needing review, and the
  sample sufficiency warning. Attach the command output to release notes.

## Verification Checklist

- `pnpm lint && pnpm typecheck && pnpm test` — must pass after code changes.
- API coverage:  
  `pnpm --filter @ctrl-freaq/api test:integration --filter projects` validates
  the new routes.
- Contract coverage:  
  `pnpm --filter @ctrl-freaq/api test:contract --filter projects` once contracts
  update.
- Web regression:
  `pnpm --filter @ctrl-freaq/web test:e2e:quick -- --grep "Dashboard"` exercises
  create/list/archive flows and verifies telemetry.
- Audit sampling:  
  `pnpm --filter @ctrl-freaq/qa cli audit archived-projects \ --input audits/archived-sample.json --threshold 5%`

## Rollback Guidance

- To undo a migration during development:  
  `pnpm --filter @ctrl-freaq/shared-data cli migrate --rollback`.
- Clearing local data: delete `.tmp/sqlite/dev.db` (or configured path) and
  rerun migrations; re-seed using CLI.
- If TanStack Query caches stale data, call
  `queryClient.invalidateQueries({ queryKey: ['projects'] })` in the browser
  console during debugging.
