import { ClerkProvider, useAuth, useUser } from '@/lib/clerk-client';
import { render, screen } from '@testing-library/react';
import { describe, test, vi } from 'vitest';

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

    // To be implemented: the page should render an h1 titled "Dashboard"
    expect(screen.getByRole('heading', { name: /dashboard/i, level: 1 })).toBeInTheDocument();

    // And a recent activity empty-state message
    expect(screen.getByText(/No recent activity yet/i)).toBeInTheDocument();
  });
});
