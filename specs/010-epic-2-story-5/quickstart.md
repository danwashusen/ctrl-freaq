# Quickstart — Section Draft Persistence

## Prerequisites

- `pnpm install`
- Clerk test user configured for local dev (see `/docs/front-end-spec.md`)
- Browser supports IndexedDB (Chrome/Edge/Firefox recent versions)

## Steps

1. **Launch services**
   - `pnpm dev:apps`
   - Open http://localhost:5173 and sign in as the test author.
2. **Create draft edits**
   - Navigate to an architecture document, open two sections, enter edit mode,
     and modify content in both.
   - Confirm draft indicators display text labels (e.g., "Draft pending") and an
     ARIA live announcement fires (use browser accessibility inspector).
3. **Validate offline recovery**
   - Toggle browser offline (DevTools → Network → Offline) and continue editing.
   - Refresh the page; verify drafts rehydrate and the compliance console
     warning appears if a retention policy flag is set in fixtures. appears if a
     retention policy flag is set in fixtures.
4. **Trigger storage pruning**
   - Use DevTools application tab to reduce available storage (simulate quota)
     or repeatedly duplicate draft content until the browser raises a quota
     error.
   - Observe toast + banner messaging explaining that the browser limit caused
     pruning; confirm oldest drafts removed first.
5. **Run bundled save**
   - Return online, click Save. Ensure a single network request hits
     `/api/projects/:projectSlug/documents/:documentId/draft-bundle`.
   - Inspect response: sections applied or conflict details surfaced back to UI.
   - Ensure compliance warning endpoint receives `202` if policy triggered.
6. **Execute tests**
   - `pnpm --filter apps/web test -- run document-editor` (unit tests for
     persistence hooks)
   - `pnpm --filter apps/api test -- draft-bundle` (contract tests)
   - `pnpm --filter @ctrl-freaq/web test:e2e:quick` (Playwright fixture run)

## Expected Results

- Draft indicators remain client-side, accessible, and resilient to reloads.
- Storage pruning occurs only when browser quota exceeded, with clear messaging.
- Bundled save merges validated sections and clears local drafts upon success.
- Compliance warnings log without transmitting draft content.
