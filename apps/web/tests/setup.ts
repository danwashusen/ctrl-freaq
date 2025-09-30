import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { beforeAll, afterAll, afterEach, vi } from 'vitest';

import * as zustandMock from './__mocks__/zustand';

const useShallowMock = <State, StateSlice>(selector: (state: State) => StateSlice) => selector;

// Global test setup
beforeAll(() => {
  // Setup global test environment
  // Provide a lightweight mock for 'zustand' to avoid installing the package in CI sandbox
  vi.mock('zustand', () => zustandMock);
  vi.mock('zustand/shallow', () => ({
    useShallow: useShallowMock,
  }));
});

afterEach(() => {
  // Cleanup after each test
  cleanup();
});

afterAll(() => {
  // Cleanup after all tests
});
