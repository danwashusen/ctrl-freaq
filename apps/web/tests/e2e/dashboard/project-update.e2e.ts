import { expect, test } from '@playwright/test';

import { selectSimpleAuthUser } from '../support/draft-recovery';
import { resetFixtureProjectsStore } from '@/lib/api';

test.describe('Dashboard Project Update', () => {
  test.beforeEach(() => {
    resetFixtureProjectsStore();
  });

  test('updates project metadata and surfaces version conflict messaging', async ({ page }) => {
    const projectId = 'proj-update-flow';
    let lastModifiedHeader = '2026-05-10T12:00:00.000Z';
    const projectResponse: Record<string, unknown> = {
      id: projectId,
      ownerUserId: 'user_2abc123def456',
      name: 'Lifecycle Update Pilot',
      slug: 'lifecycle-update-pilot',
      description: 'Original description from fixture',
      visibility: 'workspace',
      status: 'draft',
      goalTargetDate: '2026-06-01',
      goalSummary: 'Prepare update flow demo',
      createdAt: '2026-05-01T10:00:00.000Z',
      createdBy: 'user_2abc123def456',
      updatedAt: lastModifiedHeader,
      updatedBy: 'user_2abc123def456',
      deletedAt: null,
      deletedBy: null,
      archivedStatusBefore: null,
    };
    let patchCount = 0;

    await page.route('**/projects**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const isApiPath = path.startsWith('/api/') || path.startsWith('/__fixtures/api/');

      if (!isApiPath) {
        await route.fallback();
        return;
      }

      if (request.method() === 'GET' && url.pathname.endsWith(`/projects/${projectId}`)) {
        await route.fulfill({
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(projectResponse),
        });
        return;
      }

      if (request.method() === 'GET' && url.pathname.endsWith('/projects')) {
        await route.fulfill({
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projects: [projectResponse],
            total: 1,
            limit: 20,
            offset: 0,
          }),
        });
        return;
      }

      if (request.method() === 'PATCH' && url.pathname.endsWith(`/projects/${projectId}`)) {
        patchCount += 1;
        const headers = request.headers();
        const ifUnmodifiedSince = headers['if-unmodified-since'];
        expect(ifUnmodifiedSince, 'PATCH must include If-Unmodified-Since header').toBeDefined();

        if (patchCount === 1) {
          expect(ifUnmodifiedSince).toBe(lastModifiedHeader);

          const payload = request.postDataJSON() as Record<string, unknown>;
          Object.assign(projectResponse, payload);

          // Simulate API returning updated last-modified header but body still carries rounded timestamp
          lastModifiedHeader = '2026-05-10T12:05:00.000Z';
          projectResponse.updatedAt = '2026-05-10T12:00:00.000Z';

          await route.fulfill({
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Last-Modified': lastModifiedHeader,
            },
            body: JSON.stringify(projectResponse),
          });
          return;
        }

        expect(ifUnmodifiedSince).toBe(lastModifiedHeader);
        await route.fulfill({
          status: 409,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            error: 'VERSION_CONFLICT',
            message: 'Project was modified by another editor. Please refresh and try again.',
          }),
        });

        projectResponse.goalSummary = 'Server-authoritative summary';
        projectResponse.updatedAt = lastModifiedHeader;
        return;
      }

      await route.fallback();
    });

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await selectSimpleAuthUser(page);

    await page.getByTestId('project-edit-toggle').click();

    const metadataForm = page.getByTestId('project-metadata-form');
    await expect(metadataForm).toBeVisible();

    const nameInput = metadataForm.getByTestId('project-metadata-name');
    const descriptionInput = metadataForm.getByTestId('project-metadata-description');
    const statusSelect = metadataForm.getByTestId('project-metadata-status');
    const goalSummaryInput = metadataForm.getByTestId('project-metadata-goal-summary');
    const submitButton = metadataForm.getByTestId('project-metadata-submit');

    await nameInput.fill('Lifecycle Update Pilot v2');
    await descriptionInput.fill('Updated description via Playwright');
    await statusSelect.selectOption('active');
    await goalSummaryInput.fill('Document TDD update flow');

    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    const successToast = page.getByTestId('project-update-success');
    await expect(successToast).toContainText(/project updated/i);

    await page.getByTestId('project-edit-toggle').click();
    await expect(metadataForm).toBeVisible();

    await goalSummaryInput.fill('Conflicting goal summary');
    await submitButton.click();

    const conflictAlert = page.getByTestId('project-update-conflict');
    await expect(conflictAlert).toBeVisible();
    await expect(conflictAlert).toContainText(/refresh/i);
    await expect(goalSummaryInput).toHaveValue('Server-authoritative summary');
  });
});
