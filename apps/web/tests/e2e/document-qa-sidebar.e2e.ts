import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { dismissDraftRecoveryGate, selectSimpleAuthUser } from './support/draft-recovery';

const QA_STREAM_KEY = '__QA_STREAMS__';

async function waitForQaStream(page: Page) {
  await page.waitForFunction(
    key => {
      const entry = (window as unknown as Record<string, unknown>)[key];
      if (!Array.isArray(entry)) {
        return false;
      }
      return entry.some(candidate => {
        if (!candidate || typeof candidate !== 'object') {
          return false;
        }
        const descriptor = candidate as { url?: string; listeners?: Map<string, Set<unknown>> };
        if (typeof descriptor.url === 'string' && descriptor.url.includes('/document-qa/')) {
          return true;
        }
        const listenerMap = descriptor.listeners;
        return listenerMap instanceof Map && listenerMap.has('state');
      });
    },
    QA_STREAM_KEY,
    { timeout: 15000 }
  );
}

async function dispatchQaStreamEvent(page: Page, type: string, payload: unknown) {
  await page.evaluate(
    ({ key, eventType, payload }) => {
      const entry = (window as unknown as Record<string, unknown>)[key as string];
      if (!Array.isArray(entry)) {
        throw new Error('No QA stream registry found');
      }
      const qaStream = [...entry].reverse().find(candidate => {
        if (!candidate || typeof candidate !== 'object') {
          return false;
        }
        const descriptor = candidate as { url?: string; listeners?: Map<string, Set<unknown>> };
        if (typeof descriptor.url === 'string' && descriptor.url.includes('/document-qa/')) {
          return true;
        }
        const listenerMap = descriptor.listeners;
        return listenerMap instanceof Map && listenerMap.has('state');
      });
      if (!qaStream) {
        throw new Error('Document QA stream not initialised');
      }
      (qaStream as { dispatch: (eventType: string, event: unknown) => void }).dispatch(
        eventType as string,
        payload
      );
    },
    { key: QA_STREAM_KEY, eventType: type, payload }
  );
}

const REVIEW_RESPONSE_BODY = {
  status: 'accepted' as const,
  sessionId: 'qa-session-initial',
  queue: {
    disposition: 'started' as const,
    replacementPolicy: 'newest_replaces_pending' as const,
    replacedSessionId: null,
    concurrencySlot: 1,
  },
  delivery: {
    mode: 'fallback' as const,
    reason: 'transport_blocked' as const,
  },
};

const RETRY_RESPONSE_BODY = {
  status: 'requeued' as const,
  previousSessionId: 'qa-session-initial',
  sessionId: 'qa-session-retry',
  queue: {
    disposition: 'started' as const,
    replacementPolicy: 'newest_replaces_pending' as const,
    replacedSessionId: 'qa-session-initial',
    concurrencySlot: 2,
  },
};

test.describe('Document QA sidebar interruptions', () => {
  test('surfaces fallback guidance and supports cancel then retry flows', async ({ page }) => {
    await page.addInitScript(key => {
      class TestEventSource {
        url: string;
        readyState = 1;
        onerror: ((event: unknown) => void) | null = null;
        listeners: Map<string, Set<(event: unknown) => void>> = new Map();

        constructor(url: string) {
          this.url = url;
          const globalStreams = (window as unknown as Record<string, unknown>)[key as string];
          if (Array.isArray(globalStreams)) {
            globalStreams.push(this);
          } else {
            (window as unknown as Record<string, unknown>)[key as string] = [this];
          }
        }

        addEventListener(type: string, listener: (event: unknown) => void) {
          const listeners = this.listeners.get(type) ?? new Set();
          listeners.add(listener);
          this.listeners.set(type, listeners);
        }

        removeEventListener(type: string, listener: (event: unknown) => void) {
          const listeners = this.listeners.get(type);
          if (!listeners) {
            return;
          }
          listeners.delete(listener);
          if (listeners.size === 0) {
            this.listeners.delete(type);
          }
        }

        dispatch(type: string, event: unknown) {
          const payload = {
            type,
            data: typeof event === 'string' ? event : JSON.stringify(event),
            lastEventId:
              typeof event === 'object' &&
              event !== null &&
              'id' in (event as Record<string, unknown>)
                ? String((event as Record<string, unknown>).id)
                : undefined,
          } as MessageEvent<string>;

          const notify = (eventType: string) => {
            const listeners = this.listeners.get(eventType);
            if (!listeners) {
              return;
            }
            for (const listener of listeners) {
              listener(payload);
            }
          };

          notify(type);
          notify('message');
        }

        close() {
          this.readyState = 2;
        }
      }

      Object.defineProperty(window, 'EventSource', {
        configurable: true,
        value: TestEventSource,
      });
    }, QA_STREAM_KEY);

    await page.route(
      '**/documents/demo-architecture/sections/sec-api/document-qa/review',
      async route => {
        await route.fulfill({
          status: 200,
          headers: {
            'content-type': 'application/json',
            'hx-stream-location': '/document-qa/sessions/qa-session-initial/events',
          },
          body: JSON.stringify(REVIEW_RESPONSE_BODY),
        });
      }
    );

    await page.route(
      '**/documents/demo-architecture/sections/sec-api/document-qa/sessions/qa-session-initial/cancel',
      async route => {
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            status: 'canceled',
            cancelReason: 'author_cancelled',
            promotedSessionId: null,
          }),
        });
      }
    );

    await page.route(
      '**/documents/demo-architecture/sections/sec-api/document-qa/sessions/qa-session-initial/retry',
      async route => {
        await route.fulfill({
          status: 200,
          headers: {
            'content-type': 'application/json',
            'hx-stream-location': '/document-qa/sessions/qa-session-retry/events',
          },
          body: JSON.stringify(RETRY_RESPONSE_BODY),
        });
      }
    );

    await page.route(
      '**/documents/demo-architecture/sections/sec-api/document-qa/sessions/qa-session-retry/retry',
      async route => {
        await route.fulfill({
          status: 200,
          headers: {
            'content-type': 'application/json',
            'hx-stream-location': '/document-qa/sessions/qa-session-retry/events',
          },
          body: JSON.stringify({
            status: 'requeued',
            previousSessionId: 'qa-session-retry',
            sessionId: 'qa-session-retry',
            queue: {
              disposition: 'started',
              replacementPolicy: 'newest_replaces_pending',
              replacedSessionId: 'qa-session-retry',
              concurrencySlot: 3,
            },
          }),
        });
      }
    );

    await page.goto('/documents/demo-architecture/sections/sec-api');
    await dismissDraftRecoveryGate(page);
    await selectSimpleAuthUser(page);

    const reviewRequestPromise = page.waitForRequest(
      request => request.url().includes('/document-qa/review') && request.method() === 'POST'
    );
    await page.getByRole('button', { name: /open qa review/i }).click();

    const reviewRequest = await reviewRequestPromise;
    expect(reviewRequest.postDataJSON()).toMatchObject({
      reviewerId: expect.any(String),
    });

    await page.waitForSelector('[data-testid="document-qa-panel"]');

    await waitForQaStream(page);

    await dispatchQaStreamEvent(page, 'state', {
      type: 'state',
      status: 'fallback_active',
      fallbackReason: 'transport_blocked',
      preservedTokensCount: 4,
      elapsedMs: 7400,
      delivery: 'fallback',
    });

    const qaPanel = page.getByTestId('document-qa-panel');
    await expect(qaPanel).toContainText('Assistant became unavailable');

    const cancelFallbackButton = page
      .getByTestId('document-qa-panel')
      .getByRole('button', { name: /cancel fallback/i });
    await expect(cancelFallbackButton).toBeVisible();

    const cancelRequest = page.waitForRequest(
      request =>
        request.url().includes('/document-qa/sessions/qa-session-initial/cancel') &&
        request.method() === 'POST'
    );
    await cancelFallbackButton.click();
    await cancelRequest;

    await dispatchQaStreamEvent(page, 'progress', {
      type: 'progress',
      status: 'canceled',
      cancelReason: 'author_cancelled',
      retryCount: 1,
      elapsedMs: 8200,
    });

    const progressPanel = page.getByTestId('co-author-session-progress');
    await expect(progressPanel).toContainText('You canceled the assistant request.');
    await expect(progressPanel).toContainText('Retry attempts: 1');

    const retryButton = page
      .getByTestId('document-qa-panel')
      .getByRole('button', { name: /retry assistant/i });
    await expect(retryButton).toBeVisible();

    const retryRequest = page.waitForRequest(request => {
      if (!request.url().includes('/document-qa/')) {
        return false;
      }
      return request.method() === 'POST';
    });
    await retryButton.click({ force: true });
    await page.evaluate(() => {
      const registry = window as unknown as Record<string, unknown>;
      const handler = registry.__qaEnsureSession;
      if (typeof handler === 'function') {
        return handler();
      }
      return null;
    });
    await retryRequest;

    await dispatchQaStreamEvent(page, 'progress', {
      type: 'progress',
      status: 'streaming',
      elapsedMs: 6200,
      stage: 'analyzing prompts',
      retryCount: 1,
    });

    await page.waitForFunction(() => {
      const panel = document.querySelector('[data-testid="co-author-session-progress"]');
      return (
        typeof panel?.textContent === 'string' &&
        panel.textContent.includes('Streaming — analyzing prompts')
      );
    });

    await expect(progressPanel).toContainText('Streaming — analyzing prompts');
    await expect(page.getByRole('button', { name: /cancel request/i })).toBeVisible();
    await expect(page.getByTestId('co-author-progress-retry-count')).toHaveText(
      /Retry attempts: 1/
    );
  });
});
