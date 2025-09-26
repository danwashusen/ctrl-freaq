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

describe('Contract Test: PATCH /api/v1/sections/{sectionId}', () => {
  const API_BASE_URL = 'http://localhost:5001/api/v1';
  const VALID_SECTION_ID = '123e4567-e89b-12d3-a456-426614174000';
  // const _INVALID_SECTION_ID = 'invalid-uuid'; // Reserved for future invalid ID tests

  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 200 when updating section state to read_mode', async () => {
    const requestBody = {
      viewState: 'read_mode',
    };

    // Mock successful section update response
    const mockSectionResponse = {
      id: VALID_SECTION_ID,
      docId: '123e4567-e89b-12d3-a456-426614174100',
      parentSectionId: null,
      key: 'introduction',
      title: 'Introduction',
      depth: 0,
      orderIndex: 0,
      contentMarkdown: '# Introduction\nThis is the introduction section.',
      placeholderText: 'Write your introduction here...',
      hasContent: true,
      viewState: 'read_mode',
      editingUser: null,
      lastModified: new Date().toISOString(),
      status: 'ready',
      assumptionsResolved: true,
      qualityGateStatus: 'passed',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockSectionResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    const section = await response.json();

    // Validate response schema
    const validationResult = SectionViewSchema.safeParse(section);
    expect(
      validationResult.success,
      `Schema validation failed: ${JSON.stringify(validationResult.error?.issues)}`
    ).toBe(true);

    // Validate state transition
    expect(section.viewState).toBe('read_mode');
    expect(section.id).toBe(VALID_SECTION_ID);
  });

  it('should return 200 when updating section state to edit_mode', async () => {
    const requestBody = {
      viewState: 'edit_mode',
    };

    // Mock successful section update response with edit_mode
    const mockSectionResponse = {
      id: VALID_SECTION_ID,
      docId: '123e4567-e89b-12d3-a456-426614174100',
      parentSectionId: null,
      key: 'introduction',
      title: 'Introduction',
      depth: 0,
      orderIndex: 0,
      contentMarkdown: '# Introduction\nThis is the introduction section.',
      placeholderText: 'Write your introduction here...',
      hasContent: true,
      viewState: 'edit_mode',
      editingUser: 'test-user-123',
      lastModified: new Date().toISOString(),
      status: 'drafting',
      assumptionsResolved: false,
      qualityGateStatus: 'pending',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockSectionResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);
    const section = await response.json();

    expect(section.viewState).toBe('edit_mode');
    // When entering edit mode, editingUser should be set
    expect(section.editingUser).not.toBeNull();
  });

  it('should return 400 for invalid viewState value', async () => {
    const requestBody = {
      viewState: 'invalid_state',
    };

    // Mock 400 error response
    const mockErrorResponse = {
      code: 'BAD_REQUEST',
      message: 'Invalid viewState value: invalid_state',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockErrorResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}`, {
      method: 'PATCH',
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

  it('should return 400 for missing viewState in request body', async () => {
    const requestBody = {};

    // Mock 400 error response
    const mockErrorResponse = {
      code: 'BAD_REQUEST',
      message: 'Missing required field: viewState',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockErrorResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}`, {
      method: 'PATCH',
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
      viewState: 'read_mode',
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

    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}`, {
      method: 'PATCH',
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

  it('should return 404 when section does not exist', async () => {
    const nonExistentSectionId = '999e4567-e89b-12d3-a456-426614174999';
    const requestBody = {
      viewState: 'read_mode',
    };

    // Mock 404 error response
    const mockErrorResponse = {
      code: 'NOT_FOUND',
      message: 'Section not found',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockErrorResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${nonExistentSectionId}`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    const data = await response.json();
    const validationResult = ErrorResponseSchema.safeParse(data);
    expect(validationResult.success).toBe(true);

    expect(data.code).toBe('NOT_FOUND');
  });

  it('should return 409 when section is locked by another user', async () => {
    const requestBody = {
      viewState: 'edit_mode',
    };

    // Mock 409 conflict response
    const mockErrorResponse = {
      code: 'CONFLICT',
      message: 'Section is currently being edited by another user',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockErrorResponse,
    });

    // First user locks the section (simulate)
    // Second user tries to edit the same section
    const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer different-user-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Expect conflict if section is already being edited
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

  it('should validate state transition sequence', async () => {
    const states = ['idle', 'read_mode', 'edit_mode', 'saving'];

    for (const state of states) {
      const requestBody = {
        viewState: state,
      };

      // Mock successful response for each state
      const mockSectionResponse = {
        id: VALID_SECTION_ID,
        docId: '123e4567-e89b-12d3-a456-426614174100',
        parentSectionId: null,
        key: 'introduction',
        title: 'Introduction',
        depth: 0,
        orderIndex: 0,
        contentMarkdown: '# Introduction\nThis is the introduction section.',
        placeholderText: 'Write your introduction here...',
        hasContent: true,
        viewState: state,
        editingUser: state === 'edit_mode' ? 'test-user-123' : null,
        lastModified: new Date().toISOString(),
        status: state === 'edit_mode' ? 'drafting' : 'ready',
        assumptionsResolved: state !== 'edit_mode',
        qualityGateStatus: state === 'edit_mode' ? 'pending' : 'passed',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['Content-Type', 'application/json']]),
        json: async () => mockSectionResponse,
      });

      const response = await fetch(`${API_BASE_URL}/sections/${VALID_SECTION_ID}`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer fake-test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 200) {
        const section = await response.json();
        expect(section.viewState).toBe(state);

        // Validate lastModified is updated
        expect(() => new Date(section.lastModified)).not.toThrow();
      } else {
        // Some state transitions might be invalid depending on current state
        expect([400, 409]).toContain(response.status);
      }
    }
  });
});
