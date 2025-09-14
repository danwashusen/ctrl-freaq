import '@testing-library/jest-dom'
import { beforeAll, afterAll, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Global test setup
beforeAll(() => {
  // Setup global test environment
})

afterEach(() => {
  // Cleanup after each test
  cleanup()
})

afterAll(() => {
  // Cleanup after all tests
})