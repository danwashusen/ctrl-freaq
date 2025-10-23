import { LoginScreen } from '@/components/simple-auth/LoginScreen';
import { Button } from '@/components/ui/button';
import { triggerDraftLogoutHandlers } from '@/lib/draft-logout-registry';
import { logger } from '@/lib/logger';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'ctrl-freaq.simple-auth.selected-user';
const AUTH_COOKIE_NAME = 'simple_auth_token';

type ApiSimpleAuthUser = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  image_url?: string;
  org_role?: string;
  org_permissions?: string[];
};

export type SimpleAuthUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  orgRole?: string;
  orgPermissions: string[];
};

type SimpleAuthContextValue = {
  users: SimpleAuthUser[];
  selectedUser: SimpleAuthUser | null;
  selectedUserId: string | null;
  isLoading: boolean;
  error: string | null;
  selectUser: (userId: string) => void;
  resetSelection: () => void;
};

const SimpleAuthContext = createContext<SimpleAuthContextValue | null>(null);

const resolveApiBaseUrl = (): string => {
  const configured = import.meta.env?.VITE_API_BASE_URL as string | undefined;
  const fallback = 'http://localhost:5001/api/v1';
  const base = configured && configured.length > 0 ? configured : fallback;
  const normalized = base.replace(/\/+$/, '');
  const withoutApiSegment = normalized.replace(/\/api\/v1$/i, '');
  return withoutApiSegment.length > 0 ? withoutApiSegment : '';
};

const readStoredUserId = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const persistUserId = (userId: string | null): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (userId) {
      window.localStorage.setItem(STORAGE_KEY, userId);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    logger.error(
      'Failed to persist simple auth user selection',
      {},
      error instanceof Error ? error : undefined
    );
  }
};

const writeAuthCookie = (token: string | null): void => {
  if (typeof document === 'undefined') {
    return;
  }
  try {
    if (token) {
      document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; SameSite=Lax`;
    } else {
      document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
  } catch (error) {
    logger.error(
      'Failed to sync simple auth cookie',
      {},
      error instanceof Error ? error : undefined
    );
  }
};

const mapUser = (user: ApiSimpleAuthUser): SimpleAuthUser => ({
  id: user.id,
  email: user.email,
  firstName: user.first_name ?? undefined,
  lastName: user.last_name ?? undefined,
  imageUrl: user.image_url ?? undefined,
  orgRole: user.org_role ?? undefined,
  orgPermissions: Array.isArray(user.org_permissions) ? user.org_permissions : [],
});

const computeDisplayName = (user: SimpleAuthUser): string => {
  if (user.firstName || user.lastName) {
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  }
  return user.email;
};

const useSimpleAuthContext = (): SimpleAuthContextValue => {
  const value = useContext(SimpleAuthContext);
  if (!value) {
    throw new Error('SimpleAuthProvider context is unavailable');
  }
  return value;
};

const SimpleAuthProviderInner = ({ children }: PropsWithChildren<Record<string, unknown>>) => {
  const [users, setUsers] = useState<SimpleAuthUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(() => readStoredUserId());
  const hasLoggedWarning = useRef(false);

  useEffect(() => {
    if (!hasLoggedWarning.current) {
      hasLoggedWarning.current = true;
      logger.warn('Simple auth provider active. This mode is intended for local development only.');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);
      const baseUrl = resolveApiBaseUrl();
      const endpoint = `${baseUrl}/auth/simple/users`;

      try {
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error(`Failed to load simple auth users (${response.status})`);
        }
        const payload = (await response.json()) as { users?: ApiSimpleAuthUser[] };
        const received = Array.isArray(payload.users) ? payload.users : [];
        if (!isMounted) {
          return;
        }
        const mapped = received.map(mapUser);
        setUsers(mapped);

        const storedId = readStoredUserId();
        if (storedId && !mapped.some(user => user.id === storedId)) {
          setSelectedUserId(null);
          persistUserId(null);
          writeAuthCookie(null);
        }
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }
        logger.error(
          'Failed to fetch simple auth users',
          {},
          fetchError instanceof Error ? fetchError : undefined
        );
        setError(
          'Unable to load simple auth users. Check API availability and YAML configuration.'
        );
        setUsers([]);
        setSelectedUserId(null);
        persistUserId(null);
        writeAuthCookie(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void fetchUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectUser = useCallback((userId: string) => {
    setSelectedUserId(userId);
    persistUserId(userId);
    logger.info('Simple auth user selected', { userId });
  }, []);

  const resetSelection = useCallback(() => {
    const previous = selectedUserId;
    setSelectedUserId(null);
    persistUserId(null);
    if (previous) {
      logger.info('Simple auth user selection cleared', { userId: previous });
    }
  }, [selectedUserId]);

  useEffect(() => {
    const token = selectedUserId ? `simple:${selectedUserId}` : null;
    writeAuthCookie(token);
  }, [selectedUserId]);

  const selectedUser = useMemo(
    () => users.find(user => user.id === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  const contextValue = useMemo<SimpleAuthContextValue>(
    () => ({
      users,
      selectedUser,
      selectedUserId,
      isLoading,
      error,
      selectUser,
      resetSelection,
    }),
    [users, selectedUser, selectedUserId, isLoading, error, selectUser, resetSelection]
  );

  return <SimpleAuthContext.Provider value={contextValue}>{children}</SimpleAuthContext.Provider>;
};

export const SimpleAuthProvider = ({ children }: PropsWithChildren<Record<string, unknown>>) => {
  return <SimpleAuthProviderInner>{children}</SimpleAuthProviderInner>;
};

export const SignedIn = ({ children }: { children: ReactNode }) => {
  const { selectedUser, isLoading } = useSimpleAuthContext();

  if (isLoading) {
    return (
      <div className="bg-background flex min-h-screen flex-1 items-center justify-center">
        <span className="text-muted-foreground text-base font-medium">Loading workspace…</span>
      </div>
    );
  }

  if (!selectedUser) {
    return null;
  }

  return <>{children}</>;
};

export const SignedOut = ({ children }: { children?: ReactNode }) => {
  const { users, selectedUserId, isLoading, error, selectUser, resetSelection, selectedUser } =
    useSimpleAuthContext();

  if (selectedUser) {
    return null;
  }

  return (
    <>
      <LoginScreen
        users={users}
        selectedUserId={selectedUserId}
        isLoading={isLoading}
        errorMessage={error}
        onSelect={selectUser}
        onResetSelection={resetSelection}
      />
      {children}
    </>
  );
};

export const RedirectToSignIn = (_: { signInFallbackRedirectUrl?: string }) => {
  const { resetSelection } = useSimpleAuthContext();
  useEffect(() => {
    resetSelection();
  }, [resetSelection]);
  return null;
};

export const useAuth = () => {
  const { selectedUser, isLoading, resetSelection } = useSimpleAuthContext();

  const getToken = useCallback(async () => {
    if (!selectedUser) {
      return null;
    }
    return `simple:${selectedUser.id}`;
  }, [selectedUser]);

  const signOut = useCallback(
    async (_options?: { redirectUrl?: string }) => {
      const currentUserId = selectedUser?.id ?? null;
      if (!currentUserId) {
        return;
      }

      const baseUrl = resolveApiBaseUrl();
      const logoutEndpoint = `${baseUrl}/auth/simple/logout`;

      await triggerDraftLogoutHandlers(currentUserId);

      try {
        const response = await fetch(logoutEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer simple:${currentUserId}`,
          },
          credentials: 'include',
        });

        if (!response.ok && response.status !== 401) {
          logger.warn('Simple auth logout request failed', {
            status: response.status,
            userId: currentUserId,
          });
        }
      } catch (error) {
        logger.error(
          'Failed to call simple auth logout endpoint',
          { userId: currentUserId },
          error instanceof Error ? error : undefined
        );
      } finally {
        resetSelection();
      }
    },
    [resetSelection, selectedUser]
  );

  return useMemo(
    () => ({
      isLoaded: !isLoading,
      isSignedIn: Boolean(selectedUser),
      userId: selectedUser?.id ?? null,
      getToken,
      signOut,
    }),
    [getToken, isLoading, selectedUser, signOut]
  );
};

export const useUser = () => {
  const { selectedUser, isLoading } = useSimpleAuthContext();

  const user = useMemo(() => {
    if (!selectedUser) {
      return null;
    }

    return {
      id: selectedUser.id,
      firstName: selectedUser.firstName ?? null,
      lastName: selectedUser.lastName ?? null,
      fullName: computeDisplayName(selectedUser),
      imageUrl: selectedUser.imageUrl ?? null,
      primaryEmailAddress: {
        emailAddress: selectedUser.email,
      },
    };
  }, [selectedUser]);

  return useMemo(
    () => ({
      isLoaded: !isLoading,
      isSignedIn: Boolean(selectedUser),
      user,
    }),
    [isLoading, selectedUser, user]
  );
};

export const useClerk = () => {
  const auth = useAuth();

  return useMemo(
    () => ({
      signOut: auth.signOut,
    }),
    [auth.signOut]
  );
};

export const UserButton = ({ afterSignOutUrl }: { afterSignOutUrl?: string }) => {
  const auth = useAuth();
  const { user } = useUser();

  const handleSignOut = useCallback(async () => {
    await auth.signOut(afterSignOutUrl ? { redirectUrl: afterSignOutUrl } : undefined);
    if (afterSignOutUrl && typeof window !== 'undefined') {
      window.location.assign(afterSignOutUrl);
    }
  }, [afterSignOutUrl, auth]);

  if (!user) {
    return null;
  }

  const displayName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : (user.firstName ?? user.primaryEmailAddress?.emailAddress ?? user.id);

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-sm">{displayName}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          void handleSignOut();
        }}
      >
        Switch user
      </Button>
    </div>
  );
};
