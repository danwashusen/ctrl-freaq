import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectData } from '@/lib/api';

const {
  mockNavigate,
  mockGetById,
  mockUpdate,
  mockGetAll,
  mockLoadDocument,
  mockResetTemplate,
  mockSetFormValue,
  mockEnqueueExport,
  mockSignOut,
  paramsRef,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetById: vi.fn(),
  mockUpdate: vi.fn(),
  mockGetAll: vi.fn(),
  mockLoadDocument: vi.fn(),
  mockResetTemplate: vi.fn(),
  mockSetFormValue: vi.fn(),
  mockEnqueueExport: vi.fn(),
  mockSignOut: vi.fn(),
  paramsRef: { id: 'project-alpha' } as { id: string },
}));

vi.mock('react-router-dom', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => paramsRef,
    Link: ({ to, children, ...rest }: any) => {
      const href =
        typeof to === 'string'
          ? to
          : typeof to === 'object' && to !== null && 'pathname' in to
            ? ((to.pathname as string) ?? '')
            : '';
      return (
        <a {...rest} href={href}>
          {children}
        </a>
      );
    },
  };
});

vi.mock('../lib/auth-provider', () => ({
  UserButton: () => <button type="button">Account</button>,
  useUser: () => ({
    user: { id: 'user-test', firstName: 'Test' },
    isLoaded: true,
    isSignedIn: true,
  }),
  useAuth: () => ({ signOut: mockSignOut }),
}));

vi.mock('../components/editor/TemplateUpgradeBanner', () => ({
  TemplateUpgradeBanner: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('../components/editor/TemplateValidationGate', () => ({
  TemplateValidationGate: () => null,
}));

vi.mock('../stores/template-store', () => {
  const defaultState = {
    status: 'idle',
    document: null,
    migration: null,
    removedVersion: null,
    error: null,
    errorCode: null,
    upgradeFailure: null,
    sections: [],
    validator: null,
    formValue: {},
    setFormValue: mockSetFormValue,
    loadDocument: mockLoadDocument,
    reset: mockResetTemplate,
  };
  return {
    useTemplateStore: (selector: (state: typeof defaultState) => unknown) => selector(defaultState),
  };
});

vi.mock('../lib/api-context', () => ({
  useApi: () => ({
    projects: {
      getById: mockGetById,
      update: mockUpdate,
      getAll: mockGetAll,
      create: vi.fn(),
      delete: vi.fn(),
      archive: vi.fn(),
      restore: vi.fn(),
    },
    client: {
      enqueueProjectExport: mockEnqueueExport,
    },
  }),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import Project from './Project';

describe('Project page metadata view', () => {
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

  const renderWithProviders = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <Project />
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetById.mockReset();
    mockUpdate.mockReset();
    mockGetAll.mockReset();
    mockLoadDocument.mockReset();
    mockResetTemplate.mockReset();
    mockSetFormValue.mockReset();
    mockEnqueueExport.mockReset();
    mockGetAll.mockResolvedValue({ projects: [projectFixture], total: 1, limit: 20, offset: 0 });
    mockLoadDocument.mockResolvedValue({
      projectId: projectFixture.id,
      status: 'ready',
      document: {
        documentId: 'doc-primary',
        firstSectionId: 'sec-primary',
        title: 'Alpha Architecture',
        lifecycleStatus: 'draft',
        lastModifiedAt: projectFixture.updatedAt,
        template: {
          templateId: 'architecture',
          templateVersion: '1.0.0',
          templateSchemaHash: 'hash-alpha',
        },
      },
      templateDecision: null,
      lastUpdatedAt: projectFixture.updatedAt,
    });
    paramsRef.id = 'project-alpha';
  });

  it('renders project metadata in view mode by default with edit toggle', async () => {
    mockGetById.mockImplementation(() => Promise.resolve(projectFixture));

    renderWithProviders();

    await waitFor(() => expect(mockGetById).toHaveBeenCalled());

    await waitFor(() => expect(screen.getByTestId('project-metadata-view')).toBeInTheDocument());
    expect(screen.queryByTestId('project-metadata-form')).not.toBeInTheDocument();

    expect(screen.getByTestId('project-metadata-view-name')).toHaveTextContent(projectFixture.name);
    expect(screen.getByTestId('project-metadata-view-description')).toHaveTextContent(
      projectFixture.description ?? ''
    );

    const expectedDate = new Date(projectFixture.goalTargetDate as string).toLocaleDateString();
    expect(screen.getByTestId('project-metadata-view-goal-target-date')).toHaveTextContent(
      expectedDate
    );

    expect(screen.getByTestId('project-edit-toggle')).toBeInTheDocument();
  });

  it('exposes the open document workflow as an accessible link-wrapped card', async () => {
    mockGetById.mockResolvedValue(projectFixture);

    renderWithProviders();

    await waitFor(() => expect(mockLoadDocument).toHaveBeenCalled());

    const workflowCard = await screen.findByTestId('project-workflow-open-document');
    const link = within(workflowCard).getByRole('link', { name: /open project document/i });

    expect(link).toHaveAttribute('href', '/documents/doc-primary/sections/sec-primary');
    expect(link).toHaveAttribute('aria-disabled', 'false');
    expect(link).toHaveAttribute('tabIndex', '0');
  });

  it('marks the open document workflow link as disabled when no document is available', async () => {
    mockGetById.mockResolvedValue(projectFixture);
    mockLoadDocument.mockResolvedValue({
      projectId: projectFixture.id,
      status: 'missing',
      document: null,
      templateDecision: null,
      lastUpdatedAt: projectFixture.updatedAt,
    });

    renderWithProviders();

    await waitFor(() => expect(mockLoadDocument).toHaveBeenCalled());

    const workflowCard = await screen.findByTestId('project-workflow-open-document');
    const link = within(workflowCard).getByRole('link', { name: /open project document/i });

    expect(link).toHaveAttribute('href', '.');
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('tabIndex', '-1');
  });

  it('enters edit mode on request and wires autocomplete hints', async () => {
    mockGetById.mockImplementation(() => Promise.resolve(projectFixture));

    renderWithProviders();

    await screen.findByTestId('project-metadata-view');

    await userEvent.click(screen.getByTestId('project-edit-toggle'));

    const form = await screen.findByTestId('project-metadata-form');
    expect(form).toBeInTheDocument();
    expect(screen.queryByTestId('project-metadata-view')).not.toBeInTheDocument();

    const nameInput = screen.getByTestId('project-metadata-name') as HTMLInputElement;
    const descriptionInput = screen.getByTestId(
      'project-metadata-description'
    ) as HTMLTextAreaElement;
    const goalSummaryInput = screen.getByTestId(
      'project-metadata-goal-summary'
    ) as HTMLInputElement;
    const goalDateInput = screen.getByTestId(
      'project-metadata-goal-target-date'
    ) as HTMLInputElement;

    expect(nameInput).toHaveAttribute('autocomplete', 'off');
    expect(nameInput).toHaveAttribute('name', 'project-name');

    expect(descriptionInput).toHaveAttribute('autocomplete', 'off');
    expect(descriptionInput).toHaveAttribute('name', 'project-description');

    expect(goalSummaryInput).toHaveAttribute('autocomplete', 'off');
    expect(goalSummaryInput).toHaveAttribute('name', 'project-goal-summary');
    expect(goalSummaryInput.maxLength).toBe(280);

    expect(goalDateInput).toHaveAttribute('autocomplete', 'off');
    expect(goalDateInput).toHaveAttribute('name', 'project-goal-target-date');

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.getByTestId('project-metadata-view')).toBeInTheDocument());
    expect(screen.queryByTestId('project-metadata-form')).not.toBeInTheDocument();
  });

  it('sets metadata name input maxLength to the spec limit', async () => {
    mockGetById.mockResolvedValue(projectFixture);

    renderWithProviders();

    await screen.findByTestId('project-metadata-view');
    await userEvent.click(screen.getByTestId('project-edit-toggle'));

    const nameInput = (await screen.findByTestId('project-metadata-name')) as HTMLInputElement;
    expect(nameInput).toHaveAttribute('maxLength', '120');
  });

  it('displays goal target date without timezone drift in metadata view', async () => {
    const GOAL_DATE = '2025-10-30';
    const shiftMs = 12 * 60 * 60 * 1000;
    const originalToLocale = Date.prototype.toLocaleDateString;
    const localeSpy = vi
      .spyOn(Date.prototype, 'toLocaleDateString')
      .mockImplementation(function mockLocale(this: Date, ...args) {
        const shiftedInstance = new Date(this.getTime() - shiftMs);
        return originalToLocale.apply(shiftedInstance, args);
      });

    try {
      const expectedDisplay = new Intl.DateTimeFormat(undefined, {
        timeZone: 'UTC',
      }).format(new Date(`${GOAL_DATE}T00:00:00.000Z`));

      mockGetById.mockResolvedValue({
        ...projectFixture,
        goalTargetDate: GOAL_DATE,
      });

      renderWithProviders();

      await waitFor(() => expect(mockGetById).toHaveBeenCalled());

      expect(screen.getByTestId('project-metadata-view-goal-target-date')).toHaveTextContent(
        expectedDisplay
      );
    } finally {
      localeSpy.mockRestore();
    }
  });

  it('returns to view mode after a successful metadata save', async () => {
    mockGetById.mockResolvedValue(projectFixture);
    const updatedProject: ProjectData = {
      ...projectFixture,
      updatedAt: '2026-05-02T18:00:00.000Z',
    };
    mockUpdate.mockResolvedValue(updatedProject);

    renderWithProviders();

    await screen.findByTestId('project-metadata-view');
    await userEvent.click(screen.getByTestId('project-edit-toggle'));

    const form = await screen.findByTestId('project-metadata-form');
    expect(form).toBeInTheDocument();
    const formUtils = within(form);

    const submitButton = formUtils.getByTestId('project-metadata-submit');
    await userEvent.click(submitButton);

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const [projectId, payload, options] = mockUpdate.mock.calls[0] ?? [];
    expect(projectId).toBe(projectFixture.id);
    expect(options).toMatchObject({ ifUnmodifiedSince: projectFixture.updatedAt });
    expect(payload).toMatchObject({
      name: projectFixture.name,
      description: projectFixture.description,
      status: projectFixture.status,
    });

    await waitFor(() => expect(screen.getByTestId('project-metadata-view')).toBeInTheDocument());
    expect(screen.queryByTestId('project-metadata-form')).not.toBeInTheDocument();
    const formattedStatus =
      updatedProject.status.charAt(0).toUpperCase() + updatedProject.status.slice(1);
    await waitFor(() =>
      expect(screen.getByTestId('project-metadata-view-status')).toHaveTextContent(formattedStatus)
    );
  });

  it('hides edit toggle for archived projects', async () => {
    mockGetById.mockImplementation(() =>
      Promise.resolve({
        ...projectFixture,
        status: 'archived',
        deletedAt: '2026-08-01T00:00:00.000Z',
      })
    );

    renderWithProviders();

    await screen.findByTestId('project-metadata-view');
    expect(screen.queryByTestId('project-edit-toggle')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('project-metadata-view-status')).toHaveTextContent('Archived')
    );
  });

  it('enqueues a project export and surfaces queued status feedback', async () => {
    mockGetById.mockResolvedValue(projectFixture);
    const requestedAt = '2026-05-02T16:00:00.000Z';
    mockEnqueueExport.mockResolvedValue({
      jobId: 'job-export-1',
      projectId: projectFixture.id,
      status: 'queued',
      format: 'markdown',
      scope: 'primary_document',
      requestedBy: 'user-test',
      requestedAt,
      artifactUrl: null,
      errorMessage: null,
      completedAt: null,
    });

    renderWithProviders();

    const exportCard = await screen.findByTestId('project-workflow-export');
    const exportButton = within(exportCard).getByRole('button', { name: /export project/i });
    await userEvent.click(exportButton);

    await waitFor(() =>
      expect(mockEnqueueExport).toHaveBeenCalledWith(projectFixture.id, expect.any(Object))
    );

    expect(within(exportCard).getByText(/queued/i)).toBeInTheDocument();
    expect(within(exportCard).getByTestId('project-workflow-export-description')).toHaveTextContent(
      /Export request submitted/i
    );
  });

  it('displays export error state when enqueue fails with conflict', async () => {
    mockGetById.mockResolvedValue(projectFixture);
    const conflictError = Object.assign(new Error('Export already running'), { status: 409 });
    mockEnqueueExport.mockRejectedValue(conflictError);

    renderWithProviders();

    const exportCard = await screen.findByTestId('project-workflow-export');
    const exportButton = within(exportCard).getByRole('button', { name: /export project/i });
    await userEvent.click(exportButton);

    await waitFor(() => expect(mockEnqueueExport).toHaveBeenCalled());

    expect(within(exportCard).getByText(/blocked/i)).toBeInTheDocument();
    expect(within(exportCard).getByTestId('project-workflow-export-description')).toHaveTextContent(
      /An export is already in progress/i
    );
  });
});
