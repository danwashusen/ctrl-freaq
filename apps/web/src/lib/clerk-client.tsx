import type { ComponentProps, ReactNode } from 'react';
import * as Clerk from '@clerk/clerk-react';

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

const mockUser: MockUser = {
  id: 'user_e2e_fixture',
  primaryEmailAddress: { emailAddress: 'e2e@ctrl-freaq.test' },
};

const mockAuth: MockAuth = {
  isSignedIn: true,
  getToken: async () => 'mock-token',
};

const MockClerkProvider = ({ children }: { children: ReactNode }) => <>{children}</>;
const MockSignedIn = ({ children }: { children: ReactNode }) => <>{children}</>;
const MockSignedOut = (_: { children: ReactNode }) => null;
const MockRedirectToSignIn = (_: { signInFallbackRedirectUrl?: string }) => null;
const mockUseUser = () => ({ user: mockUser });
const mockUseAuth = () => mockAuth;

type ClerkProviderComponent = typeof Clerk.ClerkProvider;
type SignedInComponent = typeof Clerk.SignedIn;
type SignedOutComponent = typeof Clerk.SignedOut;
type RedirectToSignInComponent = typeof Clerk.RedirectToSignIn;
type UseUserHook = typeof Clerk.useUser;
type UseAuthHook = typeof Clerk.useAuth;
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
const mockUserButton: UserButtonComponent = ((_: UserButtonProps) => null) as UserButtonComponent;
mockUserButton.displayName = 'MockUserButton';

const fallbackUserButton =
  (baseClerk.UserButton as UserButtonComponent | undefined) ?? mockUserButton;

export const UserButton: UserButtonComponent = isE2E ? mockUserButton : fallbackUserButton;
