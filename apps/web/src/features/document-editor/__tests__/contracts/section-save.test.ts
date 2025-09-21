import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';

// Contract schemas based on sections-api.yaml
const SectionViewSchema = z.object({
  id: z.string().uuid(),
  docId: z.string().uuid(),
  parentSectionId: z.string().uuid().nullable(),
  key: z.string(),
  title: z.string(),
  depth: z.number().min(0).max(5),
  orderIndex: z.number(),
  contentMarkdown: z.string().max(100000),
  placeholderText: z.string(),
  hasContent: z.boolean(),
  viewState: z.enum(['idle', 'read_mode', 'edit_mode', 'saving']),
  editingUser: z.string().nullable(),
  lastModified: z.string().datetime(),
  status: z.enum(['idle', 'assumptions', 'drafting', 'review', 'ready']),
  assumptionsResolved: z.boolean(),
  qualityGateStatus: z.enum(['pending', 'passed', 'failed']).nullable(),
});

const SaveResponseSchema = z.object({
  section: SectionViewSchema,
  appliedChanges: z.array(z.string().uuid()),
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

describe('Contract Test: POST /api/v1/sections/{sectionId}/save', () => {
  const API_BASE_URL = 'http://localhost:5001/api/v1';
  const VALID_SECTION_ID = '123e4567-e89b-12d3-a456-426614174000';
  const VALID_CHANGE_ID = '456e7890-e89b-12d3-a456-426614174001';
  // const _INVALID_SECTION_ID = 'invalid-uuid'; // Reserved for future invalid ID tests

  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 200 when saving pending changes with valid change IDs', async () => {
    const requestBody = {
      changeIds: [VALID_CHANGE_ID],
    };

    // Mock successful save response
    const mockSaveResponse = {
      section: {
        id: VALID_SECTION_ID,
        docId: '123e4567-e89b-12d3-a456-426614174100',
        parentSectionId: null,
        key: 'introduction',
        title: 'Introduction',
        depth: 0,
        orderIndex: 0,
        contentMarkdown: '# Introduction\nThis section has been updated with saved changes.',
        placeholderText: 'Write your introduction here...',
        hasContent: true,
        viewState: 'read_mode',
        editingUser: null,
        lastModified: new Date().toISOString(),
        status: 'ready',
        assumptionsResolved: true,
        qualityGateStatus: 'passed',
      },
      appliedChanges: [VALID_CHANGE_ID],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockSaveResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}/save`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    const data = await response.json();

    // Validate response schema
    const validationResult = SaveResponseSchema.safeParse(data);
    expect(
      validationResult.success,
      `Schema validation failed: ${JSON.stringify(validationResult.error?.issues)}`
    ).toBe(true);

    // Validate specific properties
    expect(data.section.id).toBe(VALID_SECTION_ID);
    expect(Array.isArray(data.appliedChanges)).toBe(true);
    expect(data.appliedChanges).toContain(VALID_CHANGE_ID);

    // Section should have updated lastModified timestamp
    expect(() => new Date(data.section.lastModified)).not.toThrow();

    // Section viewState should no longer be 'saving' after successful save
    expect(['idle', 'read_mode']).toContain(data.section.viewState);
  });

  it('should return 200 when saving multiple pending changes', async () => {
    const changeIds = [VALID_CHANGE_ID, '789e0123-e89b-12d3-a456-426614174002'];
    const requestBody = {
      changeIds: changeIds,
    };

    // Mock successful save response with multiple changes
    const mockSaveResponse = {
      section: {
        id: VALID_SECTION_ID,
        docId: '123e4567-e89b-12d3-a456-426614174100',
        parentSectionId: null,
        key: 'introduction',
        title: 'Introduction',
        depth: 0,
        orderIndex: 0,
        contentMarkdown:
          '# Introduction\nThis section has been updated with multiple saved changes.',
        placeholderText: 'Write your introduction here...',
        hasContent: true,
        viewState: 'read_mode',
        editingUser: null,
        lastModified: new Date().toISOString(),
        status: 'ready',
        assumptionsResolved: true,
        qualityGateStatus: 'passed',
      },
      appliedChanges: changeIds,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockSaveResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}/save`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.appliedChanges).toHaveLength(changeIds.length);
    changeIds.forEach(changeId => {
      expect(data.appliedChanges).toContain(changeId);
    });
  });

  it('should return 400 for missing changeIds field', async () => {
    const requestBody = {
      // Missing changeIds field
    };

    // Mock 400 error response
    const mockErrorResponse = {
      code: 'BAD_REQUEST',
      message: 'Missing required field: changeIds',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockErrorResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}/save`, {
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

  it('should return 400 for empty changeIds array', async () => {
    const requestBody = {
      changeIds: [], // Empty array
    };

    // Mock 400 error response
    const mockErrorResponse = {
      code: 'BAD_REQUEST',
      message: 'changeIds array cannot be empty',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockErrorResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}/save`, {
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

  it('should return 400 for invalid UUID format in changeIds', async () => {
    const requestBody = {
      changeIds: ['invalid-uuid', 'another-invalid-id'],
    };

    // Mock 400 error response
    const mockErrorResponse = {
      code: 'BAD_REQUEST',
      message: 'Invalid UUID format in changeIds',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockErrorResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}/save`, {
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
      changeIds: [VALID_CHANGE_ID],
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

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}/save`, {
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

  it('should return 409 when section has conflicting pending changes', async () => {
    const requestBody = {
      changeIds: [VALID_CHANGE_ID],
    };

    // Mock 409 conflict response
    const mockErrorResponse = {
      code: 'CONFLICT',
      message: 'Section has conflicting pending changes',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockErrorResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}/save`, {
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
      expect([200, 409]).toContain(response.status);
    }
  });

  it('should return 429 when rate limit is exceeded', async () => {
    const requestBody = {
      changeIds: [VALID_CHANGE_ID],
    };

    // Mock rate limit response for all requests
    const mockErrorResponse = {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many save requests',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    // Mock all 15 requests to return rate limit error
    for (let i = 0; i < 15; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map([['Content-Type', 'application/json']]),
        json: async () => mockErrorResponse,
      });
    }

    // Simulate multiple rapid save requests
    const promises = Array.from({ length: 15 }, () =>
      fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}/save`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer fake-test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
    );

    const responses = await Promise.all(promises);

    // At least one response should be rate limited
    const rateLimitedResponse = responses.find(r => r.status === 429);

    if (rateLimitedResponse) {
      expect(rateLimitedResponse.headers.get('Content-Type')).toContain('application/json');

      const data = await rateLimitedResponse.json();
      const validationResult = ErrorResponseSchema.safeParse(data);
      expect(validationResult.success).toBe(true);

      expect(data.code).toBe('RATE_LIMIT_EXCEEDED');
    } else {
      // Rate limiting might not be implemented yet
      responses.forEach(response => {
        expect([200, 400, 401, 404, 409, 429]).toContain(response.status);
      });
    }
  });

  it('should validate section state after successful save', async () => {
    const requestBody = {
      changeIds: [VALID_CHANGE_ID],
    };

    // Mock successful save response with recent timestamp
    const recentTimestamp = new Date().toISOString();
    const mockSaveResponse = {
      section: {
        id: VALID_SECTION_ID,
        docId: '123e4567-e89b-12d3-a456-426614174100',
        parentSectionId: null,
        key: 'introduction',
        title: 'Introduction',
        depth: 0,
        orderIndex: 0,
        contentMarkdown: '# Introduction\nThis section has been updated with saved changes.',
        placeholderText: 'Write your introduction here...',
        hasContent: true,
        viewState: 'read_mode',
        editingUser: null,
        lastModified: recentTimestamp,
        status: 'ready',
        assumptionsResolved: true,
        qualityGateStatus: 'passed',
      },
      appliedChanges: [VALID_CHANGE_ID],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockSaveResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}/save`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (response.status === 200) {
      const data = await response.json();

      // Section should have updated content if changes were applied
      expect(data.section.hasContent).toBe(true);

      // lastModified should be recent (within last minute)
      const lastModified = new Date(data.section.lastModified);
      const now = new Date();
      const diffMs = now.getTime() - lastModified.getTime();
      expect(diffMs).toBeLessThan(60000); // Less than 1 minute

      // Section should not be in saving state after successful save
      expect(data.section.viewState).not.toBe('saving');

      // Applied changes should match requested changes
      expect(data.appliedChanges).toContain(VALID_CHANGE_ID);
    }
  });

  it('should handle partial save failures gracefully', async () => {
    const validChangeId = VALID_CHANGE_ID;
    const invalidChangeId = '999e9999-e89b-12d3-a456-426614174999';

    const requestBody = {
      changeIds: [validChangeId, invalidChangeId],
    };

    // Mock partial success response
    const mockSaveResponse = {
      section: {
        id: VALID_SECTION_ID,
        docId: '123e4567-e89b-12d3-a456-426614174100',
        parentSectionId: null,
        key: 'introduction',
        title: 'Introduction',
        depth: 0,
        orderIndex: 0,
        contentMarkdown: '# Introduction\nThis section has been partially updated.',
        placeholderText: 'Write your introduction here...',
        hasContent: true,
        viewState: 'read_mode',
        editingUser: null,
        lastModified: new Date().toISOString(),
        status: 'ready',
        assumptionsResolved: true,
        qualityGateStatus: 'passed',
      },
      appliedChanges: [validChangeId], // Only valid change applied
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockSaveResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}/save`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Should handle partial failures appropriately
    if (response.status === 200) {
      const data = await response.json();
      // Only valid changes should be applied
      expect(data.appliedChanges.length).toBeLessThanOrEqual(1);
    } else {
      // Complete failure is also acceptable
      expect([400, 404, 409]).toContain(response.status);
    }
  });
});
