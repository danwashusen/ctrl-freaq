import { vi, type MockInstance } from 'vitest';

// Vitest mock helpers need loose rest parameter types to support typed mock inference
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFn = (...args: any[]) => unknown;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AsyncFn = (...args: any[]) => Promise<unknown>;

export type MockedFn<Fn extends AnyFn> = MockInstance<Fn> & Fn;
export type MockedAsyncFn<Fn extends AsyncFn> = MockInstance<Fn> & Fn;

export type MockedFnWithArgs<Args extends unknown[], Return = unknown> = MockInstance<
  (...args: Args) => Return
> &
  ((...args: Args) => Return);

export type MockedAsyncFnWithArgs<Args extends unknown[], Return = unknown> = MockInstance<
  (...args: Args) => Promise<Return>
> &
  ((...args: Args) => Promise<Return>);

export const mockFn = <Fn extends AnyFn>(implementation?: Fn): MockedFn<Fn> =>
  vi.fn<Fn>(implementation);

export const mockAsyncFn = <Fn extends AsyncFn>(implementation?: Fn): MockedAsyncFn<Fn> =>
  vi.fn<Fn>(implementation);
