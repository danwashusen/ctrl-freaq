import { ClerkProvider, useAuth, useUser } from '@/lib/clerk-client';
import { render, screen } from '@testing-library/react';
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

describe('Dashboard layout and empty activity', () => {
  test('renders heading and two columns with empty activity state', async () => {
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

      let payload: unknown;
      switch (true) {
        case pathname.endsWith('/dashboard'):
          payload = {
            data: {
              projects: [],
              activities: [],
              stats: { totalProjects: 0, recentActivityCount: 0 },
            },
          };
          break;
        case pathname.endsWith('/projects'):
          payload = { projects: [], total: 0 };
          break;
        case pathname.endsWith('/activities'):
          payload = { activities: [], total: 0 };
          break;
        default:
          payload = { data: {} };
      }

      return new Response(JSON.stringify(payload), {
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

    // Wait for data-loading paths to resolve before making assertions
    expect(
      await screen.findByRole('heading', { name: /dashboard/i, level: 1 })
    ).toBeInTheDocument();
    expect(await screen.findByText(/No recent activity yet/i)).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalled();

    vi.unstubAllGlobals();
    global.fetch = originalFetch;
  });
});
