import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrimaryDocumentSnapshotResponse, ProjectData } from '@/lib/api';

const {
  mockNavigate,
  mockGetById,
  mockGetAll,
  mockUpdate,
  mockCreateProjectDocument,
  mockLoadDocument,
  mockResetTemplate,
  mockSetFormValue,
  mockLoggerError,
  paramsRef,
  locationRef,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetById: vi.fn(),
  mockGetAll: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreateProjectDocument: vi.fn(),
  mockLoadDocument: vi.fn(),
  mockResetTemplate: vi.fn(),
  mockSetFormValue: vi.fn(),
  mockLoggerError: vi.fn(),
  paramsRef: { id: 'project-missing' } as { id: string },
  locationRef: {
    pathname: '/projects/project-missing',
    search: '',
    hash: '',
    state: undefined as unknown,
    key: 'default',
  },
}));

vi.mock('react-router-dom', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  const MockLink = ({ to, children }: { to?: unknown; children?: ReactNode }) => {
    const resolvedHref = typeof to === 'string' && to.length > 0 ? to : '/mock-link';
    return <a href={resolvedHref}>{children}</a>;
  };
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => paramsRef,
    useLocation: () => locationRef,
    Link: MockLink,
    NavLink: MockLink,
  };
});

vi.mock('../../lib/auth-provider', () => ({
  UserButton: () => <button type="button">Account</button>,
  useUser: () => ({
    user: { id: 'user-test', firstName: 'Tester' },
    isLoaded: true,
    isSignedIn: true,
  }),
  useAuth: () => ({ signOut: vi.fn(), getToken: async () => 'token' }),
}));

vi.mock('../../components/editor/TemplateUpgradeBanner', () => ({
  TemplateUpgradeBanner: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('../../components/editor/TemplateValidationGate', () => ({
  TemplateValidationGate: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('../../stores/template-store', () => {
  const defaultState = {
    status: 'idle',
    document: null,
    template: null,
    migration: null,
    validator: null,
    sections: [],
    removedVersion: null,
    error: null,
    errorCode: null,
    upgradeFailure: null,
    formValue: null,
  };

  return {
    useTemplateStore: (
      selector: (
        state: typeof defaultState & {
          loadDocument: typeof mockLoadDocument;
          reset: typeof mockResetTemplate;
          setFormValue: typeof mockSetFormValue;
        }
      ) => unknown
    ) =>
      selector({
        ...defaultState,
        loadDocument: mockLoadDocument,
        reset: mockResetTemplate,
        setFormValue: mockSetFormValue,
      }),
  };
});

const mockEventHub = {
  subscribe: vi.fn(() => () => {}),
  shutdown: vi.fn(),
  getHealthState: vi.fn(() => ({ status: 'healthy' as const, fallbackActive: false })),
  setEnabled: vi.fn(),
  forceReconnect: vi.fn(),
};

vi.mock('../../lib/api-context', () => ({
  useApi: () => ({
    projects: {
      getAll: mockGetAll,
      getById: mockGetById,
      update: mockUpdate,
      create: vi.fn(),
      delete: vi.fn(),
      archive: vi.fn(),
      restore: vi.fn(),
    },
    client: {
      createProjectDocument: mockCreateProjectDocument,
      getPrimaryDocument: vi.fn(),
      getDocument: vi.fn(),
      getTemplate: vi.fn(),
      getTemplateVersion: vi.fn(),
    },
    eventHub: mockEventHub,
    eventHubHealth: { status: 'healthy' as const, fallbackActive: false },
    eventHubEnabled: false,
    setEventHubEnabled: vi.fn(),
  }),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    error: mockLoggerError,
    info: vi.fn(),
  },
}));

import Project from '../Project';

describe('Project create document workflow', () => {
  const projectFixture: ProjectData = {
    id: 'project-missing',
    ownerUserId: 'user-owner',
    name: 'Missing Document Project',
    slug: 'missing-document-project',
    description: null,
    visibility: 'workspace',
    status: 'draft',
    archivedStatusBefore: null,
    goalTargetDate: null,
    goalSummary: null,
    createdAt: '2025-10-01T12:00:00.000Z',
    updatedAt: '2025-10-05T18:30:00.000Z',
    createdBy: 'user-owner',
    updatedBy: 'user-owner',
    deletedAt: null,
    deletedBy: null,
  };

  const missingSnapshot: PrimaryDocumentSnapshotResponse = {
    projectId: projectFixture.id,
    status: 'missing',
    document: null,
    templateDecision: null,
    lastUpdatedAt: projectFixture.updatedAt,
  };

  const renderWithProviders = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <Project />
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    paramsRef.id = projectFixture.id;
    mockGetById.mockResolvedValue(projectFixture);
    mockGetAll.mockResolvedValue({
      projects: [projectFixture],
      total: 1,
      limit: 20,
      offset: 0,
    });
    mockLoadDocument.mockResolvedValue(missingSnapshot);
  });

  it('creates a primary document and navigates to the editor on success', async () => {
    mockCreateProjectDocument.mockResolvedValue({
      status: 'created',
      documentId: 'doc-new-primary',
      projectId: projectFixture.id,
      firstSectionId: 'sec-first',
      lifecycleStatus: 'draft',
      title: 'Architecture Overview',
      template: {
        templateId: 'architecture-reference',
        templateVersion: '2.1.0',
        templateSchemaHash: 'tmpl-architecture-210',
      },
      lastModifiedAt: '2025-10-05T18:35:00.000Z',
    });

    renderWithProviders();

    const createButton = await screen.findByRole('button', { name: /create document/i });
    expect(createButton).toBeEnabled();

    await userEvent.click(createButton);

    expect(mockCreateProjectDocument).toHaveBeenCalledWith(projectFixture.id);
    expect(createButton).toBeDisabled();
    await screen.findByText(/creation in progress/i);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        `/documents/doc-new-primary/sections/sec-first?projectId=${projectFixture.id}`
      )
    );

    expect(createButton).toBeEnabled();
    expect(screen.getByText(/document ready/i)).toBeInTheDocument();
  });

  it('surfaces an error message when provisioning fails', async () => {
    mockCreateProjectDocument.mockRejectedValue(
      Object.assign(new Error('templates unavailable'), {
        status: 503,
        code: 'TEMPLATES_OFFLINE',
      })
    );

    renderWithProviders();

    const createButton = await screen.findByRole('button', { name: /create document/i });
    await userEvent.click(createButton);

    await waitFor(() => expect(screen.getByText(/unable to create document/i)).toBeInTheDocument());
    expect(createButton).toBeEnabled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalled();
  });
});
