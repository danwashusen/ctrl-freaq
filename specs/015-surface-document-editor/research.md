# Research – Surface Document Editor

## Decision Log

- **D001 – Primary document discovery API**
  - **Decision**: Add a project-scoped endpoint
    (`GET /api/v1/projects/:projectId/documents/primary`) that returns the
    primary document id, status, first section id, and recent template decision
    so the Project page can display status and launch the editor with the
    correct identifiers.
  - **Rationale**: The Project page currently requests template metadata with
    the project id, triggering `TEMPLATE_UPGRADE_NOT_FOUND` errors. A dedicated
    discovery endpoint keeps project metadata lean while ensuring the UI always
    receives a valid document id (or an explicit “missing” state) before calling
    document services.
  - **Alternatives considered**: Embedding the document id inside the existing
    project payload couples unrelated concerns and forces project fetches to
    hydrate template data even when not needed; relying on the template store to
    infer the document id retains the current bug because it never receives a
    valid id.

- **D002 – Document provisioning workflow**
  - **Decision**: Introduce `POST /api/v1/projects/:projectId/documents` that
    seeds a project’s primary document using the templates package defaults and
    returns the new document plus its first section id. The UI will surface the
    action through the “Create Document” workflow card with optimistic loading,
    retry, and navigation to `/documents/:documentId/sections/:sectionId`.
  - **Rationale**: Provisioning must be synchronous for Story 2.2 so that
    maintainers can move directly into the editor. Piggybacking on templates
    keeps schema alignment while allowing backend control over default content,
    ids, and ownership metadata.
  - **Alternatives considered**: A background job would break the “create → edit
    immediately” workflow; triggering the templates CLI from the client
    introduces security risk and violates the CLI-standard principle for
    libraries.

- **D003 – Live document bootstrap**
  - **Decision**: Replace `useDocumentFixtureBootstrap` with a live-data hook
    (`useDocumentBootstrap`) that coordinates the existing `SectionsApiService`,
    document store, quality store, assumptions, and event hub subscriptions. The
    hook will gate editing behind loading indicators, handle 404 recovery, and
    sync the table of contents, assumptions sessions, and QA state using real
    API data.
  - **Rationale**: Fixtures mask latency, conflicts, and streaming behaviour.
    Converging on the production services guarantees that editor components
    (manual save, diff, QA, co-authoring) operate on authoritative data and meet
    the success criteria around load times and error handling.
  - **Alternatives considered**: Extending the route loader to fetch everything
    up front would lead to large responses and duplicate caching logic;
    continuing to hydrate from fixtures prevents integration with live services
    and keeps the editor unreachable from the UX.

- **D004 – Section persistence & conflict handling**
  - **Decision**: Wire the manual save panel and diff workflow to the section
    editor client
    (`POST /projects/:projectSlug/documents/:documentId/draft-bundle`) and use
    conflict responses to populate the existing conflict dialog and retry flows.
    The editor will persist local drafts via `@ctrl-freaq/editor-persistence`,
    surface 409 conflict states, and guide the user through refresh/reapply
    flows without losing unsaved edits.
  - **Rationale**: The section editor client already encapsulates draft bundle
    validation, diffing, and error normalisation. Extending that client keeps
    persistence logic consistent with backend expectations and satisfies the
    FR-007/FR-008 requirements.
  - **Alternatives considered**: Reimplementing save logic in the document
    editor duplicates the section editor module and risks violating the draft
    bundle contract; bypassing conflicts would fail the collaboration
    guarantees.

- **D005 – Collaboration, QA, and streaming integrations**
  - **Decision**: Reuse the existing co-authoring, document QA, and quality gate
    hooks with real document/section ids and ensure the Project→Editor
    navigation seeds the stores with those identifiers. Event Hub subscriptions
    remain the primary transport, falling back to polling when disabled, and UI
    components will expose cancel/retry affordances tied to API responses.
  - **Rationale**: The hooks already encapsulate SSE handling, retry states, and
    telemetry. Providing real identifiers unlocks the sidebar, QA panel, and
    quality dashboard without reengineering streaming transports, aligning with
    FR-009 through FR-011.
  - **Alternatives considered**: Rewriting collaboration for websockets or
    polling increases scope with no added value; deferring QA integration would
    leave FR-011 unsatisfied and block success metrics.

- **D006 – Template validation and export actions**
  - **Decision**: Activate the “Edit Templates” and “Export Project” workflow
    cards by calling the template upgrade service (existing POST in
    `apps/api/src/routes/templates.ts`) and a new export trigger
    (`POST /api/v1/projects/:projectId/export`) that delegates to
    `@ctrl-freaq/exporter`. Both flows provide toast/banner feedback and
    duration telemetry.
  - **Rationale**: Template validation already exists in the store; wiring UI
    actions completes the approval loop. Exporting through a dedicated endpoint
    centralises permissions and job tracking while meeting FR-012/FR-013.
  - **Alternatives considered**: Launching external CLIs from the browser or
    leaving the cards inert fails the spec requirement to surface these actions
    from the Project view.

## Codebase Reconnaissance

### US1 – Resume architecture document from Project view

| Story/Decision | File/Directory                                                       | Role Today                                                                                                                                        | Helpers/Configs                                                                                                           | Risks & Follow-up                                                                                                                                    | Verification Hooks                                                                                                                    |
| -------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| D001 / US1     | /apps/web/src/pages/Project.tsx                                      | Loads project metadata, renders workflow cards, and incorrectly calls `useTemplateStore.loadDocument` with the project id; lacks action handlers. | Depends on `useTemplateStore`, TanStack Query, Event Hub, and `useApiClient`; respects `CTRL_FREAQ_PROFILE` fixture flag. | Must introduce accessible buttons, loading states, and avoid double-fetches when navigating between projects; ensure event subscriptions cleaned up. | `pnpm --filter @ctrl-freaq/web test:e2e:quick` (project dashboard), new unit tests for Project card actions, existing lint/typecheck. |
| D001 / US1     | /apps/web/src/app/router/document-routes.tsx                         | Defines `/documents/:documentId/sections/:sectionId` route and loader; currently hydrates fixtures instead of live data.                          | Uses React Router loader, `getDocumentFixture`, `isE2EModeEnabled`.                                                       | Needs to fetch real data, return 404 handling, and preserve fixture override for tests.                                                              | Route-level unit test plus Playwright navigation covering Project→Document.                                                           |
| D001 / US1     | /apps/web/src/stores/template-store.ts                               | Manages document/template state for Project banner; currently expects `loadDocument` to receive document id.                                      | Pulls from API client wrappers, template validator factory.                                                               | Ensure new discovery call populates store before rendering upgrade UI; guard against null template.                                                  | Template store unit tests; `pnpm test --filter template-store`.                                                                       |
| D001 / US1     | /apps/api/src/routes/projects.ts                                     | Exposes project CRUD but no document discovery.                                                                                                   | Uses shared-data repositories, event broker, zod validation.                                                              | Add primary-document lookup without regressing existing routes; respect library-first boundary by leveraging repositories.                           | New contract/integration tests under `/apps/api/tests/contract/projects`.                                                             |
| D003 / US1     | /apps/web/src/features/document-editor/hooks/use-document-fixture.ts | Bootstraps editor from fixture data; no live fetch logic.                                                                                         | Relies on `createDraftStore`, fixture transformers, localStorage.                                                         | Replacing this hook affects editor mount; ensure draft seeding still works in fixture mode via feature flag.                                         | Editor store unit tests and fixture Playwright flows.                                                                                 |

### US2 – Provision a document when none exists

| Story/Decision | File/Directory                    | Role Today                                                                                        | Helpers/Configs                                                     | Risks & Follow-up                                                                                                                                         | Verification Hooks                                                                        |
| -------------- | --------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| D002 / US2     | /apps/web/src/pages/Project.tsx   | Displays “Create Document” card with no handler; needs to trigger provisioning and handle errors. | Uses `Button`, `Card` components, local state for mutation banners. | Must debounce repeated submissions, surface async status, and navigate only after success.                                                                | React Testing Library test for button behaviour; Playwright flow creating first document. |
| D002 / US2     | /apps/web/src/lib/api.ts          | Houses API client for projects/documents; lacks project-scoped create document call.              | Central auth token resolver, `logger`, request wrappers.            | Adding new methods must respect error handling and keep typings aligned with backend schema.                                                              | Api client unit tests (if absent, add) plus integration test hitting mocked fetch.        |
| D002 / US2     | /apps/api/src/routes/documents.ts | Manages document retrieval and draft bundle saves; no create endpoint today.                      | Uses template validation middleware, repositories, zod.             | Implementing create must reuse repository, assign template metadata, and emit activity events per constitution; ensure idempotency for repeated requests. | Contract tests under `/apps/api/tests/contract/documents` and unit tests for new service. |
| D002 / US2     | /packages/templates/src           | Provides template defaults and validation; used to seed new documents.                            | CLI + schema exports.                                               | Need consistent version selection for new doc; confirm CLI loading from shared templates rather than hard-coded values.                                   | Template package unit tests, `pnpm --filter @ctrl-freaq/templates cli validate`.          |

### US3 – Collaborate and validate within the document editor

| Story/Decision | File/Directory                                                                               | Role Today                                                                                               | Helpers/Configs                                                                                                             | Risks & Follow-up                                                                                                                                                 | Verification Hooks                                                                 |
| -------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| D003 / US3     | /apps/web/src/features/document-editor/components/document-editor.tsx                        | Core editor UI; currently relies on fixture bootstrap and doesn’t enforce loading states before editing. | Consumes stores (`useEditorStore`, `useDocumentStore`), `createSectionEditorClient`, co-author/QA hooks, manual save panel. | Must orchestrate new bootstrap hook, handle missing sections, and avoid rendering editor before data; ensure timers cleaned up to prevent leaks.                  | Component integration tests (Vitest + React Testing Library) plus editor E2E flow. |
| D003 / US3     | /apps/web/src/features/document-editor/services/sections-api.ts                              | Wraps sections endpoints; not yet used for initial bootstrap.                                            | Extends `ApiClient`, fetches sections/ToC, includes helpers for status filtering.                                           | Confirm endpoints exist in backend and error handling matches loader expectations; consider caching to meet 5s load SLA.                                          | Service unit tests with mocked fetch; contract tests for new backend endpoints.    |
| D004 / US3     | /apps/web/src/features/section-editor/api/section-editor.client.ts                           | Handles draft bundle submission, diff retrieval, conflict errors; currently unused by Project surface.   | Interacts with backend draft endpoints, uses typed DTOs.                                                                    | Ensure manual save panel hooks into this client and surfaces incidents; respect audit logging via `logger`.                                                       | Existing section editor tests plus new conflict regression tests.                  |
| D004 / US3     | /apps/api/src/modules/section-editor                                                         | Provides draft bundle services and conflict resolution logic.                                            | Uses repositories, assumption prompt provider; orchestrates validations.                                                    | Must accept incoming saves triggered by Project navigation without regressions; ensure permission checks and conflict detection triggered.                        | Section editor module unit tests and API contract tests for draft bundle route.    |
| D005 / US3     | /apps/web/src/features/document-editor/hooks/useCoAuthorSession.ts                           | Streams co-authoring sessions; needs real document ids to route requests/SSE.                            | Depends on `co-authoring.client`, `useCoAuthoringStore`, event hub fallback.                                                | Must ensure session teardown on navigation and handle 401/429 responses gracefully.                                                                               | Co-authoring hook unit tests, SSE integration tests via mocked event hub.          |
| D005 / US3     | /apps/web/src/features/document-editor/hooks/useDocumentQaSession.ts                         | Manages document QA conversations; currently fixture-limited.                                            | Uses document QA API client, SSE subscriptions.                                                                             | Must propagate documentId/sectionId from bootstrap; handle fallback streaming flags (`DOCUMENT_QA_STREAMING_DISABLED`).                                           | QA hook unit tests plus Playwright scenario hitting QA panel.                      |
| D005 / US3     | /apps/web/src/features/document-editor/quality-gates/components/DocumentQualityDashboard.tsx | Visualises quality gate status; expects live data from hooks.                                            | Depends on `useQualityGates`, telemetry emitter.                                                                            | Requires real document summary and SLA copy; ensure run button disabled correctly during pending export.                                                          | Quality gates unit tests and Playwright coverage focusing on dashboard updates.    |
| D006 / US3     | /apps/api/src/routes/templates.ts                                                            | Offers template validation endpoints used by banner.                                                     | Works with template upgrade service, ensures CLI compliance.                                                                | Need to expose action for “Edit Templates” card if additional route required (e.g., to fetch upgrade details) and ensure new UI interactions respect rate limits. | Template upgrade contract tests.                                                   |
| D006 / US3     | /apps/api/src/routes/projects.ts & /packages/exporter/src                                    | Future home for export trigger; exporter package generates artifacts.                                    | Exporter already exposes CLI; requires wrapper service for REST usage.                                                      | Must manage async export duration and deliver download URL or job id; respect CLI standard by adding pnpm-exposed command for backend service.                    | Exporter unit tests and new API contract tests.                                    |

## Notes

- No unresolved clarifications remain; decisions reference Constitution mandates
  for library-first architecture, CLI exposure, and TDD.
- Fixture mode must remain intact for Playwright suites by gating new live calls
  behind `CTRL_FREAQ_PROFILE=fixture` checks where necessary.
- The plan script reported multiple spec directories with the `015-` prefix
  (legacy spec `015-as-a-documentation-lead-i`); confirm downstream automation
  targets the `015-surface-document-editor` directory to avoid confusion.
