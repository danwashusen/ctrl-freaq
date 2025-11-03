import { expect, test } from '@playwright/test';

import { resetFixtureProjectsStore } from '@/lib/api';

import { selectSimpleAuthUser } from '../support/draft-recovery';

const fulfillEmptyProjectsRequest = async (route: import('@playwright/test').Route) => {
  if (route.request().method() !== 'GET') {
    await route.fallback();
    return;
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      projects: [],
      total: 0,
      limit: Number(new URL(route.request().url()).searchParams.get('limit') ?? 20),
      offset: Number(new URL(route.request().url()).searchParams.get('offset') ?? 0),
    }),
  });
};

test.describe('Dashboard Sidebar Empty State', () => {
  test.beforeEach(async ({ page }) => {
    resetFixtureProjectsStore();

    const projectRouteMatchers = [
      '**/__fixtures/api/projects**',
      '**/__fixtures/api/v1/projects**',
      '**/api/projects**',
      '**/api/v1/projects**',
    ];

    for (const matcher of projectRouteMatchers) {
      await page.route(matcher, fulfillEmptyProjectsRequest);
    }
  });

  test('surfaces CTA that opens the create dialog when no projects exist', async ({ page }) => {
    test.setTimeout(20000);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await selectSimpleAuthUser(page);

    const navigation = page.getByRole('navigation', { name: /dashboard navigation/i });
    await navigation.waitFor();

    await expect(navigation.getByTestId('projects-nav-empty')).toContainText(/no projects yet/i);

    const cta = navigation.getByRole('button', { name: /start a project/i });
    await expect(cta).toBeVisible();
    await cta.click();

    const dialog = page.getByTestId('create-project-dialog');
    await expect(dialog).toBeVisible();
  });
});
