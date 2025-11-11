import '@/lib/immer-config';
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { beforeAll, afterAll, afterEach, vi } from 'vitest';

import * as zustandMock from './__mocks__/zustand';
import { configureDocumentEditorClients } from '@/lib/document-editor-client-config';

const useShallowMock = <State, StateSlice>(selector: (state: State) => StateSlice) => selector;
const createMatchMediaMock = () =>
  vi.fn().mockImplementation((query: string) => ({
    matches: query === '(min-width: 1024px)',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

// Global test setup
beforeAll(() => {
  // Setup global test environment
  // Provide a lightweight mock for 'zustand' to avoid installing the package in CI sandbox
  vi.mock('zustand', () => zustandMock);
  vi.mock('zustand/shallow', () => ({
    useShallow: useShallowMock,
  }));
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: createMatchMediaMock(),
  });
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: vi.fn(),
  });
  configureDocumentEditorClients({
    baseUrl: 'http://localhost:5001/api/v1',
    getAuthToken: async () => 'fake-test-token',
  });
});

afterEach(() => {
  // Cleanup after each test
  cleanup();
  window.sessionStorage.clear();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: createMatchMediaMock(),
  });
});

afterAll(() => {
  // Cleanup after all tests
});
