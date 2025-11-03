import { expect, test } from '@playwright/test';

import { selectSimpleAuthUser } from '../support/draft-recovery';
import { resetFixtureProjectsStore } from '@/lib/api';

const sidebarProjects = [
  {
    id: 'project-atlas',
    ownerUserId: 'user-01',
    name: 'Atlas Launch Plan',
    slug: 'atlas-launch-plan',
    description: 'Plan the Atlas product rollout',
    visibility: 'workspace',
    status: 'active',
    goalTargetDate: '2026-01-01T00:00:00.000Z',
    goalSummary: 'Launch Atlas beta',
    createdAt: '2025-12-01T10:00:00.000Z',
    createdBy: 'user-01',
    updatedAt: '2025-12-15T12:00:00.000Z',
    updatedBy: 'user-01',
    deletedAt: null,
    deletedBy: null,
  },
  {
    id: 'project-borealis',
    ownerUserId: 'user-01',
    name: 'Borealis Research',
    slug: 'borealis-research',
    description: 'Research initiative for Borealis',
    visibility: 'workspace',
    status: 'paused',
    goalTargetDate: '2026-03-10T00:00:00.000Z',
    goalSummary: 'Resume research in Q1',
    createdAt: '2025-11-01T10:30:00.000Z',
    createdBy: 'user-01',
    updatedAt: '2025-12-20T12:00:00.000Z',
    updatedBy: 'user-01',
    deletedAt: null,
    deletedBy: null,
  },
  {
    id: 'project-celestia',
    ownerUserId: 'user-02',
    name: 'Celestia Workspace',
    slug: 'celestia-workspace',
    description: 'Expand Celestia reach',
    visibility: 'workspace',
    status: 'draft',
    goalTargetDate: null,
    goalSummary: null,
    createdAt: '2025-10-01T09:00:00.000Z',
    createdBy: 'user-02',
    updatedAt: '2025-12-22T13:00:00.000Z',
    updatedBy: 'user-02',
    deletedAt: null,
    deletedBy: null,
  },
] as const;

const fulfillProjectsRequest = async (
  route: import('@playwright/test').Route,
  projects: typeof sidebarProjects
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

const fulfillProjectDetailRequest = async (
  route: import('@playwright/test').Route,
  projects: typeof sidebarProjects
) => {
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

test.describe('Dashboard Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    resetFixtureProjectsStore();

    await page.route('**/api/v1/projects', route => fulfillProjectsRequest(route, sidebarProjects));
    await page.route('**/__fixtures/api/projects**', route =>
      fulfillProjectsRequest(route, sidebarProjects)
    );
    await page.route('**/api/v1/projects/*', route =>
      fulfillProjectDetailRequest(route, sidebarProjects)
    );
    await page.route('**/__fixtures/api/projects/**', route =>
      fulfillProjectDetailRequest(route, sidebarProjects)
    );
  });

  test('highlights selected project and retains highlight after returning to dashboard', async ({
    page,
  }, testInfo) => {
    test.setTimeout(20000);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await selectSimpleAuthUser(page);

    await page.waitForSelector('text=Loading projects…', { state: 'hidden' });

    const navigation = page.getByRole('navigation', { name: /dashboard navigation/i });
    await navigation.waitFor();

    const dashboardSection = navigation.getByTestId('projects-nav-dashboard');
    await expect(dashboardSection).toBeVisible();
    const projectsHeading = navigation.getByRole('heading', { name: /projects/i });
    const dashboardTag = await dashboardSection.evaluate(element => element.tagName.toLowerCase());
    expect(dashboardTag).not.toBe('li');
    const projectsHeadingHandle = await projectsHeading.elementHandle();
    const dashboardPrecedesProjects = await dashboardSection.evaluate(
      (element, heading) =>
        Boolean(
          heading &&
            (element.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING) > 0
        ),
      projectsHeadingHandle
    );
    expect(dashboardPrecedesProjects).toBe(true);
    await projectsHeadingHandle?.dispose();

    const borealisItem = navigation
      .getByTestId('projects-nav-item')
      .filter({ hasText: 'Borealis Research' })
      .first();
    await expect(borealisItem).toBeVisible();

    const borealisButton = borealisItem.getByRole('button', { name: /borealis research/i });
    await page.evaluate(() => {
      performance.clearMarks('sidebar-navigation:start');
      performance.clearMarks('sidebar-navigation:end');
      performance.clearMeasures('sidebar-navigation');
      performance.mark('sidebar-navigation:start');
    });
    await borealisButton.click();

    await expect(page).toHaveURL(/\/project\/project-borealis/);
    await expect(borealisItem).toHaveAttribute('data-active', 'true');
    await expect(borealisButton).toHaveAttribute('aria-current', 'true');
    await expect(borealisButton).toHaveClass(/border-l-2/);

    const navigationDuration = await page.evaluate(() => {
      performance.mark('sidebar-navigation:end');
      performance.measure(
        'sidebar-navigation',
        'sidebar-navigation:start',
        'sidebar-navigation:end'
      );
      const [entry] = performance.getEntriesByName('sidebar-navigation').slice(-1);
      return entry?.duration ?? null;
    });

    await testInfo.attach('SC-002 sidebar navigation duration', {
      body: `${navigationDuration ?? 'n/a'}ms`,
      contentType: 'text/plain',
    });

    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.waitForSelector('text=Loading projects…', { state: 'hidden' });

    await expect(borealisItem).toHaveAttribute('data-active', 'true');
    const atlasItem = navigation
      .getByTestId('projects-nav-item')
      .filter({ hasText: 'Atlas Launch Plan' })
      .first();
    await expect(atlasItem).not.toHaveAttribute('data-active', 'true');

    expect(navigationDuration).not.toBeNull();
    expect(navigationDuration ?? 0).toBeLessThanOrEqual(2000);
  });
});
