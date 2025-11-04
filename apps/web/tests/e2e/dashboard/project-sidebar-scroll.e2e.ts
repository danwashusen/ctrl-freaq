import { expect, test } from '@playwright/test';

import { selectSimpleAuthUser } from '../support/draft-recovery';
import { resetFixtureProjectsStore } from '@/lib/api';

const generateProjects = (count: number) =>
  Array.from({ length: count }, (_, index) => {
    const numeric = (index + 1).toString().padStart(2, '0');
    return {
      id: `project-${numeric}`,
      ownerUserId: 'user-01',
      name: `Overflow Project ${numeric}`,
      slug: `overflow-project-${numeric}`,
      description: `Overflow project ${numeric} description`,
      visibility: 'workspace',
      status: 'active',
      goalTargetDate: null,
      goalSummary: null,
      createdAt: '2025-12-01T10:00:00.000Z',
      createdBy: 'user-01',
      updatedAt: '2025-12-15T12:00:00.000Z',
      updatedBy: 'user-01',
      deletedAt: null,
      deletedBy: null,
    };
  });

const longListProjects = generateProjects(40);

const fulfillProjectsRequest = async (
  route: import('@playwright/test').Route,
  projects: typeof longListProjects
) => {
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

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      projects: filtered,
      total: filtered.length,
      limit,
      offset,
    }),
  });
};

test.describe('Dashboard Sidebar Scroll Behavior', () => {
  test.beforeEach(async ({ page }) => {
    resetFixtureProjectsStore();

    await page.route('**/api/v1/projects', route =>
      fulfillProjectsRequest(route, longListProjects)
    );
    await page.route('**/__fixtures/api/projects**', route =>
      fulfillProjectsRequest(route, longListProjects)
    );
  });

  test('scrolls long project lists inside sidebar without obscuring shell landmarks', async ({
    page,
  }) => {
    test.setTimeout(20000);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await selectSimpleAuthUser(page);

    await page.waitForSelector('text=Loading projects…', { state: 'hidden' });

    const sidebar = page.getByTestId('dashboard-shell-sidebar');
    await expect(sidebar).toBeVisible();

    const nav = page.getByRole('navigation', { name: /dashboard navigation/i });
    await expect(nav.getByTestId('projects-nav-item')).toHaveCount(longListProjects.length);

    const overflowMetrics = await sidebar.evaluate(element => {
      const style = window.getComputedStyle(element);
      return {
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        overflowY: style.overflowY,
      };
    });

    expect(overflowMetrics.scrollHeight).toBeGreaterThanOrEqual(overflowMetrics.clientHeight);
    expect(['auto', 'scroll']).toContain(overflowMetrics.overflowY);

    const scrolledAmount = await sidebar.evaluate(element => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    });
    expect(scrolledAmount).toBeGreaterThan(0);

    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
  });
});
