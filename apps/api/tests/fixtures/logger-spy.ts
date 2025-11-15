import type { Bindings, ChildLoggerOptions, Logger } from 'pino';
import { vi } from 'vitest';

export type BrowserLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface BrowserLogRecord {
  level: BrowserLogLevel;
  bindings: Record<string, unknown>;
  payload: Record<string, unknown>;
  message?: string;
}

export interface BrowserLoggerSpy {
  logs: BrowserLogRecord[];
  getBrowserLogs(): BrowserLogRecord[];
  clear(): void;
  restore(): void;
}

function normalizeArgs(args: unknown[]): { payload: Record<string, unknown>; message?: string } {
  if (args.length === 0) {
    return { payload: {} };
  }

  const [first, second] = args;
  if (typeof first === 'string') {
    return { payload: {}, message: first };
  }

  if (first && typeof first === 'object' && !Array.isArray(first)) {
    return {
      payload: first as Record<string, unknown>,
      message: typeof second === 'string' ? second : undefined,
    };
  }

  return {
    payload: { value: first },
    message: typeof second === 'string' ? second : undefined,
  };
}

function wrapLoggerWithRecorder<T extends Logger>(
  logger: T,
  bindings: Record<string, unknown>,
  recorder: (entry: BrowserLogRecord) => void
): T {
  const capture = (level: BrowserLogLevel, args: unknown[]): void => {
    const { payload, message } = normalizeArgs(args);
    recorder({
      level,
      bindings,
      payload,
      message,
    });
  };

  const wrapLevel = <L extends BrowserLogLevel>(
    level: L,
    getOriginal: () => Logger[L],
    setter: (replacement: Logger[L]) => void
  ) => {
    const original = getOriginal();
    const patched = ((...levelArgs: unknown[]) => {
      capture(level, levelArgs);
      return (original as (...levelArgs: unknown[]) => unknown)(...levelArgs);
    }) as Logger[L];
    setter(patched);
  };

  wrapLevel(
    'trace',
    () => logger.trace.bind(logger),
    replacement => {
      logger.trace = replacement as typeof logger.trace;
    }
  );
  wrapLevel(
    'debug',
    () => logger.debug.bind(logger),
    replacement => {
      logger.debug = replacement as typeof logger.debug;
    }
  );
  wrapLevel(
    'info',
    () => logger.info.bind(logger),
    replacement => {
      logger.info = replacement as typeof logger.info;
    }
  );
  wrapLevel(
    'warn',
    () => logger.warn.bind(logger),
    replacement => {
      logger.warn = replacement as typeof logger.warn;
    }
  );
  wrapLevel(
    'error',
    () => logger.error.bind(logger),
    replacement => {
      logger.error = replacement as typeof logger.error;
    }
  );
  wrapLevel(
    'fatal',
    () => logger.fatal.bind(logger),
    replacement => {
      logger.fatal = replacement as typeof logger.fatal;
    }
  );

  return logger;
}

function isBrowserLog(entry: BrowserLogRecord): boolean {
  if (entry.payload.event === 'browser.log') {
    return true;
  }

  if (entry.payload.event) {
    return false;
  }

  return entry.bindings.event === 'browser.log';
}

export function createBrowserLoggerSpy(logger: Logger): BrowserLoggerSpy {
  const records: BrowserLogRecord[] = [];

  const recorder = (entry: BrowserLogRecord): void => {
    records.push(entry);
  };

  const originalChild = logger.child.bind(logger) as typeof logger.child;
  const childSpy = vi.spyOn(logger, 'child');
  childSpy.mockImplementation(((bindings: Bindings = {}, options?: ChildLoggerOptions<string>) => {
    const childLogger = originalChild(bindings, options);
    const wrappedLogger = wrapLoggerWithRecorder(
      childLogger as unknown as Logger,
      {
        ...bindings,
      },
      recorder
    );
    return wrappedLogger as unknown as typeof childLogger;
  }) as unknown as typeof logger.child);

  return {
    logs: records,
    getBrowserLogs: () => records.filter(isBrowserLog),
    clear: () => {
      records.length = 0;
    },
    restore: () => {
      childSpy.mockRestore();
      records.length = 0;
    },
  };
}
