import pino from 'pino';
import { describe, expect, test } from 'vitest';

import { createBrowserLoggerSpy } from './logger-spy.js';

describe('browser logger spy', () => {
  const baseLogger = pino({ enabled: false });

  test('captures structured browser.log entries emitted via child loggers', () => {
    const spy = createBrowserLoggerSpy(baseLogger);

    const requestLogger = baseLogger.child({ requestId: 'req_test', event: 'browser.log' });
    requestLogger.info(
      { event: 'browser.log', entryRequestId: 'req_entry_1' },
      'emitted browser log'
    );
    requestLogger.warn({ event: 'other.event', entryRequestId: 'req_entry_2' }, 'ignored');

    const browserLogs = spy.getBrowserLogs();
    expect(browserLogs).toHaveLength(1);
    expect(browserLogs[0]).toMatchObject({
      bindings: { requestId: 'req_test', event: 'browser.log' },
      payload: { entryRequestId: 'req_entry_1', event: 'browser.log' },
      level: 'info',
      message: 'emitted browser log',
    });

    spy.restore();
  });

  test('restore detaches the spy so future logs are ignored', () => {
    const spy = createBrowserLoggerSpy(baseLogger);
    const requestLogger = baseLogger.child({ requestId: 'req_before', event: 'browser.log' });
    requestLogger.info({ event: 'browser.log' }, 'before restore');
    expect(spy.getBrowserLogs()).toHaveLength(1);

    spy.restore();

    const loggerAfterRestore = baseLogger.child({ requestId: 'req_after', event: 'browser.log' });
    loggerAfterRestore.info({ event: 'browser.log' }, 'after restore');

    expect(spy.getBrowserLogs()).toHaveLength(0);
  });
});
