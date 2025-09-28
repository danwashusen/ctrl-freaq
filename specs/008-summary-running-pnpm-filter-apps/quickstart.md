# Quickstart — Document Editor Deep Links And Deterministic Fixtures

1. **Install dependencies**

   ```sh
   pnpm install
   ```

2. **Launch web app in E2E mode**

   ```sh
   pnpm --filter @ctrl-freaq/web dev:e2e
   ```

   - The script forces `VITE_E2E=true`, mounts the fixture middleware, and
     rewires API calls to `http://localhost:5173/__fixtures/api`.
   - You will see the console banner `E2E fixtures enabled` once the provider is
     active. Keep `VITE_USE_MOCK_CLERK=true` if you rely on mock auth.

3. **Run focused Playwright specs**

   ```sh
   pnpm --filter @ctrl-freaq/web test:e2e -- \
     document-editor/deep-link.e2e.ts \
     document-editor/fixture-missing.e2e.ts
   ```

   - Expect selectors `toc-panel`, `section-preview`, and `enter-edit` to
     appear.
   - Screenshots should capture fixture-backed content rather than the dashboard
     redirect.

4. **Manual smoke test**
   - Visit `http://localhost:5173/documents/demo-architecture/sections/sec-api`
     after authenticating with mock Clerk.
   - Confirm the table of contents, section preview, assumption modal, and
     static transcript render from fixtures.
   - Navigate to `/documents/demo-architecture/sections/missing` and verify the
     `DocumentMissing` view surfaces the "Fixture data unavailable" messaging
     with a link back to the dashboard.

5. **Re-run full suite**

   ```sh
   pnpm --filter @ctrl-freaq/web test:e2e
   ```

   - Runs Playwright with `playwright.fixture.config.ts` against deterministic
     data.
   - Use `pnpm --filter @ctrl-freaq/web test:live` to target
     `playwright.live.config.ts` once live-service coverage is ready.
   - Review `apps/web/test-results/` for any remaining failures or screenshot
     diffs.

6. **Reset environment**
   - Stop the dev server, return to the default mode with `pnpm dev`, and ensure
     `VITE_E2E` is cleared.
   - Commit updated fixtures, docs, and captured artifacts together after the
     suites pass.
