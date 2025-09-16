import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, vi } from 'vitest';

import App from '../../src/App';

vi.mock('@clerk/clerk-react', () => ({
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
  });
});
