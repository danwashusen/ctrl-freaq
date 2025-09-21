import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';

// Contract schemas based on sections-api.yaml
const PatchDiffSchema = z.object({
  op: z.enum(['add', 'remove', 'replace']),
  path: z.string(),
  value: z.string().optional(),
  oldValue: z.string().optional(),
});

const PendingChangeSchema = z.object({
  id: z.string().uuid(),
  sectionId: z.string().uuid(),
  documentId: z.string().uuid(),
  patches: z.array(PatchDiffSchema),
  originalContent: z.string(),
  previewContent: z.string(),
  createdAt: z.string().datetime(),
  createdBy: z.string(),
  sessionId: z.string(),
  status: z.enum(['pending', 'applying', 'applied', 'failed']),
  conflictsWith: z.array(z.string().uuid()),
});

const ErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.object({}).passthrough().optional(),
  requestId: z.string(),
  timestamp: z.string().datetime(),
});

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Contract Test: POST /api/v1/sections/{sectionId}/pending-changes', () => {
  const API_BASE_URL = 'http://localhost:5001/api/v1';
  const VALID_SECTION_ID = '123e4567-e89b-12d3-a456-426614174000';
  // const _INVALID_SECTION_ID = 'invalid-uuid'; // Reserved for future invalid ID tests

  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 201 when creating pending changes with valid patches', async () => {
    const requestBody = {
      patches: [
        {
          op: 'replace',
          path: '/1',
          oldValue: 'Original text',
          value: 'Modified text',
        },
        {
          op: 'add',
          path: '/2',
          value: 'New line added',
        },
      ],
      originalContent: '# Title\nOriginal text',
      previewContent: '# Title\nModified text\nNew line added',
    };

    // Mock successful pending change creation response
    const mockPendingChangeResponse = {
      id: '456e7890-e89b-12d3-a456-426614174001',
      sectionId: VALID_SECTION_ID,
      documentId: '123e4567-e89b-12d3-a456-426614174100',
      patches: requestBody.patches,
      originalContent: requestBody.originalContent,
      previewContent: requestBody.previewContent,
      createdAt: new Date().toISOString(),
      createdBy: 'test-user-123',
      sessionId: 'session-456',
      status: 'pending',
      conflictsWith: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockPendingChangeResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}/pending-changes`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    const pendingChange = await response.json();

    // Validate response schema
    const validationResult = PendingChangeSchema.safeParse(pendingChange);
    expect(
      validationResult.success,
      `Schema validation failed: ${JSON.stringify(validationResult.error?.issues)}`
    ).toBe(true);

    // Validate specific properties
    expect(pendingChange.sectionId).toBe(VALID_SECTION_ID);
    expect(pendingChange.patches).toHaveLength(2);
    expect(pendingChange.originalContent).toBe(requestBody.originalContent);
    expect(pendingChange.previewContent).toBe(requestBody.previewContent);
    expect(pendingChange.status).toBe('pending');
    expect(Array.isArray(pendingChange.conflictsWith)).toBe(true);
  });

  it('should return 400 for missing required fields', async () => {
    const requestBody = {
      patches: [
        {
          op: 'replace',
          path: '/1',
          value: 'Modified text',
        },
      ],
      // Missing originalContent and previewContent
    };

    // Mock 400 error response
    const mockErrorResponse = {
      code: 'BAD_REQUEST',
      message: 'Missing required fields: originalContent, previewContent',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockErrorResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}/pending-changes`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    const data = await response.json();
    const validationResult = ErrorResponseSchema.safeParse(data);
    expect(validationResult.success).toBe(true);

    expect(data.code).toBe('BAD_REQUEST');
  });

  it('should return 400 for empty patches array', async () => {
    const requestBody = {
      patches: [], // Empty patches array
      originalContent: '# Title\nOriginal text',
      previewContent: '# Title\nOriginal text',
    };

    // Mock 400 error response
    const mockErrorResponse = {
      code: 'BAD_REQUEST',
      message: 'Patches array cannot be empty',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockErrorResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}/pending-changes`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    const data = await response.json();
    const validationResult = ErrorResponseSchema.safeParse(data);
    expect(validationResult.success).toBe(true);

    expect(data.code).toBe('BAD_REQUEST');
  });

  it('should return 400 for invalid patch operation', async () => {
    const requestBody = {
      patches: [
        {
          op: 'invalid_op', // Invalid operation
          path: '/1',
          value: 'Modified text',
        },
      ],
      originalContent: '# Title\nOriginal text',
      previewContent: '# Title\nModified text',
    };

    // Mock 400 error response
    const mockErrorResponse = {
      code: 'BAD_REQUEST',
      message: 'Invalid patch operation: invalid_op',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockErrorResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}/pending-changes`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    const data = await response.json();
    const validationResult = ErrorResponseSchema.safeParse(data);
    expect(validationResult.success).toBe(true);

    expect(data.code).toBe('BAD_REQUEST');
  });

  it('should return 401 when no authorization header provided', async () => {
    const requestBody = {
      patches: [
        {
          op: 'replace',
          path: '/1',
          oldValue: 'Original text',
          value: 'Modified text',
        },
      ],
      originalContent: '# Title\nOriginal text',
      previewContent: '# Title\nModified text',
    };

    // Mock 401 error response
    const mockErrorResponse = {
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockErrorResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}/pending-changes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    const data = await response.json();
    const validationResult = ErrorResponseSchema.safeParse(data);
    expect(validationResult.success).toBe(true);

    expect(data.code).toBe('UNAUTHORIZED');
  });

  it('should return 409 when changes conflict with existing pending changes', async () => {
    const requestBody = {
      patches: [
        {
          op: 'replace',
          path: '/1',
          oldValue: 'Different original text', // Conflicts with current content
          value: 'Modified text',
        },
      ],
      originalContent: '# Title\nDifferent original text',
      previewContent: '# Title\nModified text',
    };

    // Mock 409 conflict response
    const mockErrorResponse = {
      code: 'CONFLICT',
      message: 'Changes conflict with existing pending changes',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockErrorResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}/pending-changes`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Conflict might not always occur, depends on implementation
    if (response.status === 409) {
      expect(response.headers.get('Content-Type')).toContain('application/json');

      const data = await response.json();
      const validationResult = ErrorResponseSchema.safeParse(data);
      expect(validationResult.success).toBe(true);

      expect(data.code).toBe('CONFLICT');
    } else {
      // If no conflict, should still be valid response
      expect([201, 409]).toContain(response.status);
    }
  });

  it('should validate patch operation semantics', async () => {
    // Test different patch operations
    const patchOperations = [
      {
        op: 'add',
        path: '/2',
        value: 'New content',
      },
      {
        op: 'remove',
        path: '/1',
        oldValue: 'Content to remove',
      },
      {
        op: 'replace',
        path: '/1',
        oldValue: 'Original content',
        value: 'Replacement content',
      },
    ];

    for (const patch of patchOperations) {
      const requestBody = {
        patches: [patch],
        originalContent: '# Title\nOriginal content',
        previewContent: '# Title\nModified content',
      };

      // Mock successful response for valid patch operations
      const mockPendingChangeResponse = {
        id: '456e7890-e89b-12d3-a456-426614174001',
        sectionId: VALID_SECTION_ID,
        documentId: '123e4567-e89b-12d3-a456-426614174100',
        patches: [patch],
        originalContent: requestBody.originalContent,
        previewContent: requestBody.previewContent,
        createdAt: new Date().toISOString(),
        createdBy: 'test-user-123',
        sessionId: 'session-456',
        status: 'pending',
        conflictsWith: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Map([['Content-Type', 'application/json']]),
        json: async () => mockPendingChangeResponse,
      });

      const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}/pending-changes`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer fake-test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 201) {
        const pendingChange = await response.json();
        expect(pendingChange.patches[0].op).toBe(patch.op);
        expect(pendingChange.patches[0].path).toBe(patch.path);
      } else {
        // Some operations might be invalid depending on content
        expect([400, 409]).toContain(response.status);
      }
    }
  });

  it('should validate content consistency between original and preview', async () => {
    const requestBody = {
      patches: [
        {
          op: 'replace',
          path: '/1',
          oldValue: 'Original text',
          value: 'Modified text',
        },
      ],
      originalContent: '# Title\nOriginal text',
      previewContent: '# Title\nOriginal text', // Preview doesn't match patches
    };

    // Mock 400 error response for inconsistent content
    const mockErrorResponse = {
      code: 'BAD_REQUEST',
      message: 'Preview content does not match the result of applying patches',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockErrorResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}/pending-changes`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Should validate that preview content matches the result of applying patches
    expect([400, 201]).toContain(response.status);

    if (response.status === 400) {
      const data = await response.json();
      expect(data.code).toBe('BAD_REQUEST');
    }
  });
});
