import { expect, test } from '@playwright/test';

import type { CreateProjectRequest, ProjectData } from '@/lib/api';

import { selectSimpleAuthUser } from '../support/draft-recovery';

test.describe('Dashboard Project Creation', () => {
  test('creates a project from the dashboard modal and shows lifecycle defaults', async ({
    page,
  }) => {
    const projects: ProjectData[] = [];
    type CreateProjectPayload = Required<
      Pick<
        CreateProjectRequest,
        'name' | 'description' | 'visibility' | 'goalTargetDate' | 'goalSummary'
      >
    >;

    const telemetryLogs: string[] = [];
    page.on('console', message => {
      telemetryLogs.push(message.text());
    });

    const handleProjectsRoute = async (route: import('@playwright/test').Route) => {
      const request = route.request();
      const method = request.method();
      // eslint-disable-next-line no-console -- surface fixture routing during tests
      console.info(`[project-create] ${method} ${request.url()}`);

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            projects,
            total: projects.length,
            limit: 20,
            offset: 0,
          }),
        });
        return;
      }

      if (method === 'POST') {
        const payload = request.postDataJSON() as CreateProjectPayload;

        expect(payload).toMatchObject({
          name: 'Dashboard Flow Project',
          description: 'Created via dashboard lifecycle flow',
          visibility: 'private',
          goalTargetDate: '2026-04-30',
          goalSummary: 'Ship dashboard lifecycle MVP',
        });

        const createdProject: ProjectData = {
          id: 'proj_dashboard_flow',
          ownerUserId: 'user_2abc123def456',
          name: payload.name,
          slug: 'dashboard-flow-project',
          description: payload.description,
          visibility: payload.visibility,
          status: 'draft',
          archivedStatusBefore: null,
          goalTargetDate: payload.goalTargetDate,
          goalSummary: payload.goalSummary,
          createdAt: '2026-04-15T18:45:00.000Z',
          createdBy: 'user_2abc123def456',
          updatedAt: '2026-04-15T18:45:00.000Z',
          updatedBy: 'user_2abc123def456',
          deletedAt: null,
          deletedBy: null,
        };

        projects.unshift(createdProject);

        await route.fulfill({
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            'Last-Modified': createdProject.updatedAt,
          },
          body: JSON.stringify(createdProject),
        });
        return;
      }

      await route.fallback();
    };

    await page.route('**/__fixtures/api/projects**', handleProjectsRoute);
    await page.route('**/__fixtures/api/v1/projects**', handleProjectsRoute);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await selectSimpleAuthUser(page);

    const createButton = page.getByTestId('open-create-project-dialog');
    await expect(createButton).toBeVisible();
    await createButton.click();

    const dialog = page.getByTestId('create-project-dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByTestId('create-project-name').fill('Dashboard Flow Project');
    await dialog
      .getByTestId('create-project-description')
      .fill('Created via dashboard lifecycle flow');
    await dialog.getByTestId('create-project-visibility').selectOption('private');
    await dialog.getByTestId('create-project-goal-target-date').fill('2026-04-30');
    await dialog.getByTestId('create-project-goal-summary').fill('Ship dashboard lifecycle MVP');

    const submitButton = dialog.getByTestId('create-project-submit');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    const toast = page.getByTestId('projects-toast-success');
    await expect(toast).toContainText(/project created/i);

    const projectCard = page
      .getByTestId('project-card')
      .filter({ has: page.getByText('Dashboard Flow Project') });
    await expect(projectCard).toBeVisible();
    await expect(projectCard.getByTestId('project-status-badge')).toContainText(/draft/i);
    await expect(projectCard.getByTestId('project-visibility')).toContainText(/private/i);
    await expect(projectCard.getByTestId('project-goal-target-date')).toContainText('Apr 30');

    const createTelemetryMessages = telemetryLogs.filter(log =>
      log.includes('[projects.telemetry] projects.lifecycle.create')
    );
    expect(createTelemetryMessages.length).toBeGreaterThan(0);
  });
});
