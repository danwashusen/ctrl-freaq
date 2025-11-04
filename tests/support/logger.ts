import { mockFn, type MockedFn } from './vitest';

type LogMethod = (...args: unknown[]) => void;
type ChildMethod = (bindings: Record<string, unknown>, options?: unknown) => LoggerShape;

type LoggerShape = {
  level: string;
  child: ChildMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  debug: LogMethod;
  trace: LogMethod;
  fatal: LogMethod;
};

type LoggerSpies = {
  child: MockedFn<ChildMethod>;
  info: MockedFn<LogMethod>;
  warn: MockedFn<LogMethod>;
  error: MockedFn<LogMethod>;
  debug: MockedFn<LogMethod>;
  trace: MockedFn<LogMethod>;
  fatal: MockedFn<LogMethod>;
};

export type TestLogger<TLogger extends object = LoggerShape> = {
  logger: TLogger;
} & LoggerSpies;

export const createTestLogger = <TLogger extends object = LoggerShape>(): TestLogger<TLogger> => {
  const child = mockFn<ChildMethod>(() => baseLogger);
  const info = mockFn<LogMethod>(() => undefined);
  const warn = mockFn<LogMethod>(() => undefined);
  const error = mockFn<LogMethod>(() => undefined);
  const debug = mockFn<LogMethod>(() => undefined);
  const trace = mockFn<LogMethod>(() => undefined);
  const fatal = mockFn<LogMethod>(() => undefined);

  const baseLogger: LoggerShape = {
    level: 'silent',
    child: child as unknown as ChildMethod,
    info: info as unknown as LogMethod,
    warn: warn as unknown as LogMethod,
    error: error as unknown as LogMethod,
    debug: debug as unknown as LogMethod,
    trace: trace as unknown as LogMethod,
    fatal: fatal as unknown as LogMethod,
  };

  return {
    logger: baseLogger as unknown as TLogger,
    child: child as unknown as MockedFn<ChildMethod>,
    info: info as unknown as MockedFn<LogMethod>,
    warn: warn as unknown as MockedFn<LogMethod>,
    error: error as unknown as MockedFn<LogMethod>,
    debug: debug as unknown as MockedFn<LogMethod>,
    trace: trace as unknown as MockedFn<LogMethod>,
    fatal: fatal as unknown as MockedFn<LogMethod>,
  };
};
