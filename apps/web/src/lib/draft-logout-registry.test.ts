import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  registerDraftLogoutHandler,
  triggerDraftLogoutHandlers,
} from '@/lib/draft-logout-registry';

const resolveWindowBridge = () =>
  (
    window as typeof window & {
      __CTRL_FREAQ_DRAFT_LOGOUT_REGISTRY__?: {
        handlers: Map<string, Set<() => Promise<void> | void>>;
      };
    }
  ).__CTRL_FREAQ_DRAFT_LOGOUT_REGISTRY__;

describe('draft logout registry', () => {
  afterEach(() => {
    const bridge = resolveWindowBridge();
    bridge?.handlers.clear();
  });

  test('invokes registered handlers for matching author', async () => {
    const handler = vi.fn();
    const unregister = registerDraftLogoutHandler('author-123', handler);

    await triggerDraftLogoutHandlers('author-123');

    expect(handler).toHaveBeenCalledTimes(1);
    unregister();
  });

  test('no-ops when author identifier is blank', async () => {
    const handler = vi.fn();
    const unregister = registerDraftLogoutHandler('  ', handler);

    await triggerDraftLogoutHandlers('');

    expect(handler).not.toHaveBeenCalled();
    unregister();
  });
});
