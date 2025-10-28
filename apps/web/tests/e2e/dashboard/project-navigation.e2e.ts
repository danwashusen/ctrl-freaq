import { expect, test } from '@playwright/test';

import { selectSimpleAuthUser } from '../support/draft-recovery';
import { resetFixtureProjectsStore } from '@/lib/api';

test.describe('Dashboard Project Navigation', () => {
  test.beforeEach(() => {
    resetFixtureProjectsStore();
  });

  test('preserves project list search and scroll state after viewing project details', async ({
    page,
  }) => {
    test.setTimeout(15000);
    const projects = [
      {
        id: 'project-alpha',
        ownerUserId: 'user-01',
        name: 'Alpha Launch Plan',
        slug: 'alpha-launch-plan',
        description: 'Prepare alpha launch milestones',
        visibility: 'workspace',
        status: 'active',
        goalTargetDate: '2026-08-01',
        goalSummary: 'Launch alpha pilot',
        createdAt: '2026-04-01T10:00:00.000Z',
        createdBy: 'user-01',
        updatedAt: '2026-04-15T16:00:00.000Z',
        updatedBy: 'user-01',
        deletedAt: null,
        deletedBy: null,
      },
      {
        id: 'project-bravo',
        ownerUserId: 'user-01',
        name: 'Bravo Scale Initiative',
        slug: 'bravo-scale-initiative',
        description: 'Scale the bravo rollout to additional teams',
        visibility: 'workspace',
        status: 'paused',
        goalTargetDate: '2026-09-10',
        goalSummary: 'Resume bravo rollout in Q3',
        createdAt: '2026-04-02T11:00:00.000Z',
        createdBy: 'user-01',
        updatedAt: '2026-04-20T18:45:00.000Z',
        updatedBy: 'user-01',
        deletedAt: null,
        deletedBy: null,
      },
      {
        id: 'project-charlie',
        ownerUserId: 'user-01',
        name: 'Charlie Sunset',
        slug: 'charlie-sunset',
        description: 'Wind down legacy charlie tooling',
        visibility: 'private',
        status: 'archived',
        goalTargetDate: null,
        goalSummary: null,
        createdAt: '2026-03-20T09:30:00.000Z',
        createdBy: 'user-01',
        updatedAt: '2026-04-05T12:15:00.000Z',
        updatedBy: 'user-01',
        deletedAt: '2026-04-21T08:00:00.000Z',
        deletedBy: 'user-01',
      },
    ];

    const telemetryLogs: string[] = [];
    page.on('console', message => {
      telemetryLogs.push(message.text());
    });

    const fulfillProjectsRequest = async (route: import('@playwright/test').Route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }

      const url = new URL(route.request().url());
      const search = (url.searchParams.get('search') ?? '').toLowerCase();
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const includeArchived = url.searchParams.get('includeArchived') === 'true';

      const filtered = projects.filter(project => {
        const matchesSearch = search.length === 0 || project.name.toLowerCase().includes(search);
        const isArchived = project.deletedAt !== null;
        if (!includeArchived && isArchived) {
          return false;
        }
        return matchesSearch;
      });

      const slice = filtered.slice(offset, offset + limit);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          projects: slice,
          total: filtered.length,
          limit,
          offset,
        }),
      });
    };

    await page.route('**/api/v1/projects', fulfillProjectsRequest);
    await page.route('**/__fixtures/api/projects**', fulfillProjectsRequest);

    const fulfillProjectDetailRequest = async (route: import('@playwright/test').Route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      const id = route.request().url().split('/').pop();
      const project = projects.find(item => item.id === id);
      if (!project) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'NOT_FOUND' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(project),
      });
    };

    await page.route('**/api/v1/projects/*', fulfillProjectDetailRequest);
    await page.route('**/__fixtures/api/projects/**', fulfillProjectDetailRequest);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await selectSimpleAuthUser(page);

    await page.waitForSelector('text=Loading projects…', { state: 'hidden' });
    await expect(page.getByTestId('project-card')).toHaveCount(2);

    const hydrationTelemetryMessages = telemetryLogs.filter(log =>
      log.includes('[projects.telemetry] projects.dashboard.hydration')
    );
    expect(hydrationTelemetryMessages.length).toBeGreaterThan(0);

    const searchInput = page.getByTestId('project-list-search-input');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('Bravo');
    await page.getByRole('button', { name: /^search$/i }).click();

    const targetCard = page
      .getByTestId('project-card')
      .filter({ has: page.getByText('Bravo Scale Initiative') });
    await expect(targetCard).toBeVisible();

    const savedScroll = await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      return window.scrollY;
    });

    await targetCard.click();

    await expect(page).toHaveURL(/\/project\/project-bravo/);

    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(searchInput).toHaveValue('Bravo');
    await expect(
      page.getByTestId('project-card').filter({ has: page.getByText('Bravo Scale Initiative') })
    ).toBeVisible();

    await page.waitForFunction(value => Math.abs(window.scrollY - value) < 5, savedScroll, {
      timeout: 10000,
    });
    const finalScroll = await page.evaluate(() => window.scrollY);
    expect(Math.abs(finalScroll - savedScroll)).toBeLessThan(5);
  });
});
