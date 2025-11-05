# Quickstart – Surface Document Editor

Use these walkthroughs to validate the Surface Document Editor feature
end-to-end. Each scenario maps to the user stories and reconnaissance entries
documented in `research.md`.

## Prerequisites

- Install dependencies: `pnpm install`
- Ensure fixture assets are present (`apps/api/.env.fixture`,
  `apps/web/.env.fixture`)
- Start the stack in fixture mode when running Playwright flows:
  `CTRL_FREAQ_PROFILE=fixture pnpm dev:apps:e2e`
- For manual API calls, export a valid bearer token (Clerk or simple auth) and
  set `API_BASE=http://localhost:5001/api/v1`

## Scenario US1 – Resume architecture document from Project view

1. Run backend contract tests to confirm the primary-document snapshot endpoint
   shape:  
   `pnpm --filter @ctrl-freaq/api test -- --runInBand --filter="projects primary document"`
2. With the dev stack running, seed a project that already has a primary
   document (fixture `project-active`).  
   Request `GET $API_BASE/projects/{projectId}/documents/primary` and verify
   `status: ready` plus `documentId`/`firstSectionId`.
3. In the browser, navigate to `/projects/{projectId}` and activate the “Open
   Document” workflow card (button wired in `Project.tsx`).
   - Expect navigation to `/documents/{documentId}/sections/{firstSectionId}`
     within 5 seconds.
   - Confirm the Table of Contents and section body render live content (no
     fixture placeholders).
4. Return to the Project view via breadcrumb/back link and ensure the workflow
   card reflects the ready state without refetch glitches.
5. Automation: add/execute a Playwright test (e.g.,
   `apps/web/tests/e2e/project-open-document.e2e.ts`) that covers steps 3–4.

## Scenario US2 – Provision a document when none exists

1. Create a clean project without a primary document via CLI or API
   (`POST $API_BASE/projects` with `status=draft`).
2. Verify `GET $API_BASE/projects/{projectId}/documents/primary` returns
   `status: missing`.
3. Trigger provisioning from the UI by selecting the “Create Document” card.
   - A loading indicator should appear, followed by success messaging.
   - The app navigates automatically to the document editor for the new
     document.
4. Confirm the API response recorded `status: created` and that the first
   section id matches the editor URL.
5. Error path: simulate a template validation failure (e.g., manipulate
   templates service to reject) and ensure the card surfaces the error copy
   without creating duplicates.
6. Regression automation: extend React Testing Library coverage for
   `Project.tsx` to assert button states, and add a contract test for the
   idempotent `POST /projects/{projectId}/documents` response when a document
   already exists.

## Scenario US3 – Collaborate and validate within the document editor

1. Open the document editor for a project with multiple sections. Confirm the
   new bootstrap hook renders a loading skeleton before data appears.
2. Edit a section, enter a summary note, and trigger “Manual save”.
   - Expect the diff viewer to show changes and the API to respond with
     `200 OK`.
   - Introduce a conflicting edit (e.g., second browser) and verify the conflict
     dialog prompts to refresh/retry while preserving the local draft.
3. Start a co-authoring session from the sidebar.
   - Observe streaming tokens; cancel mid-stream and ensure retry works.
   - For fallback testing, set `AI_STREAMING_DISABLED=true` and confirm the UI
     surfaces fallback copy.
4. Kick off a QA review via the QA panel.
   - Confirm progress updates, SLA messaging, and that results land in the
     dashboard.
   - Use the “Re-run document validations” button to exercise document-level
     quality gates.
5. Trigger an export from the Project view. Check
   `POST /projects/{projectId}/export` returns `202` and poll until the job
   completes (`artifactUrl` non-null).
6. Automated verification:
   - Vitest: add unit tests for the live bootstrap hook and manual save panel
     wiring.
   - Contract: add coverage for export job lifecycle under
     `/apps/api/tests/contract/export`.
   - Playwright: extend fixture suite to assert co-author streaming and QA
     feedback appear using deterministic fixtures.

## Rollback & Cleanup

- To reset state between runs, execute `pnpm clean` followed by `pnpm db:reset`
  (if provided) or recreate the SQLite database via project CLI.
- Remove any temporary environment overrides (e.g., `AI_STREAMING_DISABLED`)
  before running the gauntlet.
- After validating, stop the dev stack (`Ctrl+C`) and clear Playwright traces:
  `pnpm --filter @ctrl-freaq/web test:e2e:quick -- --ui --update-snapshots=false`.
