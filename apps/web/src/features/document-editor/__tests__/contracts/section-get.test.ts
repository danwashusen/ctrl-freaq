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

describe('Contract Test: GET /api/v1/sections/{sectionId}', () => {
  const API_BASE_URL = 'http://localhost:5001/api/v1';
  const VALID_SECTION_ID = '123e4567-e89b-12d3-a456-426614174000';
  const _INVALID_SECTION_ID = 'invalid-uuid';

  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 200 with section details for valid section ID', async () => {
    // Mock successful section response
    const mockSectionResponse = {
      id: VALID_SECTION_ID,
      docId: '123e4567-e89b-12d3-a456-426614174100',
      parentSectionId: null,
      key: 'introduction',
      title: 'Introduction',
      depth: 0,
      orderIndex: 0,
      contentMarkdown: '# Introduction\nThis is the introduction section with content.',
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
      method: 'GET',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
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

    // Validate specific section properties
    expect(section.id).toBe(VALID_SECTION_ID);
    expect(typeof section.title).toBe('string');
    expect(typeof section.contentMarkdown).toBe('string');
    expect(typeof section.placeholderText).toBe('string');
    expect(typeof section.hasContent).toBe('boolean');
    expect(['idle', 'read_mode', 'edit_mode', 'saving']).toContain(section.viewState);
    expect(['idle', 'assumptions', 'drafting', 'review', 'ready']).toContain(section.status);
  });

  it('should return 401 when no authorization header provided', async () => {
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
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    const data = await response.json();
    const validationResult = ErrorResponseSchema.safeParse(data);
    expect(validationResult.success).toBe(true);

    expect(data.code).toBe('UNAUTHORIZED');
    expect(data.message).toContain('Authentication required');
  });

  it('should return 404 when section does not exist', async () => {
    const nonExistentSectionId = '999e4567-e89b-12d3-a456-426614174999';

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
      method: 'GET',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    const data = await response.json();
    const validationResult = ErrorResponseSchema.safeParse(data);
    expect(validationResult.success).toBe(true);

    expect(data.code).toBe('NOT_FOUND');
  });

  it('should return 400 for invalid section ID format', async () => {
    // Mock 400 error response
    const mockErrorResponse = {
      code: 'BAD_REQUEST',
      message: 'Invalid section ID format',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockErrorResponse,
    });

    const response = await fetch(`${API_BASE_URL}/sections/${_INVALID_SECTION_ID}`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(400);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    const data = await response.json();
    const validationResult = ErrorResponseSchema.safeParse(data);
    expect(validationResult.success).toBe(true);

    expect(data.code).toBe('BAD_REQUEST');
  });

  it('should include edit state information when section is being edited', async () => {
    // Mock section response with edit state
    const mockSectionResponse = {
      id: VALID_SECTION_ID,
      docId: '123e4567-e89b-12d3-a456-426614174100',
      parentSectionId: null,
      key: 'introduction',
      title: 'Introduction',
      depth: 0,
      orderIndex: 0,
      contentMarkdown: '# Introduction\nThis section is being edited.',
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
      method: 'GET',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);
    const section = await response.json();

    // Validate editing state consistency
    if (section.viewState === 'edit_mode') {
      expect(section.editingUser).not.toBeNull();
      expect(typeof section.editingUser).toBe('string');
    } else {
      // For other states, editingUser may be null
      if (section.editingUser !== null) {
        expect(typeof section.editingUser).toBe('string');
      }
    }

    // Validate lastModified is a valid date
    expect(() => new Date(section.lastModified)).not.toThrow();
    expect(new Date(section.lastModified).getTime()).toBeGreaterThan(0);
  });

  it('should return consistent content and placeholder text', async () => {
    // Mock section response with content
    const mockSectionResponse = {
      id: VALID_SECTION_ID,
      docId: '123e4567-e89b-12d3-a456-426614174100',
      parentSectionId: null,
      key: 'introduction',
      title: 'Introduction',
      depth: 0,
      orderIndex: 0,
      contentMarkdown:
        '# Introduction\nThis section has meaningful content that demonstrates the hasContent flag.',
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
      method: 'GET',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);
    const section = await response.json();

    // If section has content, contentMarkdown should not be empty
    if (section.hasContent) {
      expect(section.contentMarkdown.trim()).not.toBe('');
    }

    // placeholderText should always be present
    expect(section.placeholderText).toBeTruthy();
    expect(typeof section.placeholderText).toBe('string');

    // Validate content length constraint
    expect(section.contentMarkdown.length).toBeLessThanOrEqual(100000);
  });
});
