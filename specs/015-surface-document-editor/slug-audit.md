# Slug Usage Audit (Issue #98)

Date: 2025-11-10

## Method

- Ran `rg -l projectSlug .` and `rg -l documentSlug .` from the workspace root
  to enumerate every location that still references slug parameters.
- Normalized each path and recorded whether it matches `projectSlug`,
  `documentSlug`, or both.
- Classified each site as either an owning repository (allowed to convert slugs
  to IDs) or an external consumer (must use canonical IDs). No owning
  repositories reference these identifiers; all matches belong to external
  consumers.

## Summary

- Backend routes currently accept slugs from URLs then forward them unchanged to
  services/repositories, which violates the slug boundary rules. These routes
  must translate slugs to IDs using the owning repositories before calling any
  downstream service.
- Draft bundle services/repositories, compliance logging, and CLI utilities all
  accept `projectSlug` even though they operate outside the owning repo layer.
  They must switch to `projectId`, keeping slugs only for observability.
- Frontend routing, fixtures, and IndexedDB persistence remain slug-based for UX
  reasons; they will need companion ID fields to satisfy the new backend
  contracts.
- Documentation/spec mentions are informational and need no code changes.

## Detailed Inventory

| Path                                                                                       | Mentions                  | Layer              | Classification |
| ------------------------------------------------------------------------------------------ | ------------------------- | ------------------ | -------------- |
| `apps/api/src/routes/documents.ts`                                                         | projectSlug, documentSlug | api-routes         | external       |
| `apps/api/src/routes/projects.ts`                                                          | projectSlug               | api-routes         | external       |
| `apps/api/src/services/drafts/draft-bundle.repository.ts`                                  | projectSlug               | api-services       | external       |
| `apps/api/src/services/drafts/draft-bundle.service.ts`                                     | projectSlug               | api-services       | external       |
| `apps/api/src/testing/fixtures/section-editor.ts`                                          | projectSlug               | api-testing        | external       |
| `apps/api/tests/contract/co-authoring/analyze.contract.test.ts`                            | projectSlug               | api-tests          | external       |
| `apps/api/tests/contract/co-authoring/apply.contract.test.ts`                              | projectSlug               | api-tests          | external       |
| `apps/api/tests/contract/co-authoring/proposal.contract.test.ts`                           | projectSlug               | api-tests          | external       |
| `apps/api/tests/contract/documents.draft-bundle.contract.test.ts`                          | projectSlug               | api-tests          | external       |
| `apps/api/tests/contract/documents.draft-compliance.contract.test.ts`                      | projectSlug               | api-tests          | external       |
| `apps/api/tests/contract/fixtures/project-retention.ts`                                    | projectSlug               | api-tests          | external       |
| `apps/api/tests/contract/projects.retention.contract.test.ts`                              | projectSlug               | api-tests          | external       |
| `apps/api/tests/contract/quality-gates/sections.contract.test.ts`                          | projectSlug               | api-tests          | external       |
| `apps/api/tests/contract/quality-gates/traceability.contract.test.ts`                      | projectSlug               | api-tests          | external       |
| `apps/api/tests/contract/section-editor/section-editor.contract.test.ts`                   | projectSlug               | api-tests          | external       |
| `apps/api/tests/integration/events/section-draft.stream.test.ts`                           | projectSlug               | api-tests          | external       |
| `apps/api/tests/unit/drafts/draft-bundle.repository.test.ts`                               | projectSlug               | api-tests          | external       |
| `apps/api/tests/unit/drafts/draft-bundle.service.test.ts`                                  | projectSlug               | api-tests          | external       |
| `apps/web/src/features/document-editor/components/document-editor.tsx`                     | projectSlug, documentSlug | web-features       | external       |
| `apps/web/src/features/document-editor/components/document-section-preview.test.tsx`       | projectSlug, documentSlug | web-features       | external       |
| `apps/web/src/features/document-editor/components/document-section-preview.tsx`            | projectSlug, documentSlug | web-features       | external       |
| `apps/web/src/features/document-editor/components/section-draft/DraftStatusBadge.test.tsx` | projectSlug, documentSlug | web-features       | external       |
| `apps/web/src/features/document-editor/components/section-draft/DraftStatusBadge.tsx`      | projectSlug, documentSlug | web-features       | external       |
| `apps/web/src/features/document-editor/hooks/use-document-bootstrap.test.tsx`              | projectSlug               | web-features       | external       |
| `apps/web/src/features/document-editor/hooks/use-document-bootstrap.ts`                    | projectSlug               | web-features       | external       |
| `apps/web/src/features/document-editor/hooks/use-document-fixture.ts`                      | projectSlug, documentSlug | web-features       | external       |
| `apps/web/src/features/document-editor/hooks/use-draft-persistence.test.tsx`               | projectSlug, documentSlug | web-features       | external       |
| `apps/web/src/features/document-editor/hooks/use-draft-persistence.ts`                     | projectSlug, documentSlug | web-features       | external       |
| `apps/web/src/features/document-editor/services/draft-client.ts`                           | projectSlug               | web-features       | external       |
| `apps/web/src/features/document-editor/services/project-retention.ts`                      | projectSlug               | web-features       | external       |
| `apps/web/src/features/document-editor/stores/document-store.ts`                           | projectSlug               | web-features       | external       |
| `apps/web/src/features/section-editor/hooks/use-section-draft.test.ts`                     | projectSlug, documentSlug | web-features       | external       |
| `apps/web/src/features/section-editor/hooks/use-section-draft.ts`                          | projectSlug, documentSlug | web-features       | external       |
| `apps/web/src/lib/fixtures/e2e/demo-architecture.ts`                                       | projectSlug               | web-fixtures       | external       |
| `apps/web/src/lib/fixtures/e2e/index.ts`                                                   | projectSlug               | web-fixtures       | external       |
| `apps/web/src/lib/fixtures/e2e/transformers.ts`                                            | projectSlug               | web-fixtures       | external       |
| `apps/web/src/lib/fixtures/e2e/types.ts`                                                   | projectSlug               | web-fixtures       | external       |
| `apps/web/src/lib/telemetry/client-events.test.ts`                                         | projectSlug, documentSlug | web-telemetry      | external       |
| `apps/web/src/lib/telemetry/client-events.ts`                                              | projectSlug, documentSlug | web-telemetry      | external       |
| `apps/web/src/mocks/projectRetention.ts`                                                   | projectSlug               | web-mocks          | external       |
| `apps/web/tests/integration/section-editor/manual-save.test.ts`                            | projectSlug, documentSlug | web-tests          | external       |
| `docs/architecture.md`                                                                     | projectSlug, documentSlug | docs               | external       |
| `docs/front-end-spec.md`                                                                   | projectSlug               | docs               | external       |
| `packages/editor-persistence/src/cli.ts`                                                   | projectSlug, documentSlug | editor-persistence | external       |
| `packages/editor-persistence/src/draft-store.ts`                                           | projectSlug, documentSlug | editor-persistence | external       |
| `packages/editor-persistence/src/schema.ts`                                                | projectSlug, documentSlug | editor-persistence | external       |
| `packages/editor-persistence/tests/draft-store.test.ts`                                    | projectSlug, documentSlug | editor-persistence | external       |
| `packages/qa/src/compliance/drafts.ts`                                                     | projectSlug, documentSlug | qa                 | external       |
| `specs/010-epic-2-story-5/contracts/draft-save.openapi.yaml`                               | projectSlug               | specs              | external       |
| `specs/010-epic-2-story-5/data-model.md`                                                   | projectSlug, documentSlug | specs              | external       |
| `specs/010-epic-2-story-5/quickstart.md`                                                   | projectSlug               | specs              | external       |
| `specs/010-epic-2-story-5/research.md`                                                     | projectSlug, documentSlug | specs              | external       |
| `specs/010-epic-2-story-5/tasks.md`                                                        | projectSlug               | specs              | external       |
| `specs/011-epic-2-story-6/quickstart.md`                                                   | projectSlug               | specs              | external       |
| `specs/015-surface-document-editor/research.md`                                            | projectSlug               | specs              | external       |

**Key:** Owning repositories live under `packages/shared-data`. None of those
files contain the literal `projectSlug`/`documentSlug` strings; they expose slug
lookup helpers instead and remain the only place where slug translation should
happen.
