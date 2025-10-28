import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PROJECTS_QUERY_KEY } from '@/features/projects/constants';
import type { ProjectData, ProjectsListResponse } from '@/lib/api';
const mockNavigate = vi.fn();
const mockGetAll = vi.fn<() => Promise<ProjectsListResponse>>();
const mockCreate = vi.fn();
const emitProjectDashboardHydrationMetric = vi.hoisted(() => vi.fn());
const emitProjectCreateMetric = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/components/sidebar/ProjectsNav', () => ({
  default: (props: { projects?: ProjectData[]; isLoading?: boolean }) => (
    <nav data-testid="projects-nav" data-project-count={props.projects?.length ?? 0}>
      ProjectsNav
    </nav>
  ),
}));

vi.mock('@/lib/auth-provider', () => ({
  useUser: () => ({ user: { firstName: 'Riley' }, isLoaded: true }),
  UserButton: () => <button data-testid="user-button">Account</button>,
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
  });

  afterEach(() => {
    mockNavigate.mockReset();
    mockGetAll.mockReset();
    mockCreate.mockReset();
    emitProjectDashboardHydrationMetric.mockReset();
    emitProjectCreateMetric.mockReset();
    vi.restoreAllMocks();
    window.sessionStorage.clear();
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

    expect(screen.getByText(/loading projects/i)).toBeInTheDocument();

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
    expect(screen.getByText(projectFixture.name)).toBeInTheDocument();
    expect(screen.getByTestId('project-status-badge')).toHaveTextContent(projectFixture.status);
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

    const retryButton = screen.getByRole('button', { name: /try again/i });
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
