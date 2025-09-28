import type { Page, Response } from '@playwright/test';

const FIXTURE_API_PREFIX = '/__fixtures/api';

export interface AwaitFixtureRequestOptions {
  method?: 'GET' | 'POST';
  statusMatcher?: number | ((status: number) => boolean);
  timeoutMs?: number;
}

export async function awaitFixtureRequest(
  page: Page,
  path: string,
  action: () => Promise<unknown> | unknown,
  options: AwaitFixtureRequestOptions = {}
): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const method = options.method ?? 'GET';
  const statusMatcher: (status: number) => boolean =
    typeof options.statusMatcher === 'function'
      ? options.statusMatcher
      : typeof options.statusMatcher === 'number'
        ? status => status === options.statusMatcher
        : status => status >= 200 && status < 300;
  const timeout = options.timeoutMs ?? 5_000;

  const waitForResponse = page.waitForResponse(
    response => {
      if (response.request().method() !== method) {
        return false;
      }

      const url = response.url();
      if (!url.includes(`${FIXTURE_API_PREFIX}${normalizedPath}`)) {
        return false;
      }

      return statusMatcher(response.status());
    },
    { timeout }
  );

  await Promise.resolve(action());
  return waitForResponse;
}

export async function waitForFixtureResponse(
  page: Page,
  path: string,
  options: AwaitFixtureRequestOptions = {}
): Promise<Response> {
  return awaitFixtureRequest(page, path, async () => undefined, options);
}
