import { expect, test } from '@playwright/test';

import { selectSimpleAuthUser } from '../support/draft-recovery';
import { resetFixtureProjectsStore } from '@/lib/api';

const initialProjects = [
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
] as const;

const refreshedProjects = [
  {
    id: 'project-nova',
    ownerUserId: 'user-01',
    name: 'Nova Deployment',
    slug: 'nova-deployment',
    description: 'Deploy the Nova platform',
    visibility: 'workspace',
    status: 'active',
    goalTargetDate: '2026-05-01T00:00:00.000Z',
    goalSummary: 'Ship Nova GA',
    createdAt: '2026-01-11T08:00:00.000Z',
    createdBy: 'user-01',
    updatedAt: '2026-02-18T16:00:00.000Z',
    updatedBy: 'user-02',
    deletedAt: null,
    deletedBy: null,
  },
  {
    id: 'project-orion',
    ownerUserId: 'user-01',
    name: 'Orion Stabilization',
    slug: 'orion-stabilization',
    description: 'Stabilize Orion services',
    visibility: 'workspace',
    status: 'draft',
    goalTargetDate: null,
    goalSummary: null,
    createdAt: '2026-01-15T09:30:00.000Z',
    createdBy: 'user-01',
    updatedAt: '2026-02-21T11:00:00.000Z',
    updatedBy: 'user-01',
    deletedAt: null,
    deletedBy: null,
  },
] as const;

type DashboardProject = (typeof initialProjects | typeof refreshedProjects)[number];
type ProjectsRef = () => ReadonlyArray<DashboardProject>;

const createProjectsHandler =
  (projectsRef: ProjectsRef) => async (route: import('@playwright/test').Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    const url = new URL(route.request().url());
    const search = (url.searchParams.get('search') ?? '').toLowerCase();
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const includeArchived = url.searchParams.get('includeArchived') === 'true';

    const projects = projectsRef();

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

const createProjectDetailHandler =
  (projectsRef: ProjectsRef) => async (route: import('@playwright/test').Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    const projects = projectsRef();
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

test.describe('Dashboard sidebar rehydration after re-auth', () => {
  test.beforeEach(() => {
    resetFixtureProjectsStore();
  });

  test('refetches fresh project list after signing out and back in', async ({ page }) => {
    test.setTimeout(25000);

    let useRefreshedProjects = false;
    const projectsRef = () => (useRefreshedProjects ? refreshedProjects : initialProjects);

    await page.route('**/api/v1/projects', createProjectsHandler(projectsRef));
    await page.route('**/__fixtures/api/projects**', createProjectsHandler(projectsRef));
    await page.route('**/api/v1/projects/*', createProjectDetailHandler(projectsRef));
    await page.route('**/__fixtures/api/projects/**', createProjectDetailHandler(projectsRef));

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await selectSimpleAuthUser(page);

    await page.waitForSelector('text=Loading projects…', { state: 'hidden' });

    const nav = page.getByRole('navigation', { name: /dashboard navigation/i });
    await expect(
      nav.getByTestId('projects-nav-item').filter({ hasText: 'Atlas Launch Plan' })
    ).toHaveCount(1);
    await expect(
      nav.getByTestId('projects-nav-item').filter({ hasText: 'Nova Deployment' })
    ).toHaveCount(0);

    const switchUserButton = page
      .getByTestId('projects-nav-account')
      .getByRole('button', { name: /switch user/i });
    await switchUserButton.click();

    await page.getByRole('heading', { name: /select a local test user/i }).waitFor();

    useRefreshedProjects = true;

    await selectSimpleAuthUser(page);

    await page.waitForSelector('text=Loading projects…', { state: 'hidden' });

    await expect(
      nav.getByTestId('projects-nav-item').filter({ hasText: 'Nova Deployment' })
    ).toHaveCount(1);
    await expect(
      nav.getByTestId('projects-nav-item').filter({ hasText: 'Atlas Launch Plan' })
    ).toHaveCount(0);
  });
});
