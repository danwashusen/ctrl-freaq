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
  mockSignOut: vi.fn(),
  paramsRef: { id: 'project-alpha' } as { id: string },
}));

vi.mock('react-router-dom', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => paramsRef,
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
    client: {},
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
    mockGetAll.mockResolvedValue({ projects: [projectFixture], total: 1, limit: 20, offset: 0 });
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
});
