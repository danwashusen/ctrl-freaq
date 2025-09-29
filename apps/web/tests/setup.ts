import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { beforeAll, afterAll, afterEach, vi } from 'vitest';

import * as zustandMock from './__mocks__/zustand';

// Global test setup
beforeAll(() => {
  // Setup global test environment
  // Provide a lightweight mock for 'zustand' to avoid installing the package in CI sandbox
  vi.mock('zustand', () => zustandMock);

  // Mock the browser logger to avoid accessing window during tests (e.g. jsdom teardown)
  vi.mock('@/lib/logger', () => {
    const makeMock = () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      flush: vi.fn(),
      setUserId: vi.fn(),
      setLevel: vi.fn(),
      setCorrelation: vi.fn(),
      setTemplateContext: vi.fn(),
      clearTemplateContext: vi.fn(),
      destroy: vi.fn(),
    });

    const mockLogger = makeMock();

    class MockBrowserLogger {
      debug = mockLogger.debug;
      info = mockLogger.info;
      warn = mockLogger.warn;
      error = mockLogger.error;
      fatal = mockLogger.fatal;
      flush = mockLogger.flush;
      setUserId = mockLogger.setUserId;
      setLevel = mockLogger.setLevel;
      setCorrelation = mockLogger.setCorrelation;
      setTemplateContext = mockLogger.setTemplateContext;
      clearTemplateContext = mockLogger.clearTemplateContext;
      destroy = mockLogger.destroy;
    }

    return {
      default: mockLogger,
      logger: mockLogger,
      BrowserLogger: MockBrowserLogger,
    };
  });
});

afterEach(() => {
  // Cleanup after each test
  cleanup();
});

afterAll(() => {
  // Cleanup after all tests
});
