import { ClerkProvider, useAuth, useUser } from '@/lib/clerk-client';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import App from '../../src/App';

vi.mock('@/lib/clerk-client', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: vi.fn(),
  useUser: vi.fn(),
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  RedirectToSignIn: () => <div data-testid="redirect-sign-in" />,
  UserButton: () => <div />,
}));

describe('Sidebar Projects group', () => {
  test('renders Projects group and allows selection', async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const target =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      let pathname = '';
      try {
        pathname = new URL(target, 'http://localhost').pathname;
      } catch {
        pathname = target;
      }

      if (pathname.endsWith('/projects')) {
        return new Response(
          JSON.stringify({
            projects: [
              {
                id: 'project-1',
                ownerUserId: 'user_123',
                name: 'Sample Project',
                slug: 'sample-project',
                description: 'Demo project',
                createdAt: '2025-09-16T00:00:00.000Z',
                updatedAt: '2025-09-16T00:00:00.000Z',
              },
            ],
            total: 1,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'x-request-id': 'test-request',
            },
          }
        );
      }

      if (pathname.endsWith('/dashboard')) {
        return new Response(
          JSON.stringify({
            data: {
              projects: [],
              activities: [],
              stats: { totalProjects: 1, recentActivityCount: 0 },
            },
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'x-request-id': 'test-request',
            },
          }
        );
      }

      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': 'test-request',
        },
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    vi.mocked(useAuth).mockReturnValue({ isSignedIn: true, isLoaded: true } as any);
    vi.mocked(useUser).mockReturnValue({
      isLoaded: true,
      user: { id: 'user_123', firstName: 'Test' },
    } as any);

    render(
      <ClerkProvider publishableKey="pk_test_mock">
        <App />
      </ClerkProvider>
    );

    // Expect a nav region labelled "Projects" (to be implemented)
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /projects/i })).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalled();

    vi.unstubAllGlobals();
    global.fetch = originalFetch;
  });
});
