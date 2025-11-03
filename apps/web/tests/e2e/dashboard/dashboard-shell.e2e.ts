import { expect, test } from '@playwright/test';

import { selectSimpleAuthUser } from '../support/draft-recovery';
import { resetFixtureProjectsStore } from '@/lib/api';

const dashboardProjects = [
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
    id: 'project-comet',
    ownerUserId: 'user-02',
    name: 'Comet Expansion',
    slug: 'comet-expansion',
    description: 'Expand Comet to new markets',
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

  const filtered = dashboardProjects.filter(project => {
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

test.describe('Dashboard shell', () => {
  test.beforeEach(async ({ page }) => {
    resetFixtureProjectsStore();
    await page.route('**/api/v1/projects**', fulfillProjectsRequest);
    await page.route('**/__fixtures/api/projects**', fulfillProjectsRequest);
  });

  test('renders persistent header landmarks and preserves dashboard controls', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await selectSimpleAuthUser(page);

    await page.getByTestId('dashboard-shell').waitFor();
    await page.waitForSelector('text=Loading projects…', { state: 'hidden' });

    const banner = page.getByRole('banner');
    await expect(banner.getByText('CTRL FreaQ')).toBeVisible();
    await expect(banner.getByText('AI-Optimized Documentation System')).toBeVisible();
    await expect(banner.getByRole('button', { name: /settings/i })).toBeVisible();
    await expect(page.getByTestId('user-button')).toBeVisible();

    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Total Projects' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Documents' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Templates' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Recent Activity' })).toBeVisible();
    await expect(main.getByTestId('project-list-search-input')).toBeVisible();
    await expect(main.getByRole('checkbox', { name: /include archived/i })).toBeVisible();

    await expect(page.getByRole('navigation', { name: /dashboard navigation/i })).toBeVisible();
  });

  test('manages mobile sidebar focus during toggle interactions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await selectSimpleAuthUser(page);

    const toggle = page.getByTestId('dashboard-shell-toggle');
    await toggle.waitFor();

    await toggle.click();

    const navigation = page.getByRole('navigation', { name: /dashboard navigation/i });
    const dashboardButton = navigation.getByRole('button', { name: /dashboard/i });
    await expect(dashboardButton).toBeVisible();
    await expect(dashboardButton).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
  });
});
