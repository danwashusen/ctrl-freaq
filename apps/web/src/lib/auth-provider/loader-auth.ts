import { AUTH_PROVIDER } from './index';
import { logger } from '../logger';

const SIMPLE_AUTH_COOKIE = 'simple_auth_token';

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookieString = document.cookie;
  if (!cookieString || typeof cookieString !== 'string') {
    return null;
  }

  const segments = cookieString.split(';');
  for (const segment of segments) {
    const [rawName, ...rawValue] = segment.split('=');
    if (!rawName) {
      continue;
    }
    if (rawName.trim() !== name) {
      continue;
    }
    const value = rawValue.join('=').trim();
    if (!value) {
      return null;
    }
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
};

const resolveClerkToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') {
    return null;
  }

  const candidates = [
    (window as { Clerk?: { session?: { getToken?: () => Promise<string | null> } } }).Clerk,
    (window as { __clerk_client?: { session?: { getToken?: () => Promise<string | null> } } })
      .__clerk_client,
    (window as { __clerk?: { session?: { getToken?: () => Promise<string | null> } } }).__clerk,
  ];

  for (const candidate of candidates) {
    const getToken = candidate?.session?.getToken;
    if (typeof getToken === 'function') {
      try {
        const token = await getToken();
        if (typeof token === 'string') {
          const trimmed = token.trim();
          if (trimmed.length > 0) {
            return trimmed;
          }
        }
      } catch (error) {
        logger.warn('Failed to resolve Clerk auth token from loader context', {
          error:
            error instanceof Error
              ? `${error.name}: ${error.message}`
              : typeof error === 'string'
                ? error
                : 'Unknown error',
        });
      }
    }
  }

  return null;
};

export const getLoaderAuthToken = async (): Promise<string | null> => {
  if (AUTH_PROVIDER === 'simple') {
    const token = readCookie(SIMPLE_AUTH_COOKIE);
    return typeof token === 'string' && token.trim().length > 0 ? token.trim() : null;
  }

  if (AUTH_PROVIDER === 'clerk') {
    return resolveClerkToken();
  }

  return null;
};
