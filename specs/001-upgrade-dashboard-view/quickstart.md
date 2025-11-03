# Quickstart: Dashboard Shell Alignment

## Prerequisites

- Install workspace dependencies: `pnpm install`
- Launch fixture backend + frontend for visual validation: `pnpm dev:apps`
  (CTRL+C when finished)
  - Mock comparison available at http://localhost:4173/
- Ensure Auth provider configured (Clerk or Simple) so dashboard loads sample
  data

## Story Walkthroughs

### US1 – Stay Oriented in the Dashboard Shell (ref: D001, D004)

1. Run `pnpm --filter @ctrl-freaq/web test` to execute Vitest suites touching
   `Dashboard.tsx`.
2. Start fixture mode `pnpm --filter @ctrl-freaq/web dev:e2e`; open
   http://localhost:5173/dashboard.
3. Confirm header renders product title, descriptor (≥ `sm` breakpoint),
   settings CTA, and user menu.
   - Compare spacing to mock while honoring real data.
4. Resize viewport below 768px; toggle sidebar control.
   - Focus should move into overlay and return to toggle on close.
5. Cross-check acceptance with Playwright project navigation:  
   `pnpm --filter @ctrl-freaq/web test:e2e --project="dashboard/project-navigation.e2e.ts"`

### US2 – Navigate Projects from the Sidebar (ref: D002, D003)

1. With fixture server running, verify sidebar lists projects alphabetically
   with lifecycle badges.
   - Data source: `useProjectsQuery` (see
     `/apps/web/src/hooks/use-projects-query.ts`).
2. Click a project name; confirm highlight follows selection and project
   workspace loads in same tab.
3. Return to dashboard (back navigation); sidebar should retain active highlight
   per `useProjectStore`.
4. Regression script:
   `pnpm --filter @ctrl-freaq/web test:e2e --project="dashboard/project-navigation.e2e.ts"`
5. Manual check: toggle archived filter to ensure sidebar reflects updated
   dataset.

### US3 – Recover from Empty or Error States (ref: D003)

1. Simulate empty dataset by running unit test that mocks `projects: []`:  
   `pnpm --filter @ctrl-freaq/web test --run tests matching "Dashboard empty state"`.
2. In fixture mode, apply a search term with no matches; the sidebar should show
   the filter-aware empty state (`No projects match "<term>"`) with buttons for
   `Reset filters` and `Start a project`. Clicking the CTA opens the existing
   `CreateProjectDialog`.
3. Trigger an API failure (disconnect backend) to observe inline error copy
   paired with the `Try Again` retry control while the main dashboard remains
   usable.
4. Validate the Playwright empty-state CTA:  
   `pnpm --filter @ctrl-freaq/web test:e2e -- tests/e2e/dashboard/project-empty-state.e2e.ts`
5. Validate Playwright create flow:  
   `pnpm --filter @ctrl-freaq/web test:e2e --project="dashboard/project-create.e2e.ts"`

## Verification Hooks

- Unit: `/apps/web/src/pages/Dashboard.test.tsx`
- Store: `/apps/web/src/stores/project-store.test.ts`
- E2E: `/apps/web/tests/e2e/dashboard/*.e2e.ts`
- Manual comparison: http://localhost:4173/ (mock shell reference)

## Rollback Guidance

- If new shell introduces regressions, revert layout component changes and
  restore previous `Dashboard.tsx` structure while keeping telemetry and dialogs
  intact.
- Re-run `pnpm lint`, `pnpm typecheck`, and `pnpm test` to confirm recovery.
