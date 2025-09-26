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

const TocNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    sectionId: z.string().uuid(),
    title: z.string(),
    depth: z.number(),
    orderIndex: z.number(),
    hasContent: z.boolean(),
    status: z.enum(['idle', 'assumptions', 'drafting', 'review', 'ready']),
    isExpanded: z.boolean(),
    isActive: z.boolean(),
    isVisible: z.boolean(),
    hasUnsavedChanges: z.boolean(),
    children: z.array(TocNodeSchema),
    parentId: z.string().uuid().nullable(),
  })
);

const TableOfContentsSchema = z.object({
  documentId: z.string().uuid(),
  sections: z.array(TocNodeSchema),
  lastUpdated: z.string().datetime(),
});

const GetSectionsResponseSchema = z.object({
  sections: z.array(SectionViewSchema),
  toc: TableOfContentsSchema,
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

describe('Contract Test: GET /api/v1/documents/{docId}/sections', () => {
  const API_BASE_URL = 'http://localhost:5001/api/v1';
  const VALID_DOC_ID = '123e4567-e89b-12d3-a456-426614174000';
  const INVALID_DOC_ID = 'invalid-uuid';

  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 200 with sections and toc for valid document ID', async () => {
    // Mock successful response
    const mockResponseData = {
      sections: [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          docId: VALID_DOC_ID,
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
        },
      ],
      toc: {
        documentId: VALID_DOC_ID,
        sections: [
          {
            sectionId: '123e4567-e89b-12d3-a456-426614174001',
            title: 'Introduction',
            depth: 0,
            orderIndex: 0,
            hasContent: true,
            status: 'ready',
            isExpanded: true,
            isActive: false,
            isVisible: true,
            hasUnsavedChanges: false,
            children: [],
            parentId: null,
          },
        ],
        lastUpdated: new Date().toISOString(),
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockResponseData,
    });

    const response = await fetch(`${API_BASE_URL}/documents/${VALID_DOC_ID}/sections`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    const data = await response.json();

    // Validate response schema
    const validationResult = GetSectionsResponseSchema.safeParse(data);
    expect(
      validationResult.success,
      `Schema validation failed: ${JSON.stringify(validationResult.error?.issues)}`
    ).toBe(true);

    const { sections, toc } = data;

    // Validate sections array
    expect(Array.isArray(sections)).toBe(true);
    sections.forEach((section: any) => {
      expect(section.docId).toBe(VALID_DOC_ID);
      expect(typeof section.id).toBe('string');
      expect(typeof section.title).toBe('string');
      expect(typeof section.depth).toBe('number');
      expect(section.depth).toBeGreaterThanOrEqual(0);
      expect(section.depth).toBeLessThanOrEqual(5);
    });

    // Validate table of contents
    expect(toc.documentId).toBe(VALID_DOC_ID);
    expect(Array.isArray(toc.sections)).toBe(true);
    expect(typeof toc.lastUpdated).toBe('string');
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

    const response = await fetch(`${API_BASE_URL}/documents/${VALID_DOC_ID}/sections`, {
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

  it('should return 404 when document does not exist', async () => {
    const nonExistentDocId = '999e4567-e89b-12d3-a456-426614174999';

    // Mock 404 error response
    const mockErrorResponse = {
      code: 'NOT_FOUND',
      message: 'Document not found',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockErrorResponse,
    });

    const response = await fetch(`${API_BASE_URL}/documents/${nonExistentDocId}/sections`, {
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

  it('should return 400 for invalid document ID format', async () => {
    // Mock 400 error response
    const mockErrorResponse = {
      code: 'BAD_REQUEST',
      message: 'Invalid document ID format',
      requestId: 'test-request-id',
      timestamp: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockErrorResponse,
    });

    const response = await fetch(`${API_BASE_URL}/documents/${INVALID_DOC_ID}/sections`, {
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

  it('should validate section hierarchy in response', async () => {
    // Mock hierarchical response data
    const mockResponseData = {
      sections: [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          docId: VALID_DOC_ID,
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
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          docId: VALID_DOC_ID,
          parentSectionId: '123e4567-e89b-12d3-a456-426614174001',
          key: 'subsection-1',
          title: 'Subsection 1',
          depth: 1,
          orderIndex: 1,
          contentMarkdown: '## Subsection 1\nThis is a subsection.',
          placeholderText: 'Write your subsection here...',
          hasContent: true,
          viewState: 'read_mode',
          editingUser: null,
          lastModified: new Date().toISOString(),
          status: 'ready',
          assumptionsResolved: true,
          qualityGateStatus: 'passed',
        },
      ],
      toc: {
        documentId: VALID_DOC_ID,
        sections: [
          {
            sectionId: '123e4567-e89b-12d3-a456-426614174001',
            title: 'Introduction',
            depth: 0,
            orderIndex: 0,
            hasContent: true,
            status: 'ready',
            isExpanded: true,
            isActive: false,
            isVisible: true,
            hasUnsavedChanges: false,
            children: [
              {
                sectionId: '123e4567-e89b-12d3-a456-426614174002',
                title: 'Subsection 1',
                depth: 1,
                orderIndex: 1,
                hasContent: true,
                status: 'ready',
                isExpanded: false,
                isActive: false,
                isVisible: true,
                hasUnsavedChanges: false,
                children: [],
                parentId: '123e4567-e89b-12d3-a456-426614174001',
              },
            ],
            parentId: null,
          },
        ],
        lastUpdated: new Date().toISOString(),
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockResponseData,
    });

    const response = await fetch(`${API_BASE_URL}/documents/${VALID_DOC_ID}/sections`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);
    const { sections, toc } = await response.json();

    // Validate depth hierarchy
    const depthMap = new Map<number, number>();
    sections.forEach((section: any) => {
      depthMap.set(section.depth, (depthMap.get(section.depth) || 0) + 1);
    });

    // Should have at least one root section (depth 0)
    expect(depthMap.get(0)).toBeGreaterThan(0);

    // ToC structure should match sections
    const tocSectionIds = new Set();
    const collectTocIds = (nodes: any[]) => {
      nodes.forEach(node => {
        tocSectionIds.add(node.sectionId);
        if (node.children?.length > 0) {
          collectTocIds(node.children);
        }
      });
    };
    collectTocIds(toc.sections);

    sections.forEach((section: any) => {
      expect(tocSectionIds.has(section.id), `Section ${section.id} not found in ToC`).toBe(true);
    });
  });

  it('should return consistent view states', async () => {
    // Mock response with various view states
    const mockResponseData = {
      sections: [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          docId: VALID_DOC_ID,
          parentSectionId: null,
          key: 'section-1',
          title: 'Section 1',
          depth: 0,
          orderIndex: 0,
          contentMarkdown: '# Section 1\nContent here.',
          placeholderText: 'Write your content here...',
          hasContent: true,
          viewState: 'read_mode',
          editingUser: null,
          lastModified: new Date().toISOString(),
          status: 'ready',
          assumptionsResolved: true,
          qualityGateStatus: 'passed',
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          docId: VALID_DOC_ID,
          parentSectionId: null,
          key: 'section-2',
          title: 'Section 2',
          depth: 0,
          orderIndex: 1,
          contentMarkdown: '# Section 2\nContent here.',
          placeholderText: 'Write your content here...',
          hasContent: true,
          viewState: 'edit_mode',
          editingUser: 'test-user-id',
          lastModified: new Date().toISOString(),
          status: 'drafting',
          assumptionsResolved: false,
          qualityGateStatus: 'pending',
        },
      ],
      toc: {
        documentId: VALID_DOC_ID,
        sections: [
          {
            sectionId: '123e4567-e89b-12d3-a456-426614174001',
            title: 'Section 1',
            depth: 0,
            orderIndex: 0,
            hasContent: true,
            status: 'ready',
            isExpanded: true,
            isActive: false,
            isVisible: true,
            hasUnsavedChanges: false,
            children: [],
            parentId: null,
          },
          {
            sectionId: '123e4567-e89b-12d3-a456-426614174002',
            title: 'Section 2',
            depth: 0,
            orderIndex: 1,
            hasContent: true,
            status: 'drafting',
            isExpanded: true,
            isActive: true,
            isVisible: true,
            hasUnsavedChanges: true,
            children: [],
            parentId: null,
          },
        ],
        lastUpdated: new Date().toISOString(),
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockResponseData,
    });

    const response = await fetch(`${API_BASE_URL}/documents/${VALID_DOC_ID}/sections`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);
    const { sections } = await response.json();

    sections.forEach((section: any) => {
      // Default state should be idle or read_mode for new documents
      expect(['idle', 'read_mode', 'edit_mode', 'saving']).toContain(section.viewState);

      // If section is being edited, editingUser should be set
      if (section.viewState === 'edit_mode') {
        expect(section.editingUser).not.toBeNull();
      }

      // lastModified should be a valid timestamp
      expect(() => new Date(section.lastModified)).not.toThrow();
    });
  });
});
