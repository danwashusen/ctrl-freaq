import { ClerkProvider, useAuth, useUser } from '@/lib/clerk-client';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import App from '../../src/App';

vi.mock('@/lib/clerk-client', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: vi.fn(),
  useUser: vi.fn(),
  RedirectToSignIn: () => <div data-testid="redirect-sign-in">Redirecting to sign in...</div>,
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UserButton: () => <div data-testid="user-button">User</div>,
}));

describe('Routing: dashboard default redirect', () => {
  test('unauthenticated user sees sign-in redirect', async () => {
    vi.mocked(useAuth).mockReturnValue({ isSignedIn: false, isLoaded: true } as any);
    vi.mocked(useUser).mockReturnValue({ isLoaded: true, user: null } as any);

    render(
      <ClerkProvider publishableKey="pk_test_mock">
        <App />
      </ClerkProvider>
    );

    expect(screen.getByTestId('redirect-sign-in')).toBeInTheDocument();
  });

  test('authenticated user at "/" is redirected to "/dashboard"', async () => {
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

      if (pathname.endsWith('/dashboard')) {
        return new Response(
          JSON.stringify({
            data: {
              projects: [],
              activities: [],
              stats: { totalProjects: 0, recentActivityCount: 0 },
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

      if (pathname.endsWith('/projects')) {
        return new Response(JSON.stringify({ projects: [], total: 0 }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'x-request-id': 'test-request',
          },
        });
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

    await waitFor(() => {
      // The Dashboard page currently renders a welcome message
      expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      // Ensure the projects fetch lifecycle has finished before cleanup runs
      expect(screen.queryByText(/Loading projects/i)).not.toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalled();

    vi.unstubAllGlobals();
    global.fetch = originalFetch;
  });
});
