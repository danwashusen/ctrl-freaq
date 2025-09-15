import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { beforeAll, afterAll, afterEach } from 'vitest';

// Global test setup
beforeAll(() => {
  // Setup global test environment
});

afterEach(() => {
  // Cleanup after each test
  cleanup();
});

afterAll(() => {
  // Cleanup after all tests
});
