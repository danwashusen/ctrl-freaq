import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectData, TemplateValidationDecisionResponse } from '@/lib/api';

const {
  mockNavigate,
  mockGetProject,
  mockLoadDocument,
  mockSetFormValue,
  mockSubmitTemplateDecision,
  paramsRef,
  locationRef,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetProject: vi.fn(),
  mockLoadDocument: vi.fn(),
  mockSetFormValue: vi.fn(),
  mockSubmitTemplateDecision: vi.fn(),
  paramsRef: { id: 'project-template' } as { id: string },
  locationRef: {
    pathname: '/projects/project-template',
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

vi.mock('../../components/editor/TemplateUpgradeBanner', () => ({
  TemplateUpgradeBanner: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('../../components/editor/TemplateValidationGate', () => ({
  TemplateValidationGate: ({
    children,
    onValid,
  }: {
    children: (props: {
      submit: () => void;
      setFieldValue: () => void;
      errors: unknown[];
    }) => ReactNode;
    onValid: (value: unknown) => void;
  }) => {
    const submit = () =>
      onValid({
        introduction: 'Updated executive summary',
      });
    return <>{children({ submit, setFieldValue: () => {}, errors: [] })}</>;
  },
}));

vi.mock('../../lib/auth-provider', () => ({
  UserButton: () => <button type="button">Account</button>,
  useUser: () => ({
    user: { id: 'user-maintainer', firstName: 'Maintainer' },
    isLoaded: true,
    isSignedIn: true,
  }),
  useAuth: () => ({ signOut: vi.fn() }),
}));

vi.mock('../../stores/template-store', () => {
  const templateState = {
    status: 'ready' as const,
    document: {
      id: 'doc-template',
      projectId: 'project-template',
      templateId: 'architecture-reference',
      templateVersion: '1.0.0',
      templateSchemaHash: 'hash-100',
    },
    migration: null,
    removedVersion: null,
    error: null,
    errorCode: null,
    upgradeFailure: null,
    sections: [],
    validator: { safeParse: () => ({ success: true, data: {} }) },
    formValue: {},
    decision: null,
    setFormValue: mockSetFormValue,
    loadDocument: mockLoadDocument,
    reset: vi.fn(),
    provisioningState: 'idle' as const,
  };
  return {
    useTemplateStore: (selector: (state: typeof templateState) => unknown) =>
      selector(templateState),
  };
});

vi.mock('../../lib/api-context', () => ({
  useApi: () => ({
    projects: {
      getById: mockGetProject,
      update: vi.fn(),
      getAll: vi.fn().mockResolvedValue({ projects: [], total: 0, limit: 20, offset: 0 }),
      create: vi.fn(),
      delete: vi.fn(),
      archive: vi.fn(),
      restore: vi.fn(),
    },
    client: {
      enqueueProjectExport: vi.fn(),
      submitTemplateDecision: mockSubmitTemplateDecision,
    },
    eventHub: null,
    eventHubHealth: { status: 'healthy', fallbackActive: false },
    eventHubEnabled: false,
  }),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    clearTemplateContext: vi.fn(),
    setTemplateContext: vi.fn(),
  },
}));

import Project from '../Project';

describe('Project template validation submission', () => {
  const projectFixture: ProjectData = {
    id: 'project-template',
    ownerUserId: 'user-maintainer',
    name: 'Template Review Project',
    slug: 'template-review-project',
    description: 'Project exercising template decision flow.',
    visibility: 'workspace',
    status: 'active',
    archivedStatusBefore: null,
    goalTargetDate: null,
    goalSummary: null,
    createdAt: '2025-10-01T10:00:00.000Z',
    createdBy: 'user-maintainer',
    updatedAt: '2025-10-01T10:00:00.000Z',
    updatedBy: 'user-maintainer',
    deletedAt: null,
    deletedBy: null,
  };

  const renderProject = () => {
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
    mockGetProject.mockReset();
    mockLoadDocument.mockReset();
    mockSetFormValue.mockReset();
    mockSubmitTemplateDecision.mockReset();
    mockGetProject.mockResolvedValue(projectFixture);
    mockLoadDocument.mockResolvedValue({
      projectId: projectFixture.id,
      status: 'ready',
      document: {
        documentId: 'doc-template',
        firstSectionId: 'sec-1',
        title: 'Architecture Reference',
        lifecycleStatus: 'draft',
        lastModifiedAt: projectFixture.updatedAt,
        template: {
          templateId: 'architecture-reference',
          templateVersion: '1.0.0',
          templateSchemaHash: 'hash-100',
        },
      },
      templateDecision: null,
      lastUpdatedAt: projectFixture.updatedAt,
    });
  });

  it('submits template decision and surfaces success feedback', async () => {
    const decisionResponse: TemplateValidationDecisionResponse = {
      decisionId: 'decision-1234-aaaa-bbbb-cccc',
      action: 'approved',
      templateId: 'architecture-reference',
      currentVersion: '1.0.0',
      requestedVersion: '1.0.0',
      submittedAt: '2025-10-02T12:00:00.000Z',
      submittedBy: 'user-maintainer',
      notes: null,
    };

    mockSubmitTemplateDecision.mockResolvedValue(decisionResponse);

    renderProject();

    await waitFor(() => expect(mockGetProject).toHaveBeenCalled());

    const submitButton = await screen.findByRole('button', {
      name: /save changes/i,
    });
    await userEvent.click(submitButton);

    await waitFor(() => expect(mockSubmitTemplateDecision).toHaveBeenCalledTimes(1));

    expect(mockSubmitTemplateDecision).toHaveBeenCalledWith({
      projectId: projectFixture.id,
      templateId: 'architecture-reference',
      documentId: 'doc-template',
      action: 'approved',
      currentVersion: '1.0.0',
      requestedVersion: '1.0.0',
      payload: {
        introduction: 'Updated executive summary',
      },
    });

    await screen.findByText(/template validation recorded/i);
  });

  it('reports template decision submission failures', async () => {
    mockSubmitTemplateDecision.mockRejectedValue(new Error('Upstream unavailable'));

    renderProject();

    await waitFor(() => expect(mockGetProject).toHaveBeenCalled());

    const submitButton = await screen.findByRole('button', {
      name: /save changes/i,
    });
    await userEvent.click(submitButton);

    await waitFor(() => expect(mockSubmitTemplateDecision).toHaveBeenCalledTimes(1));

    await screen.findByText(/upstream unavailable/i);
  });
});
