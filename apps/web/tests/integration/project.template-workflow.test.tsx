import { useAuth, useUser } from '@clerk/clerk-react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Project from '../../src/pages/Project';
import { ApiProvider } from '../../src/lib/api-context';

type ClerkModule = typeof import('@clerk/clerk-react');

vi.mock('@clerk/clerk-react', () => {
  const UserButtonMock = (() => (
    <div data-testid="user-button">User</div>
  )) as unknown as ClerkModule['UserButton'];
  (UserButtonMock as { displayName?: string }).displayName = 'UserButton';
  return {
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

  it('displays template upgrade success banner when migration succeeded', async () => {
    globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.endsWith('/projects/project-1')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'project-1',
              ownerUserId: 'user_123',
              name: 'Sample Project',
              slug: 'sample-project',
              description: 'Demo project',
              createdAt: '2025-09-16T00:00:00.000Z',
              updatedAt: '2025-09-16T00:00:00.000Z',
            }),
        } as Response);
      }
      if (url.endsWith('/documents/project-1')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
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
            }),
        } as Response);
      }
      if (url.endsWith('/templates/architecture')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
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
            }),
        } as Response);
      }
      if (url.endsWith('/templates/architecture/versions/1.1.0')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
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
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({}),
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
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'project-2',
              ownerUserId: 'user_123',
              name: 'Legacy Project',
              slug: 'legacy-project',
              description: 'Legacy project',
              createdAt: '2025-09-16T00:00:00.000Z',
              updatedAt: '2025-09-16T00:00:00.000Z',
            }),
        } as Response);
      }
      if (url.endsWith('/documents/project-2')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              document: {
                id: 'project-2',
                projectId: 'project-2',
                title: 'Legacy Architecture',
                content: { introduction: 'Legacy content' },
                templateId: 'architecture',
                templateVersion: '0.9.0',
                templateSchemaHash: 'hash-old',
              },
              migration: null,
              templateDecision: {
                action: 'blocked',
                reason: 'removed_version',
                requestedVersion: {
                  templateId: 'architecture',
                  version: '0.9.0',
                  schemaHash: 'hash-old',
                },
              },
            }),
        } as Response);
      }
      if (url.endsWith('/templates/architecture')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
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
            }),
        } as Response);
      }
      if (url.endsWith('/templates/architecture/versions/0.9.0')) {
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: () => Promise.resolve({}),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({}),
      } as Response);
    }) as unknown as typeof fetch;

    renderProject('/project/project-2');

    await waitFor(() => {
      expect(screen.getAllByText('Legacy Project')[0]).toBeInTheDocument();
    });

    expect(screen.getByTestId('template-removed-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('document-editor-form')).not.toBeInTheDocument();
  });
});
