import type { ComponentProps, ComponentType, PropsWithChildren } from 'react';

import {
  ClerkProvider as ClerkProviderImpl,
  RedirectToSignIn as ClerkRedirectToSignIn,
  SignedIn as ClerkSignedIn,
  SignedOut as ClerkSignedOut,
  UserButton as ClerkUserButton,
  useAuth as useClerkAuth,
  useClerk as useClerkHook,
  useUser as useClerkUser,
} from '../clerk-client';

import {
  RedirectToSignIn as SimpleRedirectToSignIn,
  SignedIn as SimpleSignedIn,
  SignedOut as SimpleSignedOut,
  SimpleAuthProvider,
  useAuth as useSimpleAuth,
  useClerk as useSimpleClerk,
  useUser as useSimpleUser,
  UserButton as SimpleUserButton,
} from './SimpleAuthProvider';

const providerName =
  (import.meta.env?.VITE_AUTH_PROVIDER as string | undefined)?.toLowerCase() ?? 'clerk';

const isSimpleAuthEnabled = providerName === 'simple';

type BaseClerkProviderProps = ComponentProps<typeof ClerkProviderImpl>;
type AuthProviderProps = PropsWithChildren<Partial<BaseClerkProviderProps>>;
type SignedComponent = ComponentType<PropsWithChildren<unknown>>;
type RedirectComponent = ComponentType<{ signInFallbackRedirectUrl?: string }>;
type AuthHook = typeof useSimpleAuth;
type UserHook = typeof useSimpleUser;
type ClerkHook = typeof useSimpleClerk;
type UserButtonComponent = ComponentType<Record<string, unknown>>;

const SimpleProviderWrapper = (props: AuthProviderProps) => <SimpleAuthProvider {...props} />;

const ClerkProviderWrapper = (props: AuthProviderProps) => (
  <ClerkProviderImpl {...(props as BaseClerkProviderProps)} />
);

export const ClerkProvider = (
  isSimpleAuthEnabled ? SimpleProviderWrapper : ClerkProviderWrapper
) as ComponentType<AuthProviderProps>;
export const SignedIn = (isSimpleAuthEnabled ? SimpleSignedIn : ClerkSignedIn) as SignedComponent;
export const SignedOut = (
  isSimpleAuthEnabled ? SimpleSignedOut : ClerkSignedOut
) as SignedComponent;
export const RedirectToSignIn = (
  isSimpleAuthEnabled ? SimpleRedirectToSignIn : ClerkRedirectToSignIn
) as RedirectComponent;
export const useAuth = (
  isSimpleAuthEnabled ? useSimpleAuth : (useClerkAuth as unknown)
) as AuthHook;
export const useUser = (
  isSimpleAuthEnabled ? useSimpleUser : (useClerkUser as unknown)
) as UserHook;
export const useClerk = (
  isSimpleAuthEnabled ? useSimpleClerk : (useClerkHook as unknown)
) as ClerkHook;
export const UserButton = (
  isSimpleAuthEnabled ? SimpleUserButton : (ClerkUserButton as unknown)
) as UserButtonComponent;

export const AUTH_PROVIDER = isSimpleAuthEnabled ? 'simple' : 'clerk';
