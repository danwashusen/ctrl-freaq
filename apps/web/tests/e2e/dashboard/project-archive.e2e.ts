import { expect, test } from '@playwright/test';

import type { ProjectData } from '@/lib/api';

import { selectSimpleAuthUser } from '../support/draft-recovery';

test.describe('Dashboard Project Archive and Restore', () => {
  test('archives an active project and restores it from archived view', async ({ page }) => {
    const projectId = 'proj-archive-flow';
    const baseProject: ProjectData = {
      id: projectId,
      ownerUserId: 'user_2abc123def456',
      name: 'Lifecycle Archive Candidate',
      slug: 'lifecycle-archive-candidate',
      description: 'Project slated for archive tests',
      visibility: 'workspace',
      status: 'active',
      goalTargetDate: null,
      goalSummary: null,
      createdAt: '2026-06-01T10:00:00.000Z',
      createdBy: 'user_2abc123def456',
      updatedAt: '2026-06-01T10:00:00.000Z',
      updatedBy: 'user_2abc123def456',
      deletedAt: null,
      deletedBy: null,
      archivedStatusBefore: null,
    };

    let currentProject: ProjectData = { ...baseProject };
    const templateId = 'tmpl-archive-flow';
    const templateVersion = 'v1';
    const documentResponse = {
      document: {
        id: `${projectId}-doc`,
        projectId,
        title: 'Archive Flow Template',
        content: { overview: 'Initial content' },
        templateId,
        templateVersion,
        templateSchemaHash: 'hash-v1',
      },
      migration: null,
      templateDecision: {
        action: 'noop',
        reason: 'up_to_date',
        currentVersion: {
          templateId,
          version: templateVersion,
          schemaHash: 'hash-v1',
          status: 'active',
        },
      },
    };
    const templateSections = [
      { id: 'section-overview', title: 'Overview', orderIndex: 1, type: 'text' },
    ];
    const templateSummary = {
      template: {
        id: templateId,
        name: 'Archive Flow Template',
        description: null,
        documentType: 'project',
        status: 'active',
        activeVersion: templateVersion,
        activeVersionMetadata: {
          version: templateVersion,
          schemaHash: 'hash-v1',
          status: 'active',
          changelog: null,
          sections: templateSections,
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    };
    const templateVersionResponse = {
      version: {
        templateId,
        version: templateVersion,
        schemaHash: 'hash-v1',
        schema: { type: 'object', properties: {} },
        sections: templateSections,
      },
    };

    await page.route(`**/documents/${projectId}`, async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(documentResponse),
      });
    });

    await page.route(`**/templates/${templateId}/versions/${templateVersion}`, async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateVersionResponse),
      });
    });

    await page.route(`**/templates/${templateId}`, async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateSummary),
      });
    });

    await page.route(`**/projects/${projectId}/retention`, async route => {
      await route.fulfill({
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'NOT_FOUND' }),
      });
    });

    await page.route('**/activities**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activities: [], total: 0 }),
      });
    });

    await page.route('**/projects**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const isApiPath = path.startsWith('/api/') || path.startsWith('/__fixtures/api/');

      if (!isApiPath) {
        await route.fallback();
        return;
      }

      if (request.method() === 'GET' && path.endsWith('/projects')) {
        const includeArchived = url.searchParams.get('includeArchived') === 'true';
        const payload = currentProject.deletedAt && !includeArchived ? [] : [currentProject];
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projects: payload,
            total: payload.length,
            limit: 20,
            offset: 0,
          }),
        });
        return;
      }

      if (request.method() === 'GET' && path.includes('/projects/config')) {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        return;
      }

      if (request.method() === 'GET' && path.endsWith(`/projects/${projectId}`)) {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentProject),
        });
        return;
      }

      if (request.method() === 'DELETE' && path.endsWith(`/projects/${projectId}`)) {
        const previousStatus = currentProject.status;
        const archivedStatusBefore =
          previousStatus === 'archived'
            ? (currentProject.archivedStatusBefore ?? 'paused')
            : previousStatus;
        currentProject = {
          ...currentProject,
          status: 'archived',
          deletedAt: '2026-06-02T09:00:00.000Z',
          deletedBy: 'user_2abc123def456',
          updatedAt: '2026-06-02T09:00:00.000Z',
          updatedBy: 'user_2abc123def456',
          archivedStatusBefore,
        };
        await route.fulfill({ status: 204 });
        return;
      }

      if (request.method() === 'POST' && path.endsWith(`/projects/${projectId}/restore`)) {
        currentProject = {
          ...currentProject,
          status: 'active',
          deletedAt: null,
          deletedBy: null,
          updatedAt: '2026-06-02T09:05:00.000Z',
          updatedBy: 'user_2abc123def456',
          archivedStatusBefore: null,
        };
        await route.fulfill({
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Last-Modified': currentProject.updatedAt as string,
          },
          body: JSON.stringify(currentProject),
        });
        return;
      }

      await route.fallback();
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await selectSimpleAuthUser(page);

    const projectCard = page
      .getByTestId('project-card')
      .filter({ has: page.getByText('Lifecycle Archive Candidate') });
    await projectCard.waitFor({ state: 'visible' });
    await expect(projectCard.getByTestId('project-status-badge')).toContainText(/active/i);

    const actionsButton = projectCard.getByTestId('project-card-actions');
    await actionsButton.click();

    const archiveTrigger = page.getByTestId('project-card-archive');
    await expect(archiveTrigger).toBeVisible();
    await archiveTrigger.click();

    const archiveConfirmButton = page.getByTestId('archive-project-confirm');
    await expect(archiveConfirmButton).toBeVisible();
    await archiveConfirmButton.click();

    const archiveToast = page.getByTestId('project-archive-success');
    await expect(archiveToast).toContainText(/project archived/i);

    await projectCard.waitFor({ state: 'detached' });

    const showArchivedToggle = page.getByTestId('dashboard-show-archived-toggle');
    await showArchivedToggle.check();
    await page.waitForTimeout(100);

    const archivedCard = page
      .getByTestId('project-card')
      .filter({ has: page.getByText('Lifecycle Archive Candidate') });
    await expect(archivedCard).toBeVisible();
    await expect(archivedCard.getByTestId('project-status-badge')).toContainText(/archived/i);

    const restoreButton = archivedCard.getByTestId('project-restore-action');
    await restoreButton.click();

    const restoreToast = page.getByTestId('project-restore-success');
    await expect(restoreToast).toContainText(/project restored/i);

    await showArchivedToggle.uncheck();
    await page.waitForTimeout(100);
    const restoredCard = page
      .getByTestId('project-card')
      .filter({ has: page.getByText('Lifecycle Archive Candidate') });
    await restoredCard.waitFor({ state: 'visible' });
    await expect(restoredCard.getByTestId('project-status-badge')).toContainText(/active/i);
  });

  test('notifies active project viewers when a project is archived mid-session', async ({
    page,
  }) => {
    const projectId = 'proj-notify-archive';
    let isArchived = false;
    const baseProject: Record<string, unknown> = {
      id: projectId,
      ownerUserId: 'user_2abc123def456',
      name: 'Lifecycle Notify Project',
      slug: 'lifecycle-notify-project',
      description: 'Project used to exercise archive notifications',
      visibility: 'workspace',
      status: 'active',
      goalTargetDate: null,
      goalSummary: null,
      createdAt: '2026-07-01T09:00:00.000Z',
      createdBy: 'user_2abc123def456',
      updatedAt: '2026-07-01T09:00:00.000Z',
      updatedBy: 'user_2abc123def456',
      deletedAt: null,
      deletedBy: null,
      archivedStatusBefore: null,
    };

    const templateId = 'tmpl-notify-flow';
    const templateVersion = 'v1';
    const templateSections = [
      { id: 'section-summary', title: 'Summary', orderIndex: 1, type: 'text' },
    ];
    const documentResponse = {
      document: {
        id: `${projectId}-doc`,
        projectId,
        title: 'Notify Flow Template',
        content: { summary: 'Initial summary' },
        templateId,
        templateVersion,
        templateSchemaHash: 'hash-v1',
      },
      migration: null,
      templateDecision: {
        action: 'noop',
        reason: 'up_to_date',
        currentVersion: {
          templateId,
          version: templateVersion,
          schemaHash: 'hash-v1',
          status: 'active',
        },
      },
    };
    const templateSummary = {
      template: {
        id: templateId,
        name: 'Notify Flow Template',
        description: null,
        documentType: 'project',
        status: 'active',
        activeVersion: templateVersion,
        activeVersionMetadata: {
          version: templateVersion,
          schemaHash: 'hash-v1',
          status: 'active',
          changelog: null,
          sections: templateSections,
        },
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
      },
    };
    const templateVersionResponse = {
      version: {
        templateId,
        version: templateVersion,
        schemaHash: 'hash-v1',
        schema: { type: 'object', properties: {} },
        sections: templateSections,
      },
    };

    await page.route(`**/documents/${projectId}`, async route => {
      if (isArchived) {
        await route.fulfill({
          status: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'NOT_FOUND' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(documentResponse),
      });
    });

    await page.route(`**/templates/${templateId}/versions/${templateVersion}`, async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateVersionResponse),
      });
    });

    await page.route(`**/templates/${templateId}`, async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateSummary),
      });
    });

    await page.route(`**/projects/${projectId}/retention`, async route => {
      await route.fulfill({
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'NOT_FOUND' }),
      });
    });

    await page.route('**/activities**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activities: [], total: 0 }),
      });
    });

    await page.route('**/projects**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const isApiPath = path.startsWith('/api/') || path.startsWith('/__fixtures/api/');

      if (!isApiPath) {
        await route.fallback();
        return;
      }

      if (request.method() === 'GET' && path.endsWith(`/projects/${projectId}`)) {
        if (isArchived) {
          await route.fulfill({
            status: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              error: 'NOT_FOUND',
              message: 'Project not found',
              requestId: 'req-project-archived',
            }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(baseProject),
        });
        return;
      }

      if (request.method() === 'GET' && path.endsWith('/projects')) {
        const includeArchived = url.searchParams.get('includeArchived') === 'true';
        if (isArchived && !includeArchived) {
          await route.fulfill({
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projects: [], total: 0, limit: 20, offset: 0 }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projects: [baseProject],
            total: 1,
            limit: 20,
            offset: 0,
          }),
        });
        return;
      }

      if (request.method() === 'GET' && path.includes('/projects/config')) {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ includeArchived: isArchived }),
        });
        return;
      }

      await route.fallback();
    });

    await page.goto(`/project/${projectId}`);
    await page.waitForLoadState('networkidle');
    await selectSimpleAuthUser(page);

    await page.getByTestId('project-edit-toggle').click();
    await expect(page.getByTestId('project-metadata-form')).toBeVisible();

    // Simulate server archiving the project after viewer has loaded the page
    isArchived = true;

    const notification = page.getByTestId('project-archived-notification');
    await expect(notification).toContainText(/archived while you were viewing/i);

    await page.waitForURL('**/dashboard');
    await expect(page.getByTestId('projects-toast-warning')).toContainText(
      /archived while you were viewing/i
    );
  });
});
