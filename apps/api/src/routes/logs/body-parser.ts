import type { RequestHandler } from 'express';
import { json } from 'express';

const SUPPORTED_CONTENT_TYPES = ['application/json', 'text/plain'] as const;

/**
 * Returns a JSON parser restricted to the logs module so we can accept sendBeacon payloads
 * while enforcing the 1 MB limit independently of the global parser.
 */
export function createBrowserLogsBodyParser(): RequestHandler {
  return json({
    limit: '1mb',
    type: [...SUPPORTED_CONTENT_TYPES],
  });
}
