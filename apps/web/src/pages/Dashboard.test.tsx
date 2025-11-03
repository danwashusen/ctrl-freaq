import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ProjectsNav from '@/components/sidebar/ProjectsNav';
import { PROJECTS_QUERY_KEY } from '@/features/projects/constants';
import type { ProjectData, ProjectsListResponse } from '@/lib/api';
import { useProjectStore } from '@/stores/project-store';
const mockNavigate = vi.fn();
const mockGetAll = vi.fn<() => Promise<ProjectsListResponse>>();
const mockCreate = vi.fn();
const mockSignOut = vi.fn();
const emitProjectDashboardHydrationMetric = vi.hoisted(() => vi.fn());
const emitProjectCreateMetric = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const createMatchMediaMock = () =>
  vi.fn().mockImplementation((query: string) => ({
    matches: query === '(min-width: 1024px)',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

vi.mock('@/lib/auth-provider', () => ({
  useUser: () => ({ user: { firstName: 'Riley' }, isLoaded: true }),
  useAuth: () => ({ signOut: mockSignOut }),
  UserButton: () => <button>Account</button>,
}));

vi.mock('@/lib/api-context', () => ({
  useApi: () => ({
    projects: {
      getAll: mockGetAll,
      create: mockCreate,
      getById: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      archive: vi.fn(),
      restore: vi.fn(),
    },
  }),
}));

vi.mock('@/lib/telemetry/client-events', () => ({
  emitProjectDashboardHydrationMetric,
  emitProjectCreateMetric,
}));

import Dashboard from './Dashboard';

describe('Dashboard', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'scrollTo', {
      writable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMediaMock(),
    });
  });

  afterEach(() => {
    mockNavigate.mockReset();
    mockGetAll.mockReset();
    mockCreate.mockReset();
    mockSignOut.mockReset();
    emitProjectDashboardHydrationMetric.mockReset();
    emitProjectCreateMetric.mockReset();
    window.sessionStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: createMatchMediaMock(),
    });
  });

  const renderWithClient = (client: QueryClient) =>
    render(
      <QueryClientProvider client={client}>
        <Dashboard />
      </QueryClientProvider>
    );

  const projectFixture: ProjectData = {
    id: 'project-alpha',
    ownerUserId: 'user-01',
    name: 'Alpha Expansion',
    slug: 'alpha-expansion',
    description: 'Expand alpha footprint',
    visibility: 'workspace',
    status: 'draft',
    goalTargetDate: '2026-07-01',
    goalSummary: 'Hit alpha goals',
    createdAt: '2026-05-01T10:00:00.000Z',
    createdBy: 'user-01',
    updatedAt: '2026-05-02T15:30:00.000Z',
    updatedBy: 'user-01',
    deletedAt: null,
    deletedBy: null,
    archivedStatusBefore: null,
  };

  it('renders lifecycle summaries from TanStack Query project list', async () => {
    let resolveList: ((value: ProjectsListResponse) => void) | undefined;
    mockGetAll.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveList = resolve;
        })
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderWithClient(queryClient);

    const loadingIndicators = screen.getAllByText(/loading projects/i);
    expect(loadingIndicators.length).toBeGreaterThan(0);

    resolveList?.({
      projects: [projectFixture],
      total: 1,
      limit: 20,
      offset: 0,
    });

    await waitFor(() => expect(screen.getByTestId('project-card')).toBeInTheDocument());

    expect(mockGetAll).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Total Projects')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    const projectCard = screen.getByTestId('project-card');
    expect(
      within(projectCard).getByRole('heading', { name: projectFixture.name, level: 3 })
    ).toBeInTheDocument();
    const statusLabel =
      projectFixture.status.charAt(0).toUpperCase() + projectFixture.status.slice(1);
    expect(screen.getByTestId('project-status-badge')).toHaveTextContent(statusLabel);
    expect(screen.getByTestId('project-visibility')).toHaveTextContent(projectFixture.visibility);
    expect(screen.getByTestId('project-goal-target-date')).toHaveTextContent('Jul 1');
  });

  it('retains prior project data and surfaces retry messaging when refetch fails', async () => {
    mockGetAll.mockResolvedValue({
      projects: [projectFixture],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderWithClient(queryClient);

    await waitFor(() => expect(screen.getByTestId('project-card')).toBeInTheDocument());

    mockGetAll.mockRejectedValueOnce(new Error('upstream unavailable'));

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: PROJECTS_QUERY_KEY, type: 'active' });
    });

    expect(screen.getByTestId('project-card')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('projects-refetch-error')).toHaveTextContent(
        /failed to refresh projects/i
      )
    );

    const retryButton = within(screen.getByTestId('projects-refetch-error')).getByRole('button', {
      name: /try again/i,
    });
    await userEvent.click(retryButton);
    expect(mockGetAll).toHaveBeenCalled();
  });

  it('emits dashboard hydration telemetry when projects load', async () => {
    mockGetAll.mockResolvedValueOnce({
      projects: [projectFixture],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const nowSequence = [50, 100, 460];
    const perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowSequence.shift() ?? 0);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderWithClient(queryClient);

    await waitFor(() => expect(screen.getByTestId('project-card')).toBeInTheDocument());

    await waitFor(() => expect(emitProjectDashboardHydrationMetric).toHaveBeenCalled());

    const lastCallIndex = emitProjectDashboardHydrationMetric.mock.calls.length - 1;
    const payload =
      lastCallIndex >= 0
        ? emitProjectDashboardHydrationMetric.mock.calls[lastCallIndex]?.[0]
        : undefined;
    expect(payload?.projectCount).toBe(1);
    expect(payload?.includeArchived).toBe(false);
    expect(payload?.durationMs).toBeGreaterThanOrEqual(0);
    expect([undefined, '']).toContain(payload?.search);

    perfSpy.mockRestore();
  });

  it('wraps dashboard content in shell landmarks with shell styling applied', async () => {
    mockGetAll.mockResolvedValueOnce({
      projects: [projectFixture],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderWithClient(queryClient);

    await screen.findByTestId('project-card');

    const shell = await screen.findByTestId('dashboard-shell');
    const banner = within(shell).getByRole('banner');
    const navigation = within(shell).getByRole('navigation');
    const main = within(shell).getByRole('main');

    expect(shell).toContainElement(banner);
    expect(shell).toContainElement(navigation);
    expect(shell).toContainElement(main);

    expect(within(banner).getByText('CTRL FreaQ')).toBeInTheDocument();
    const subtitle = within(banner).getByTestId('dashboard-shell-subtitle');
    expect(subtitle).toHaveTextContent('AI-Optimized Documentation System');
    expect(within(banner).getByTestId('dashboard-product-mark')).toBeInTheDocument();
    expect(within(banner).getByTestId('dashboard-shell-header-gradient')).toBeInTheDocument();
    expect(within(banner).getByTestId('dashboard-shell-collapse-button')).toHaveAttribute(
      'data-collapsed',
      'false'
    );
    expect(within(banner).getByRole('button', { name: /settings/i })).toBeInTheDocument();
    expect(within(banner).getByTestId('user-button')).toBeInTheDocument();

    const sidebar = within(shell).getByTestId('dashboard-shell-sidebar');
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    expect(within(sidebar).getByTestId('dashboard-shell-sidebar-gradient')).toBeInTheDocument();
  });

  it('keeps header content flush with viewport gutters on large screens', async () => {
    mockGetAll.mockResolvedValueOnce({
      projects: [projectFixture],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderWithClient(queryClient);

    await screen.findByTestId('project-card');

    const shell = await screen.findByTestId('dashboard-shell');
    const banner = within(shell).getByRole('banner');
    const headerInner = within(banner).getByTestId('dashboard-shell-header-inner');

    expect(headerInner.className).not.toContain('mx-auto');
    expect(headerInner.className).not.toContain('max-w-7xl');
    expect(headerInner.className).toContain('px-[var(--dashboard-shell-gutter)]');
  });

  it('does not clamp the main content width on large screens', async () => {
    mockGetAll.mockResolvedValueOnce({
      projects: [projectFixture],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderWithClient(queryClient);

    await screen.findByTestId('project-card');

    const shell = await screen.findByTestId('dashboard-shell');
    const main = within(shell).getByRole('main');
    const mainInner = within(main).getByTestId('dashboard-shell-main-inner');

    expect(mainInner.className).not.toContain('mx-auto');
    expect(mainInner.className).not.toContain('max-w-7xl');
    expect(mainInner).toHaveStyle({
      paddingInline: 'var(--dashboard-shell-gutter)',
      paddingBlock: 'var(--dashboard-shell-padding-y)',
    });
  });

  it('allows collapsing the desktop sidebar via the header toggle', async () => {
    mockGetAll.mockResolvedValueOnce({
      projects: [projectFixture],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const user = userEvent.setup();

    renderWithClient(queryClient);

    await screen.findByTestId('project-card');

    const collapseButton = await screen.findByTestId('dashboard-shell-collapse-button');
    const sidebar = await screen.findByTestId('dashboard-shell-sidebar');

    expect(useProjectStore.getState().sidebarCollapsed).toBe(false);
    expect(collapseButton).toHaveAttribute('data-collapsed', 'false');
    expect(sidebar).toHaveAttribute('data-collapsed', 'false');

    await user.click(collapseButton);

    await waitFor(() => {
      expect(useProjectStore.getState().sidebarCollapsed).toBe(true);
    });

    await user.click(collapseButton);

    await waitFor(() => {
      expect(useProjectStore.getState().sidebarCollapsed).toBe(false);
    });
  });

  it('preserves metrics cards and filter controls inside the shell main region', async () => {
    mockGetAll.mockResolvedValueOnce({
      projects: [projectFixture],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderWithClient(queryClient);

    await screen.findByTestId('project-card');

    const shell = await screen.findByTestId('dashboard-shell');
    const main = within(shell).getByRole('main');

    expect(within(main).getByText('Total Projects')).toBeVisible();
    expect(within(main).getByText('Documents')).toBeVisible();
    expect(within(main).getByText('Templates')).toBeVisible();
    expect(within(main).getByText('Recent Activity')).toBeVisible();

    expect(within(main).getByTestId('project-list-search-input')).toBeVisible();
    expect(within(main).getByRole('button', { name: /^search$/i })).toBeVisible();
    expect(within(main).getByRole('checkbox', { name: /include archived/i })).toBeVisible();
    expect(within(main).getByText(/manage your documentation projects/i)).toBeVisible();
  });

  it('emits create telemetry when a project is created from the dashboard', async () => {
    mockGetAll.mockResolvedValue({
      projects: [],
      total: 0,
      limit: 20,
      offset: 0,
    });

    const nowSequence = [10, 40, 200, 400, 610];
    const perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowSequence.shift() ?? 0);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderWithClient(queryClient);

    await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(1));
    emitProjectDashboardHydrationMetric.mockClear();

    const createdProject: ProjectData = {
      ...projectFixture,
      id: 'project-new',
      name: 'Project Telemetry',
      slug: 'project-telemetry',
      visibility: 'workspace',
    };

    mockCreate.mockResolvedValueOnce(createdProject);

    const openDialogButton = screen.getByTestId('open-create-project-dialog');
    await userEvent.click(openDialogButton);

    const dialog = screen.getByTestId('create-project-dialog');
    const dialogScope = within(dialog);
    await userEvent.type(dialogScope.getByTestId('create-project-name'), 'Project Telemetry');
    const submitButton = dialogScope.getByTestId('create-project-submit');
    await userEvent.click(submitButton);

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({
        name: 'Project Telemetry',
        visibility: 'workspace',
      })
    );

    await waitFor(() => expect(emitProjectCreateMetric).toHaveBeenCalledTimes(1));

    const metricPayload = emitProjectCreateMetric.mock.calls[0]?.[0];
    expect(metricPayload).toMatchObject({
      result: 'success',
      visibility: 'workspace',
      projectId: 'project-new',
    });
    expect(metricPayload?.durationMs).toBeGreaterThanOrEqual(0);

    perfSpy.mockRestore();
  });
});

describe('ProjectsNav (dashboard sidebar)', () => {
  const buildProject = (overrides: Partial<ProjectData> = {}): ProjectData => ({
    id: 'project-default',
    ownerUserId: 'user-01',
    name: 'Default Project',
    slug: 'default-project',
    description: 'Project description',
    visibility: 'workspace',
    status: 'active',
    goalTargetDate: null,
    goalSummary: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'user-01',
    updatedAt: '2026-01-02T00:00:00.000Z',
    updatedBy: 'user-02',
    deletedAt: null,
    deletedBy: null,
    archivedStatusBefore: null,
    ...overrides,
  });

  const resetProjectStore = () => {
    act(() => {
      useProjectStore.setState({
        sidebarOpen: true,
        sidebarCollapsed: false,
        activeProjectId: null,
        viewMode: 'list',
        lastFocusedTrigger: null,
      });
    });
    useProjectStore.persist?.clearStorage?.();
    window.sessionStorage.clear();
  };

  beforeEach(() => {
    resetProjectStore();
  });

  it('sorts projects alphabetically, highlights the active selection, and updates store on selection', async () => {
    const onProjectSelect = vi.fn();
    const outOfOrderProjects: ProjectData[] = [
      buildProject({ id: 'project-zeta', name: 'Zeta Scope', status: 'paused', slug: 'zeta' }),
      buildProject({
        id: 'project-alpha',
        name: 'Alpha Phase',
        status: 'completed',
        slug: 'alpha',
      }),
      buildProject({
        id: 'project-lira',
        name: 'Lira Initiative',
        status: 'active',
        slug: 'lira',
      }),
    ];

    act(() => {
      useProjectStore.setState(state => ({
        ...state,
        activeProjectId: 'project-lira',
      }));
    });

    const user = userEvent.setup();

    render(
      <ProjectsNav
        projects={outOfOrderProjects}
        onProjectSelect={onProjectSelect}
        isLoading={false}
      />
    );

    const navigation = screen.getByRole('navigation', { name: /dashboard navigation/i });
    const items = within(navigation).getAllByTestId('projects-nav-item');
    const orderedNames = items.map(item =>
      within(item).getByTestId('projects-nav-name').textContent?.trim()
    );

    expect(orderedNames).toEqual(['Alpha Phase', 'Lira Initiative', 'Zeta Scope']);

    const activeItem = items.find(item => item.getAttribute('data-project-id') === 'project-lira');
    expect(activeItem).toBeTruthy();
    expect(activeItem).toHaveAttribute('data-active', 'true');

    const activeButton = within(activeItem!).getByRole('button', { name: /lira initiative/i });
    expect(activeButton).toHaveAttribute('aria-current', 'true');
    expect(activeButton.className).toContain('border-l-2');
    expect(activeButton.className).toContain('font-semibold');
    expect(activeButton.className).toContain('px-2.5');
    expect(activeButton.className).toContain('py-1.5');
    expect(activeButton.className).toContain('gap-2');

    const glyphContainer = within(activeItem!).getByTestId('projects-nav-glyph');
    const glyphIcon = within(glyphContainer).getByTestId('projects-nav-glyph-icon');
    expect(glyphIcon.tagName.toLowerCase()).toBe('svg');
    expect(glyphIcon).toHaveAttribute('aria-hidden', 'true');

    const statusBadge = within(activeItem!).getByTestId('projects-nav-status');
    expect(statusBadge).toHaveAttribute('data-status', 'active');
    expect(statusBadge).toHaveAttribute('aria-label', 'Active');
    expect(statusBadge).toHaveAttribute('title', 'Active');
    expect(statusBadge).toHaveTextContent('');
    expect(within(statusBadge).getByTestId('project-status-badge-icon')).toBeInTheDocument();

    const alphaButton = within(items[0]!).getByRole('button', { name: /alpha phase/i });
    await user.click(alphaButton);

    expect(onProjectSelect).toHaveBeenCalledWith('project-alpha');
    expect(useProjectStore.getState().activeProjectId).toBe('project-alpha');
  });

  it('keeps status badges visible alongside long project names', () => {
    render(
      <ProjectsNav
        projects={[
          buildProject({
            id: 'project-long',
            name: 'Extremely Long Project Name That Should Truncate Gracefully Without Hiding Status',
            status: 'paused',
          }),
        ]}
        isLoading={false}
      />
    );

    const item = screen.getByTestId('projects-nav-item');
    const name = within(item).getByTestId('projects-nav-name');
    const nameContainer = name.parentElement;
    expect(nameContainer?.className).toContain('min-w-0');
    expect(nameContainer?.className).toContain('flex-1');
    expect(nameContainer?.className).not.toContain('overflow-hidden');

    const status = within(item).getByTestId('projects-nav-status');
    const statusContainer = status.parentElement;
    expect(statusContainer?.className).toContain('shrink-0');
    expect(statusContainer?.className).toContain('pl-2');
    expect(statusContainer?.className).toContain('justify-self-end');
  });

  it('renders a dashboard navigation entry before the projects section', async () => {
    const user = userEvent.setup();
    const onDashboardSelect = vi.fn();

    render(
      <ProjectsNav
        projects={[
          buildProject({ id: 'project-1', name: 'Project 1', status: 'active' }),
          buildProject({ id: 'project-2', name: 'Project 2', status: 'draft' }),
        ]}
        isLoading={false}
        onDashboardSelect={onDashboardSelect}
      />
    );

    const navigation = screen.getByRole('navigation', { name: /dashboard navigation/i });
    const dashboardSection = within(navigation).getByTestId('projects-nav-dashboard');
    const projectsHeading = within(navigation).getByRole('heading', { name: /projects/i });
    const dashboardButton = within(dashboardSection).getByRole('button', { name: /dashboard/i });

    expect(dashboardButton).toHaveAttribute('aria-current', 'true');

    await user.click(dashboardButton);

    expect(onDashboardSelect).toHaveBeenCalledTimes(1);

    const listItems = within(navigation).getAllByRole('listitem');
    expect(listItems).toHaveLength(2);
    listItems.forEach(item => {
      expect(item).not.toBe(dashboardSection);
    });
    expect(
      dashboardSection.compareDocumentPosition(projectsHeading) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeGreaterThan(0);
  });

  it('renders condensed rail presentation when the sidebar is collapsed', () => {
    const projects: ProjectData[] = [
      buildProject({ id: 'project-rail', name: 'Rail State', status: 'draft', slug: 'rail' }),
    ];

    render(<ProjectsNav projects={projects} isCollapsed isLoading={false} />);

    const navigation = screen.getByRole('navigation', { name: /dashboard navigation/i });
    expect(navigation).toHaveAttribute('data-collapsed', 'true');

    const item = within(navigation).getByTestId('projects-nav-item');
    const name = within(item).getByTestId('projects-nav-name');
    expect(name).toHaveClass('sr-only');

    const status = within(item).getByTestId('projects-nav-status');
    expect(status).toHaveAttribute('aria-label', 'Draft');
    const statusContainer = status.parentElement;
    expect(statusContainer?.className).toContain('justify-self-end');
    expect(status).toHaveAttribute('title', 'Draft');

    const button = within(item).getByRole('button', { name: /rail state/i });
    expect(button).not.toHaveAttribute('aria-current');

    const glyphContainer = within(item).getByTestId('projects-nav-glyph');
    const glyphIcon = within(glyphContainer).getByTestId('projects-nav-glyph-icon');
    expect(glyphIcon.tagName.toLowerCase()).toBe('svg');
    expect(glyphIcon).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies status token classes for each lifecycle state', () => {
    const projects: ProjectData[] = [
      buildProject({ id: 'draft', name: 'Draft', status: 'draft' }),
      buildProject({ id: 'active', name: 'Active', status: 'active' }),
      buildProject({ id: 'paused', name: 'Paused', status: 'paused' }),
      buildProject({ id: 'completed', name: 'Completed', status: 'completed' }),
      buildProject({ id: 'archived', name: 'Archived', status: 'archived' }),
    ];

    render(<ProjectsNav projects={projects} isLoading={false} />);

    const items = screen.getAllByTestId('projects-nav-item');
    const statuses = items.map(item => within(item).getByTestId('projects-nav-status'));
    const observedStatuses = statuses.map(statusEl => statusEl.getAttribute('data-status'));
    expect(new Set(observedStatuses)).toEqual(new Set(projects.map(project => project.status)));

    const tokenClasses: Record<ProjectData['status'], { bg: string; text: string }> = {
      draft: {
        bg: 'bg-[hsl(var(--dashboard-status-draft-bg))]',
        text: 'text-[hsl(var(--dashboard-status-draft-text))]',
      },
      active: {
        bg: 'bg-[hsl(var(--dashboard-status-active-bg))]',
        text: 'text-[hsl(var(--dashboard-status-active-text))]',
      },
      paused: {
        bg: 'bg-[hsl(var(--dashboard-status-paused-bg))]',
        text: 'text-[hsl(var(--dashboard-status-paused-text))]',
      },
      completed: {
        bg: 'bg-[hsl(var(--dashboard-status-completed-bg))]',
        text: 'text-[hsl(var(--dashboard-status-completed-text))]',
      },
      archived: {
        bg: 'bg-[hsl(var(--dashboard-status-archived-bg))]',
        text: 'text-[hsl(var(--dashboard-status-archived-text))]',
      },
    };

    statuses.forEach(badge => {
      const status = badge.getAttribute('data-status') as ProjectData['status'] | null;
      expect(status).not.toBeNull();
      if (status) {
        const formatted = status.charAt(0).toUpperCase() + status.slice(1);
        expect(badge).toHaveAttribute('aria-label', formatted);
        expect(badge).toHaveAttribute('title', formatted);
        expect(badge).toHaveTextContent('');
        expect(badge.className).toContain(tokenClasses[status].bg);
        expect(badge.className).toContain(tokenClasses[status].text);
      }
    });
  });

  it('renders account footer tile with user metadata and switch handler', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();

    render(
      <ProjectsNav
        projects={[buildProject({ id: 'project', name: 'Account Tile' })]}
        isLoading={false}
        currentUser={{
          name: 'Riley Chen',
          email: 'riley@example.com',
          onSwitchAccount: onSwitch,
        }}
      />
    );

    const footer = screen.getByTestId('projects-nav-account');
    expect(within(footer).getByText('Riley Chen')).toBeInTheDocument();
    expect(within(footer).getByText('riley@example.com')).toBeInTheDocument();

    const switchButton = within(footer).getByRole('button', { name: /switch user/i });
    await user.click(switchButton);

    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it('preserves full project name visibility with tooltip when truncated', () => {
    const longName =
      'Project Name That Is Far Too Long For The Sidebar Layout But Needs Full Visibility';
    const projects: ProjectData[] = [
      buildProject({ id: 'project-tooltip', name: longName, slug: 'tooltip' }),
    ];

    render(<ProjectsNav projects={projects} isLoading={false} />);

    const navigation = screen.getByRole('navigation', { name: /dashboard navigation/i });
    const firstItem = within(navigation).getByTestId('projects-nav-item');
    const nameSpan = within(firstItem).getByTestId('projects-nav-name');

    expect(nameSpan).toHaveClass('truncate');
    expect(nameSpan).toHaveAttribute('title', longName);
  });

  it('renders a loading placeholder while projects are fetching', () => {
    render(<ProjectsNav projects={[]} isLoading />);

    const navigation = screen.getByRole('navigation', { name: /dashboard navigation/i });
    const loadingRow = within(navigation).getByTestId('projects-nav-loading');

    expect(loadingRow).toHaveTextContent(/loading projects/i);
    expect(within(navigation).queryAllByTestId('projects-nav-item')).toHaveLength(0);
  });

  it('renders empty-state messaging with CTA when no projects exist', async () => {
    const user = userEvent.setup();
    const onCreateProject = vi.fn();

    render(
      <ProjectsNav
        projects={[]}
        isLoading={false}
        onCreateProject={onCreateProject}
        hasFiltersApplied={false}
      />
    );

    const navigation = screen.getByRole('navigation', { name: /dashboard navigation/i });
    const emptyRow = within(navigation).getByTestId('projects-nav-empty');
    expect(emptyRow).toHaveTextContent(/no projects yet/i);

    const cta = within(navigation).getByRole('button', { name: /start a project/i });
    expect(cta.className).toContain('bg-[hsl(var(--primary))]');
    expect(cta.className).toContain('text-[hsl(var(--primary-foreground))]');
    await user.click(cta);

    expect(onCreateProject).toHaveBeenCalledTimes(1);
  });

  it('renders error messaging with retry affordance when query fails', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <ProjectsNav
        projects={[]}
        isLoading={false}
        isError
        errorMessage="Upstream unavailable"
        onRetry={onRetry}
      />
    );

    const navigation = screen.getByRole('navigation', { name: /dashboard navigation/i });
    const errorRow = within(navigation).getByTestId('projects-nav-error');

    expect(errorRow).toHaveTextContent(/upstream unavailable/i);

    const retryButton = within(navigation).getByRole('button', { name: /try again/i });
    await user.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('surfaces filter-aware empty state messaging and reset control', async () => {
    const user = userEvent.setup();
    const onResetFilters = vi.fn();
    const onCreateProject = vi.fn();

    render(
      <ProjectsNav
        projects={[]}
        isLoading={false}
        hasFiltersApplied
        searchTerm="Atlas"
        onResetFilters={onResetFilters}
        onCreateProject={onCreateProject}
      />
    );

    const navigation = screen.getByRole('navigation', { name: /dashboard navigation/i });
    const emptyRow = within(navigation).getByTestId('projects-nav-empty');
    expect(emptyRow).toHaveTextContent(/no projects match "atlas"/i);

    const cta = within(navigation).getByRole('button', { name: /start a project/i });
    expect(cta.className).toContain('bg-[hsl(var(--primary))]');
    expect(cta.className).toContain('text-[hsl(var(--primary-foreground))]');

    const resetButton = within(navigation).getByRole('button', { name: /reset filters/i });
    await user.click(resetButton);

    expect(onResetFilters).toHaveBeenCalledTimes(1);
    expect(onCreateProject).not.toHaveBeenCalled();
  });
});
