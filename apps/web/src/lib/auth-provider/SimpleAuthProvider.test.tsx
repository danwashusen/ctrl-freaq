import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RedirectToSignIn,
  SignedIn,
  SignedOut,
  SimpleAuthProvider,
  useAuth,
  useUser,
  UserButton,
} from './SimpleAuthProvider';

vi.mock('@/lib/logger', () => {
  const logger = {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    setUserId: vi.fn(),
    setCorrelation: vi.fn(),
  };
  return {
    logger,
    default: logger,
  };
});

vi.mock('@/lib/draft-logout-registry', () => ({
  triggerDraftLogoutHandlers: vi.fn().mockResolvedValue(undefined),
}));

const mockFetch = vi.fn();

const USERS_FIXTURE = [
  {
    id: 'user_alpha',
    email: 'alpha@example.com',
    first_name: 'Alpha',
    last_name: 'Tester',
    image_url: 'https://example.com/alpha.png',
    org_role: 'qa_lead',
  },
  {
    id: 'user_beta',
    email: 'beta@example.com',
  },
];

const successResponse = (body: unknown = {}) => ({
  ok: true,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const getLast = <T,>(items: T[]): T | undefined => {
  return items.length > 0 ? items[items.length - 1] : undefined;
};

beforeEach(() => {
  mockFetch.mockImplementation((input: unknown) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';

    if (url.endsWith('/auth/simple/logout')) {
      return Promise.resolve(successResponse());
    }

    return Promise.resolve(successResponse({ users: USERS_FIXTURE }));
  });
  vi.stubGlobal('fetch', mockFetch);
  window.localStorage.clear();
});

afterEach(() => {
  mockFetch.mockReset();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('SimpleAuthProvider', () => {
  it('renders login screen when no user is selected and signs in when a card is chosen', async () => {
    const authSnapshots: unknown[] = [];
    const userSnapshots: unknown[] = [];

    function AuthObserver() {
      const auth = useAuth();
      const user = useUser();
      authSnapshots.push(auth);
      userSnapshots.push(user);
      return null;
    }

    render(
      <SimpleAuthProvider>
        <AuthObserver />
        <SignedIn>
          <div data-testid="signed-in-content">Signed in!</div>
        </SignedIn>
        <SignedOut>
          <RedirectToSignIn />
        </SignedOut>
      </SimpleAuthProvider>
    );

    expect(await screen.findByText(/Select a Local Test User/i)).toBeInTheDocument();
    const alphaCard = await screen.findByRole('button', { name: /alpha tester/i });
    await userEvent.click(alphaCard);

    await waitFor(() => {
      expect(screen.getByTestId('signed-in-content')).toBeInTheDocument();
    });

    await waitFor(async () => {
      const latestAuth = getLast(authSnapshots) as
        | {
            isSignedIn: boolean;
            getToken: () => Promise<string | null>;
          }
        | undefined;
      if (!latestAuth) {
        throw new Error('Expected auth snapshot to be captured');
      }
      expect(latestAuth.isSignedIn).toBe(true);
      await expect(latestAuth.getToken()).resolves.toBe('simple:user_alpha');

      const latestUser = getLast(userSnapshots) as { user: { id: string } | null } | undefined;
      expect(latestUser?.user?.id).toBe('user_alpha');
    });
  });

  it('restores previously selected user from localStorage', async () => {
    window.localStorage.setItem('ctrl-freaq.simple-auth.selected-user', 'user_beta');

    const userSnapshots: unknown[] = [];
    function UserObserver() {
      const snapshot = useUser();
      userSnapshots.push(snapshot);
      return null;
    }

    render(
      <SimpleAuthProvider>
        <UserObserver />
        <SignedIn>
          <div data-testid="signed-in-content">Signed in!</div>
        </SignedIn>
        <SignedOut>
          <div data-testid="signed-out-content">Signed out</div>
        </SignedOut>
      </SimpleAuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('signed-in-content')).toBeInTheDocument();
    });

    const latestUser = getLast(userSnapshots) as { user: { id: string } | null } | undefined;
    expect(latestUser?.user?.id).toBe('user_beta');
  });

  it('clears stale selections when stored user is missing', async () => {
    window.localStorage.setItem('ctrl-freaq.simple-auth.selected-user', 'missing_user');

    const userSnapshots: unknown[] = [];
    function UserObserver() {
      const snapshot = useUser();
      userSnapshots.push(snapshot);
      return null;
    }

    render(
      <SimpleAuthProvider>
        <UserObserver />
        <SignedIn>
          <div data-testid="signed-in-content">Signed in!</div>
        </SignedIn>
        <SignedOut>
          <div data-testid="signed-out-content">Signed out</div>
        </SignedOut>
      </SimpleAuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('signed-out-content')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(window.localStorage.getItem('ctrl-freaq.simple-auth.selected-user')).toBeNull();
      const latestUser = getLast(userSnapshots) as { user: null } | undefined;
      expect(latestUser?.user).toBeNull();
    });
  });

  it('signs out via the UserButton and triggers draft logout handlers', async () => {
    const { triggerDraftLogoutHandlers } = await import('@/lib/draft-logout-registry');

    render(
      <SimpleAuthProvider>
        <SignedIn>
          <div data-testid="signed-in-content">Signed in</div>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <div data-testid="signed-out-content">Signed out</div>
        </SignedOut>
      </SimpleAuthProvider>
    );

    const alphaCard = await screen.findByRole('button', { name: /alpha tester/i });
    await userEvent.click(alphaCard);

    await waitFor(() => {
      expect(screen.getByTestId('signed-in-content')).toBeInTheDocument();
    });

    const signOutButton = screen.getByRole('button', { name: /switch user/i });
    await userEvent.click(signOutButton);

    await waitFor(() => {
      expect(triggerDraftLogoutHandlers).toHaveBeenCalledWith('user_alpha');
      expect(screen.getByTestId('signed-out-content')).toBeInTheDocument();
      const logoutCall = mockFetch.mock.calls.find(
        ([input]) => typeof input === 'string' && input.endsWith('/auth/simple/logout')
      );
      expect(logoutCall).toBeDefined();
      expect(logoutCall?.[1]).toMatchObject({
        method: 'POST',
      });
    });
  });
});
