import { expect, test } from '@playwright/test';

import type {
  TemplateValidationDecision,
  DocumentResponse,
  DocumentSectionsResponse,
  PrimaryDocumentSnapshotResponse,
} from '@/lib/api';
import { selectSimpleAuthUser } from './support/draft-recovery';
import { resetFixtureProjectsStore } from '@/lib/api';
import { getDocumentFixture } from '@/lib/fixtures/e2e';
import { buildFixtureDocumentView } from '@/lib/fixtures/e2e/transformers';

const primaryProject = {
  id: 'proj-architecture-demo',
  ownerUserId: 'user-primary-owner',
  name: 'CTRL FreaQ Architecture',
  slug: 'ctrl-freaq-architecture',
  description: 'Primary architecture documentation project for fixture flows.',
  visibility: 'workspace' as const,
  status: 'active' as const,
  archivedStatusBefore: null,
  goalTargetDate: '2025-03-01T00:00:00.000Z',
  goalSummary: 'Keep architecture baseline review-ready.',
  createdAt: '2025-01-01T00:00:00.000Z',
  createdBy: 'user-primary-owner',
  updatedAt: '2025-01-15T12:00:00.000Z',
  updatedBy: 'user-primary-owner',
  deletedAt: null,
  deletedBy: null,
};

const primarySnapshot = {
  documentId: 'demo-architecture',
  firstSectionId: 'sec-overview',
};

const templateBinding = {
  templateId: 'architecture-reference',
  templateVersion: '2.1.0',
  templateSchemaHash: 'tmpl-architecture-210',
};

const defaultTemplateDecision: TemplateValidationDecision = {
  decisionId: 'decision-primary',
  action: 'approved',
  templateId: templateBinding.templateId,
  currentVersion: templateBinding.templateVersion,
  requestedVersion: templateBinding.templateVersion,
  submittedAt: primaryProject.updatedAt,
  submittedBy: 'user-primary-owner',
  notes: null,
};

const primaryDocumentSnapshot: PrimaryDocumentSnapshotResponse = {
  projectId: primaryProject.id,
  status: 'ready',
  document: {
    documentId: primarySnapshot.documentId,
    firstSectionId: primarySnapshot.firstSectionId,
    title: 'CTRL FreaQ Architecture Reference',
    lifecycleStatus: 'review',
    lastModifiedAt: primaryProject.updatedAt,
    template: templateBinding,
  },
  templateDecision: null,
  lastUpdatedAt: primaryProject.updatedAt,
};

const missingDocumentSnapshot: PrimaryDocumentSnapshotResponse = {
  projectId: primaryProject.id,
  status: 'missing',
  document: null,
  templateDecision: null,
  lastUpdatedAt: primaryProject.updatedAt,
};

let activePrimarySnapshot: PrimaryDocumentSnapshotResponse = primaryDocumentSnapshot;

const documentFixture = getDocumentFixture(primarySnapshot.documentId);
const documentView = buildFixtureDocumentView(documentFixture);

const templateSections = documentView.toc.sections.map(section => ({
  id: section.sectionId,
  title: section.title,
  orderIndex: section.orderIndex,
  type: 'content',
  children: [],
}));

const templateSummaryResponse = {
  template: {
    id: templateBinding.templateId,
    name: 'Architecture Reference',
    description: 'Architecture reference template used for primary documents.',
    documentType: 'architecture',
    status: 'active',
    activeVersion: templateBinding.templateVersion,
    activeVersionMetadata: {
      version: templateBinding.templateVersion,
      schemaHash: templateBinding.templateSchemaHash,
      status: 'active',
      changelog: null,
      sections: templateSections,
    },
    createdAt: primaryProject.createdAt,
    updatedAt: primaryProject.updatedAt,
  },
};

const templateVersionResponse = {
  version: {
    templateId: templateBinding.templateId,
    version: templateBinding.templateVersion,
    schemaHash: templateBinding.templateSchemaHash,
    schema: { title: 'Architecture Reference Schema', type: 'object' },
    sections: templateSections,
  },
};

test.describe('Project workflow — Open document', () => {
  test.beforeEach(async ({ page }) => {
    resetFixtureProjectsStore();
    activePrimarySnapshot = primaryDocumentSnapshot;

    await page.route('**/__fixtures/api/**', async route => {
      const request = route.request();
      const method = request.method();
      if (method !== 'GET') {
        await route.fallback();
        return;
      }

      const url = new URL(request.url());
      const path = url.pathname;

      const projectsCollectionPattern = /\/projects(?:\/)?$/;
      if (
        path === '/__fixtures/api/templates/architecture-reference' ||
        path === '/__fixtures/api/v1/templates/architecture-reference'
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(templateSummaryResponse),
        });
        return;
      }

      if (
        path === '/__fixtures/api/templates/architecture-reference/versions/2.1.0' ||
        path === '/__fixtures/api/v1/templates/architecture-reference/versions/2.1.0'
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(templateVersionResponse),
        });
        return;
      }

      const sectionsMatch = path.match(/\/documents\/([^/]+)\/sections(?:\/)?$/);
      if (sectionsMatch) {
        const documentId = sectionsMatch[1];
        if (documentId === primarySnapshot.documentId) {
          const sectionsResponse: DocumentSectionsResponse = {
            sections: documentView.sections,
            toc: documentView.toc,
          };
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(sectionsResponse),
          });
          return;
        }

        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'fixtures.document_sections_not_found',
            message: `Unknown document sections for: ${documentId}`,
          }),
        });
        return;
      }

      const primarySnapshotMatch = path.match(/\/projects\/([^/]+)\/documents\/primary(?:\/)?$/);
      if (primarySnapshotMatch) {
        const projectId = primarySnapshotMatch[1];
        if (projectId === primaryProject.id) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(activePrimarySnapshot),
          });
          return;
        }

        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'fixtures.primary_document_not_found',
            message: `Unknown primary document snapshot project: ${projectId}`,
          }),
        });
        return;
      }

      const documentMatch = path.match(/\/documents\/([^/]+)(?:\/)?$/);
      if (documentMatch) {
        const documentId = documentMatch[1];
        if (documentId === primarySnapshot.documentId) {
          const documentResponse: DocumentResponse = {
            document: {
              id: documentView.documentId,
              projectId: primaryProject.id,
              title: documentView.title,
              content: documentFixture.sections,
              templateId: templateBinding.templateId,
              templateVersion: templateBinding.templateVersion,
              templateSchemaHash: templateBinding.templateSchemaHash,
            },
            migration: null,
            templateDecision: defaultTemplateDecision as unknown as Record<string, unknown>,
          };
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(documentResponse),
          });
          return;
        }

        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'fixtures.document_not_found',
            message: `Unknown document: ${documentId}`,
          }),
        });
        return;
      }

      if (path.includes('/documents/')) {
        await route.fallback();
        return;
      }

      if (projectsCollectionPattern.test(path)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            projects: [primaryProject],
            total: 1,
            limit: 20,
            offset: 0,
          }),
        });
        return;
      }

      const match = path.match(/\/projects\/([^/]+)$/);
      if (match) {
        const projectId = match[1];
        if (projectId === primaryProject.id) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(primaryProject),
          });
          return;
        }

        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'fixtures.project_not_found',
            message: `Unknown fixture project: ${projectId}`,
          }),
        });
        return;
      }

      await route.fallback();
    });
  });

  test('navigates from project card to the live document editor', async ({ page }) => {
    await page.goto(`/project/${primaryProject.id}`);
    await page.waitForLoadState('networkidle');
    await selectSimpleAuthUser(page);

    const workflowCard = page.getByTestId('project-workflow-open-document');
    await expect(workflowCard).toBeVisible();
    await expect(workflowCard).toHaveAttribute('data-state', /ready|loading/);

    await workflowCard.click();

    await page.waitForURL(
      new RegExp(
        `/documents/${primarySnapshot.documentId}/sections/${primarySnapshot.firstSectionId}(?:\\?projectId=${primaryProject.id})?$`
      )
    );

    await expect(page.getByTestId('toc-panel')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Document Editor/i })).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(
        `/documents/${primarySnapshot.documentId}/sections/${primarySnapshot.firstSectionId}(?:\\?projectId=${primaryProject.id})?$`
      )
    );
  });

  test('shows provisioning stepper and troubleshooting guidance when creation fails', async ({
    page,
  }) => {
    activePrimarySnapshot = missingDocumentSnapshot;

    await page.route(
      `**/__fixtures/api/**/projects/${primaryProject.id}/documents`,
      async route => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
              code: 'fixtures.templates_unavailable',
              message: 'Templates service unavailable',
            }),
          });
          return;
        }
        await route.fallback();
      }
    );

    await page.goto(`/project/${primaryProject.id}`);
    await page.waitForLoadState('networkidle');
    await selectSimpleAuthUser(page);

    const createCard = page.getByTestId('project-workflow-create-document');
    await expect(createCard).toHaveAttribute('data-state', 'missing');

    await createCard.getByRole('button', { name: /create document/i }).click();

    await expect(page.getByTestId('create-document-stepper')).toBeVisible();
    const failureBanner = page.getByTestId('create-document-failure-banner');
    await expect(failureBanner).toBeVisible();
    await expect(page.getByRole('button', { name: /retry create document/i })).toBeEnabled();
  });
});
