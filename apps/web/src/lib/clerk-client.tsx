import type { ComponentProps, ReactNode } from 'react';
import { useCallback } from 'react';
import * as Clerk from '@clerk/clerk-react';

import { triggerDraftLogoutHandlers } from '@/lib/draft-logout-registry';

const isE2E = import.meta.env.VITE_E2E === 'true';

interface MockUser {
  id: string;
  primaryEmailAddress?: {
    emailAddress?: string;
  };
}

interface MockAuth {
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
}

interface MockClerk {
  signOut: (params?: { redirectUrl?: string }) => Promise<void>;
}

const mockUser: MockUser = {
  id: 'user_e2e_fixture',
  primaryEmailAddress: { emailAddress: 'e2e@ctrl-freaq.test' },
};

const mockAuth: MockAuth = {
  isSignedIn: true,
  getToken: async () => 'mock-token',
};

const mockClerk: MockClerk = {
  signOut: async () => undefined,
};

const MockClerkProvider = ({ children }: { children: ReactNode }) => <>{children}</>;
const MockSignedIn = ({ children }: { children: ReactNode }) => <>{children}</>;
const MockSignedOut = (_: { children: ReactNode }) => null;
const MockRedirectToSignIn = (_: { signInFallbackRedirectUrl?: string }) => null;
const mockUseUser = () => ({ user: mockUser });
const mockUseAuth = () => mockAuth;
const mockUseClerk = () => mockClerk;

type ClerkProviderComponent = typeof Clerk.ClerkProvider;
type SignedInComponent = typeof Clerk.SignedIn;
type SignedOutComponent = typeof Clerk.SignedOut;
type RedirectToSignInComponent = typeof Clerk.RedirectToSignIn;
type UseUserHook = typeof Clerk.useUser;
type UseAuthHook = typeof Clerk.useAuth;
type UseClerkHook = typeof Clerk.useClerk;
type UserButtonComponent = typeof Clerk.UserButton;
type UserButtonProps = ComponentProps<UserButtonComponent>;

const baseClerk = Clerk as Partial<typeof Clerk>;

const fallbackClerkProvider =
  (baseClerk.ClerkProvider as ClerkProviderComponent | undefined) ??
  (MockClerkProvider as ClerkProviderComponent);
const fallbackSignedIn =
  (baseClerk.SignedIn as SignedInComponent | undefined) ?? (MockSignedIn as SignedInComponent);
const fallbackSignedOut =
  (baseClerk.SignedOut as SignedOutComponent | undefined) ?? (MockSignedOut as SignedOutComponent);
const fallbackRedirectToSignIn =
  (baseClerk.RedirectToSignIn as RedirectToSignInComponent | undefined) ??
  (MockRedirectToSignIn as RedirectToSignInComponent);
const fallbackUseUser =
  (baseClerk.useUser as UseUserHook | undefined) ?? (mockUseUser as UseUserHook);
const fallbackUseAuth =
  (baseClerk.useAuth as UseAuthHook | undefined) ?? (mockUseAuth as UseAuthHook);
const fallbackUseClerk =
  (baseClerk.useClerk as UseClerkHook | undefined) ?? (mockUseClerk as UseClerkHook);

export const ClerkProvider: ClerkProviderComponent = isE2E
  ? (MockClerkProvider as ClerkProviderComponent)
  : fallbackClerkProvider;
export const SignedIn: SignedInComponent = isE2E
  ? (MockSignedIn as SignedInComponent)
  : fallbackSignedIn;
export const SignedOut: SignedOutComponent = isE2E
  ? (MockSignedOut as SignedOutComponent)
  : fallbackSignedOut;
export const RedirectToSignIn: RedirectToSignInComponent = isE2E
  ? (MockRedirectToSignIn as RedirectToSignInComponent)
  : fallbackRedirectToSignIn;
export const useUser: UseUserHook = isE2E ? (mockUseUser as UseUserHook) : fallbackUseUser;
export const useAuth: UseAuthHook = isE2E ? (mockUseAuth as UseAuthHook) : fallbackUseAuth;
export const useClerk: UseClerkHook = isE2E ? (mockUseClerk as UseClerkHook) : fallbackUseClerk;
const mockUserButton: UserButtonComponent = ((_: UserButtonProps) => null) as UserButtonComponent;
mockUserButton.displayName = 'MockUserButton';

const fallbackUserButton =
  (baseClerk.UserButton as UserButtonComponent | undefined) ?? mockUserButton;

const BaseUserButton = fallbackUserButton;

export const UserButton: UserButtonComponent = isE2E
  ? mockUserButton
  : (((props: UserButtonProps) => {
      const { children, ...restProps } = props;
      const clerk = useClerk();
      const { user } = useUser();

      const authorId = user?.id ?? 'user-local-author';
      const handleSignOut = useCallback(async () => {
        await triggerDraftLogoutHandlers(authorId);
        const redirectUrl =
          typeof props.afterSignOutUrl === 'string' ? props.afterSignOutUrl : undefined;
        await clerk.signOut(redirectUrl ? { redirectUrl } : undefined);
      }, [authorId, clerk, props.afterSignOutUrl]);

      const resolvedChildren = children ?? (
        <BaseUserButton.MenuItems>
          <BaseUserButton.Action label="manageAccount" />
          <BaseUserButton.Action
            label="Sign out"
            labelIcon={null}
            onClick={() => {
              void handleSignOut();
            }}
          />
        </BaseUserButton.MenuItems>
      );

      return <BaseUserButton {...restProps}>{resolvedChildren}</BaseUserButton>;
    }) as UserButtonComponent);
