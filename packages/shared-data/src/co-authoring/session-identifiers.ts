import { z } from 'zod';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SCOPED_SESSION_ID_PATTERN = /^[a-z][a-z0-9-]*-session-[a-z0-9-]+$/i;
const SIMPLE_SESSION_ID_PATTERN = /^session-[a-z0-9-]+$/i;

export const SessionIdentifierSchema = z
  .string()
  .min(1, 'sessionId is required')
  .refine(
    value =>
      UUID_PATTERN.test(value) ||
      SCOPED_SESSION_ID_PATTERN.test(value) ||
      SIMPLE_SESSION_ID_PATTERN.test(value),
    {
      message: 'sessionId must be a UUID or scoped session identifier',
    }
  );

export const isSessionIdentifier = (value: string): boolean =>
  UUID_PATTERN.test(value) ||
  SCOPED_SESSION_ID_PATTERN.test(value) ||
  SIMPLE_SESSION_ID_PATTERN.test(value);
