import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { beforeAll, afterAll, afterEach, vi } from 'vitest';

import * as zustandMock from './__mocks__/zustand';

// Global test setup
beforeAll(() => {
  // Setup global test environment
  // Provide a lightweight mock for 'zustand' to avoid installing the package in CI sandbox
  vi.mock('zustand', () => zustandMock);
});

afterEach(() => {
  // Cleanup after each test
  cleanup();
});

afterAll(() => {
  // Cleanup after all tests
});
