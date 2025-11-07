import { useAuth, useUser } from '@/lib/auth-provider';
import { render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Project from '../../src/pages/Project';
import { ApiProvider } from '../../src/lib/api-context';

type ClerkModule = typeof import('@/lib/auth-provider');

vi.mock('@/lib/auth-provider', () => {
  const UserButtonMock = (() => (
    <div data-testid="user-button">User</div>
  )) as unknown as ClerkModule['UserButton'];
  (UserButtonMock as { displayName?: string }).displayName = 'UserButton';
  return {
    AUTH_PROVIDER: 'clerk' as const,
    useAuth: vi.fn(),
    useUser: vi.fn(),
    UserButton: UserButtonMock,
  } satisfies Partial<ClerkModule>;
});

describe('Project template workflow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      getToken: vi.fn().mockResolvedValue('mock-token'),
    } as any);
    vi.mocked(useUser).mockReturnValue({
      user: {
        id: 'user_123',
        primaryEmailAddress: { emailAddress: 'user@example.com' },
      },
    } as any);
  });

  function renderProject(initialPath: string) {
    const router = createMemoryRouter([{ path: '/project/:id', element: <Project /> }], {
      initialEntries: [initialPath],
    });

    render(
      <ApiProvider baseUrl="http://localhost:5001/api/v1">
        <RouterProvider router={router} />
      </ApiProvider>
    );
  }

  function createSection(documentId: string) {
    const timestamp = '2025-09-16T00:00:00.000Z';
    return {
      id: 'sec-1',
      docId: documentId,
      parentSectionId: null,
      key: 'introduction',
      title: 'Introduction',
      depth: 0,
      orderIndex: 0,
      contentMarkdown: '# Introduction',
      placeholderText: 'Introduction placeholder',
      hasContent: true,
      viewState: 'read_mode',
      editingUser: null,
      lastModified: timestamp,
      status: 'drafting',
      assumptionsResolved: true,
      qualityGateStatus: null,
      approvedVersion: null,
      approvedAt: null,
      approvedBy: null,
      lastSummary: null,
      draftId: null,
      draftVersion: null,
      draftBaseVersion: null,
      latestApprovedVersion: null,
      conflictState: 'clean',
      conflictReason: null,
      summaryNote: null,
      lastSavedAt: timestamp,
      lastSavedBy: 'user_123',
      lastManualSaveAt: Date.parse(timestamp),
    };
  }

  function createSectionsPayload(documentId: string) {
    const section = createSection(documentId);
    return {
      sections: [section],
      toc: {
        documentId,
        sections: [
          {
            sectionId: section.id,
            title: section.title,
            depth: section.depth,
            orderIndex: section.orderIndex,
            hasContent: section.hasContent,
            status: section.status,
            isExpanded: true,
            isActive: true,
            isVisible: true,
            hasUnsavedChanges: false,
            children: [],
            parentId: null,
          },
        ],
        lastUpdated: '2025-09-16T00:00:00.000Z',
      },
    };
  }

  it('displays template upgrade success banner when migration succeeded', async () => {
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.endsWith('/projects/project-1')) {
        const projectPayload = {
          id: 'project-1',
          ownerUserId: 'user_123',
          name: 'Sample Project',
          slug: 'sample-project',
          description: 'Demo project',
          createdAt: '2025-09-16T00:00:00.000Z',
          updatedAt: '2025-09-16T00:00:00.000Z',
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(projectPayload),
          text: () => Promise.resolve(JSON.stringify(projectPayload)),
        } as Response);
      }
      if (url.endsWith('/projects/project-1/documents/primary')) {
        const snapshotPayload = {
          projectId: 'project-1',
          status: 'ready' as const,
          document: {
            documentId: 'project-1',
            firstSectionId: 'sec-1',
            title: 'Architecture Overview',
            lifecycleStatus: 'draft' as const,
            lastModifiedAt: '2025-09-16T00:00:00.000Z',
            template: {
              templateId: 'architecture',
              templateVersion: '1.1.0',
              templateSchemaHash: 'hash-1',
            },
          },
          templateDecision: {
            decisionId: 'decision-1',
            action: 'approved' as const,
            templateId: 'architecture',
            currentVersion: '1.0.0',
            requestedVersion: '1.1.0',
            submittedAt: '2025-09-16T00:00:00.000Z',
            submittedBy: 'user_123',
            notes: null,
          },
          lastUpdatedAt: '2025-09-16T00:00:00.000Z',
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(snapshotPayload),
          text: () => Promise.resolve(JSON.stringify(snapshotPayload)),
        } as Response);
      }
      if (url.endsWith('/documents/project-1')) {
        const documentPayload = {
          document: {
            id: 'project-1',
            projectId: 'project-1',
            title: 'Architecture Overview',
            content: {
              introduction: 'Intro',
              system_overview: {
                tech_stack: 'React',
              },
            },
            templateId: 'architecture',
            templateVersion: '1.1.0',
            templateSchemaHash: 'hash-new',
          },
          migration: {
            id: 'migration-1',
            documentId: 'project-1',
            fromVersion: '1.0.0',
            toVersion: '1.1.0',
            status: 'succeeded',
            validationErrors: null,
            initiatedBy: 'user_123',
            initiatedAt: '2025-09-16T00:01:00.000Z',
            completedAt: '2025-09-16T00:01:02.000Z',
          },
          templateDecision: {
            action: 'upgrade',
            reason: 'out_of_date',
            currentVersion: {
              templateId: 'architecture',
              version: '1.0.0',
              schemaHash: 'hash-old',
              status: 'deprecated',
            },
            targetVersion: {
              templateId: 'architecture',
              version: '1.1.0',
              schemaHash: 'hash-new',
              status: 'active',
            },
          },
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(documentPayload),
          text: () => Promise.resolve(JSON.stringify(documentPayload)),
        } as Response);
      }
      if (url.endsWith('/documents/project-1/sections')) {
        const sectionsPayload = createSectionsPayload('project-1');
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(sectionsPayload),
          text: () => Promise.resolve(JSON.stringify(sectionsPayload)),
        } as Response);
      }
      if (url.endsWith('/templates/architecture')) {
        const templatePayload = {
          template: {
            id: 'architecture',
            name: 'Architecture',
            description: 'Architecture doc template',
            documentType: 'architecture',
            status: 'active',
            activeVersion: '1.1.0',
            activeVersionMetadata: {
              version: '1.1.0',
              schemaHash: 'hash-new',
              status: 'active',
              changelog: null,
              sections: [
                {
                  id: 'introduction',
                  title: 'Introduction',
                  orderIndex: 0,
                  required: true,
                  type: 'markdown',
                  guidance: null,
                  fields: [],
                  children: [],
                },
                {
                  id: 'system_overview',
                  title: 'System Overview',
                  orderIndex: 1,
                  required: true,
                  type: 'object',
                  guidance: null,
                  fields: [],
                  children: [
                    {
                      id: 'tech_stack',
                      title: 'Tech Stack',
                      orderIndex: 0,
                      required: true,
                      type: 'markdown',
                      guidance: null,
                      fields: [],
                      children: [],
                    },
                  ],
                },
              ],
            },
            createdAt: '2025-09-16T00:00:00.000Z',
            updatedAt: '2025-09-16T00:00:00.000Z',
          },
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(templatePayload),
          text: () => Promise.resolve(JSON.stringify(templatePayload)),
        } as Response);
      }
      if (url.endsWith('/templates/architecture/versions/1.1.0')) {
        const versionPayload = {
          version: {
            templateId: 'architecture',
            version: '1.1.0',
            schemaHash: 'hash-new',
            schema: {
              type: 'object',
              properties: {
                introduction: { type: 'string' },
                system_overview: {
                  type: 'object',
                  properties: {
                    tech_stack: { type: 'string' },
                  },
                  required: ['tech_stack'],
                },
              },
              required: ['introduction', 'system_overview'],
            },
            sections: [
              {
                id: 'introduction',
                title: 'Introduction',
                orderIndex: 0,
                required: true,
                type: 'markdown',
                guidance: null,
                fields: [],
                children: [],
              },
              {
                id: 'system_overview',
                title: 'System Overview',
                orderIndex: 1,
                required: true,
                type: 'object',
                guidance: null,
                fields: [],
                children: [
                  {
                    id: 'tech_stack',
                    title: 'Tech Stack',
                    orderIndex: 0,
                    required: true,
                    type: 'markdown',
                    guidance: null,
                    fields: [],
                    children: [],
                  },
                ],
              },
            ],
          },
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(versionPayload),
          text: () => Promise.resolve(JSON.stringify(versionPayload)),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(JSON.stringify({})),
      } as Response);
    }) as unknown as typeof fetch;

    renderProject('/project/project-1');

    await waitFor(() => {
      expect(screen.getAllByText('Sample Project')[0]).toBeInTheDocument();
    });

    expect(screen.getByTestId('template-upgraded-banner')).toBeInTheDocument();
    const errorsList = screen.getByTestId('template-errors');
    expect(within(errorsList).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('displays removed version banner and disables editing when template version missing', async () => {
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.endsWith('/projects/project-2')) {
        const projectPayload = {
          id: 'project-2',
          ownerUserId: 'user_123',
          name: 'Legacy Project',
          slug: 'legacy-project',
          description: 'Legacy project',
          createdAt: '2025-09-16T00:00:00.000Z',
          updatedAt: '2025-09-16T00:00:00.000Z',
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(projectPayload),
          text: () => Promise.resolve(JSON.stringify(projectPayload)),
        } as Response);
      }
      if (url.endsWith('/projects/project-2/documents/primary')) {
        const snapshotPayload = {
          projectId: 'project-2',
          status: 'ready' as const,
          document: {
            documentId: 'project-2',
            firstSectionId: 'sec-1',
            title: 'Legacy Project Document',
            lifecycleStatus: 'draft' as const,
            lastModifiedAt: '2025-09-16T00:00:00.000Z',
            template: {
              templateId: 'architecture',
              templateVersion: '1.0.0',
              templateSchemaHash: 'hash-0',
            },
          },
          templateDecision: null,
          lastUpdatedAt: '2025-09-16T00:00:00.000Z',
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(snapshotPayload),
          text: () => Promise.resolve(JSON.stringify(snapshotPayload)),
        } as Response);
      }
      if (url.endsWith('/documents/project-2')) {
        const removedPayload = {
          error: 'TEMPLATE_VERSION_REMOVED',
          message: 'The referenced template version is no longer available.',
          templateId: 'architecture',
          missingVersion: '0.9.0',
          requestId: 'req_removed',
        };
        return Promise.resolve({
          ok: false,
          status: 409,
          statusText: 'Conflict',
          json: () => Promise.resolve(removedPayload),
          text: () => Promise.resolve(JSON.stringify(removedPayload)),
        } as Response);
      }
      if (url.endsWith('/documents/project-2/sections')) {
        const sectionsPayload = createSectionsPayload('project-2');
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(sectionsPayload),
          text: () => Promise.resolve(JSON.stringify(sectionsPayload)),
        } as Response);
      }
      if (url.endsWith('/templates/architecture')) {
        const templatePayload = {
          template: {
            id: 'architecture',
            name: 'Architecture',
            description: 'Architecture doc template',
            documentType: 'architecture',
            status: 'active',
            activeVersion: '1.1.0',
            activeVersionMetadata: null,
            createdAt: '2025-09-16T00:00:00.000Z',
            updatedAt: '2025-09-16T00:00:00.000Z',
          },
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(templatePayload),
          text: () => Promise.resolve(JSON.stringify(templatePayload)),
        } as Response);
      }
      if (url.endsWith('/templates/architecture/versions/0.9.0')) {
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: () => Promise.resolve({}),
          text: () => Promise.resolve(JSON.stringify({})),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(JSON.stringify({})),
      } as Response);
    }) as unknown as typeof fetch;

    renderProject('/project/project-2');

    await waitFor(() => {
      expect(screen.getAllByText('Legacy Project')[0]).toBeInTheDocument();
    });

    expect(screen.getByTestId('template-removed-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('document-editor-form')).not.toBeInTheDocument();
  });

  it('surfaces auto-upgrade failures when validation middleware returns 422', async () => {
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.endsWith('/projects/project-3')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'project-3',
              ownerUserId: 'user_123',
              name: 'Upgrade Failure Project',
              slug: 'upgrade-failure-project',
              description: 'Auto-upgrade failure scenario',
              createdAt: '2025-09-16T00:00:00.000Z',
              updatedAt: '2025-09-16T00:00:00.000Z',
            }),
          text: () =>
            Promise.resolve(
              JSON.stringify({
                id: 'project-3',
                ownerUserId: 'user_123',
                name: 'Upgrade Failure Project',
                slug: 'upgrade-failure-project',
                description: 'Auto-upgrade failure scenario',
                createdAt: '2025-09-16T00:00:00.000Z',
                updatedAt: '2025-09-16T00:00:00.000Z',
              })
            ),
        } as Response);
      }
      if (url.endsWith('/projects/project-3/documents/primary')) {
        const snapshotPayload = {
          projectId: 'project-3',
          status: 'ready' as const,
          document: {
            documentId: 'project-3',
            firstSectionId: 'sec-1',
            title: 'Upgrade Failure Document',
            lifecycleStatus: 'draft' as const,
            lastModifiedAt: '2025-09-16T00:00:00.000Z',
            template: {
              templateId: 'architecture',
              templateVersion: '1.0.0',
              templateSchemaHash: 'hash-old',
            },
          },
          templateDecision: null,
          lastUpdatedAt: '2025-09-16T00:00:00.000Z',
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(snapshotPayload),
          text: () => Promise.resolve(JSON.stringify(snapshotPayload)),
        } as Response);
      }
      if (url.endsWith('/documents/project-3')) {
        return Promise.resolve({
          ok: false,
          status: 422,
          statusText: 'Unprocessable Entity',
          json: () =>
            Promise.resolve({
              error: 'TEMPLATE_VALIDATION_FAILED',
              message: 'Document content does not satisfy the target template schema',
              requestId: 'req_upgrade_failed',
              details: {
                issues: [
                  {
                    path: ['introduction'],
                    message: 'Executive Summary is required',
                    code: 'required',
                  },
                ],
              },
            }),
          text: () =>
            Promise.resolve(
              JSON.stringify({
                error: 'TEMPLATE_VALIDATION_FAILED',
                message: 'Document content does not satisfy the target template schema',
                requestId: 'req_upgrade_failed',
                details: {
                  issues: [
                    {
                      path: ['introduction'],
                      message: 'Executive Summary is required',
                      code: 'required',
                    },
                  ],
                },
              })
            ),
        } as Response);
      }
      if (url.endsWith('/documents/project-3/sections')) {
        const sectionsPayload = createSectionsPayload('project-3');
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(sectionsPayload),
          text: () => Promise.resolve(JSON.stringify(sectionsPayload)),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(JSON.stringify({})),
      } as Response);
    }) as unknown as typeof fetch;

    renderProject('/project/project-3');

    await waitFor(() => {
      expect(screen.getAllByText('Upgrade Failure Project')[0]).toBeInTheDocument();
    });

    expect(screen.getByTestId('template-upgrade-failed-banner')).toBeInTheDocument();
    expect(screen.getByTestId('template-upgrade-failed-guidance')).toBeInTheDocument();
    expect(screen.getByTestId('template-upgrade-failed-issues')).toHaveTextContent(
      'Executive Summary is required'
    );
    expect(screen.queryByTestId('document-editor-form')).not.toBeInTheDocument();
  });
});
