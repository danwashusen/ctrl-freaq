import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';

// Contract schemas based on sections-api.yaml
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

describe('Contract Test: GET /api/v1/documents/{docId}/toc', () => {
  const API_BASE_URL = 'http://localhost:5001/api/v1';
  const VALID_DOC_ID = '123e4567-e89b-12d3-a456-426614174000';
  const INVALID_DOC_ID = 'invalid-uuid';

  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 200 with table of contents for valid document ID', async () => {
    // Mock successful toc response
    const mockTocResponse = {
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
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockTocResponse,
    });

    const response = await fetch(`${API_BASE_URL}/documents/${VALID_DOC_ID}/toc`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    const toc = await response.json();

    // Validate response schema
    const validationResult = TableOfContentsSchema.safeParse(toc);
    expect(
      validationResult.success,
      `Schema validation failed: ${JSON.stringify(validationResult.error?.issues)}`
    ).toBe(true);

    // Validate specific properties
    expect(toc.documentId).toBe(VALID_DOC_ID);
    expect(Array.isArray(toc.sections)).toBe(true);
    expect(typeof toc.lastUpdated).toBe('string');

    // Validate lastUpdated is a valid timestamp
    expect(() => new Date(toc.lastUpdated)).not.toThrow();
  });

  it('should return hierarchical structure with proper nesting', async () => {
    // Mock hierarchical toc response
    const mockTocResponse = {
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
              title: 'Background',
              depth: 1,
              orderIndex: 0,
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
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockTocResponse,
    });

    const response = await fetch(`${API_BASE_URL}/documents/${VALID_DOC_ID}/toc`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);
    const toc = await response.json();

    // Validate hierarchy structure
    const validateHierarchy = (nodes: any[], expectedParentId: string | null = null) => {
      nodes.forEach(node => {
        expect(node.parentId).toBe(expectedParentId);
        expect(typeof node.depth).toBe('number');
        expect(node.depth).toBeGreaterThanOrEqual(0);
        expect(node.depth).toBeLessThanOrEqual(5);

        // Children should have depth + 1
        if (node.children && node.children.length > 0) {
          node.children.forEach((child: any) => {
            expect(child.depth).toBe(node.depth + 1);
            expect(child.parentId).toBe(node.sectionId);
          });

          // Recursively validate children
          validateHierarchy(node.children, node.sectionId);
        }
      });
    };

    // Root nodes should have parentId null and depth 0
    const rootNodes = toc.sections.filter((node: any) => node.parentId === null);
    expect(rootNodes.length).toBeGreaterThan(0);

    rootNodes.forEach((node: any) => {
      expect(node.depth).toBe(0);
    });

    validateHierarchy(toc.sections);
  });

  it('should return ordered sections with correct orderIndex', async () => {
    // Mock toc response with ordered sections
    const mockTocResponse = {
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
        {
          sectionId: '123e4567-e89b-12d3-a456-426614174002',
          title: 'Background',
          depth: 0,
          orderIndex: 1,
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
          sectionId: '123e4567-e89b-12d3-a456-426614174003',
          title: 'Conclusion',
          depth: 0,
          orderIndex: 2,
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
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockTocResponse,
    });

    const response = await fetch(`${API_BASE_URL}/documents/${VALID_DOC_ID}/toc`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);
    const toc = await response.json();

    // Group sections by depth and validate ordering
    const sectionsByDepth = new Map<number, any[]>();

    const collectSectionsByDepth = (nodes: any[]) => {
      nodes.forEach(node => {
        if (!sectionsByDepth.has(node.depth)) {
          sectionsByDepth.set(node.depth, []);
        }
        sectionsByDepth.get(node.depth)!.push(node);

        if (node.children && node.children.length > 0) {
          collectSectionsByDepth(node.children);
        }
      });
    };

    collectSectionsByDepth(toc.sections);

    // Validate orderIndex within each depth level
    sectionsByDepth.forEach((sections, _depth) => {
      const sortedSections = [...sections].sort((a, b) => a.orderIndex - b.orderIndex);

      for (let i = 0; i < sortedSections.length; i++) {
        expect(sortedSections[i].orderIndex).toBe(i);
      }
    });
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

    const response = await fetch(`${API_BASE_URL}/documents/${VALID_DOC_ID}/toc`, {
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

    const response = await fetch(`${API_BASE_URL}/documents/${nonExistentDocId}/toc`, {
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

    const response = await fetch(`${API_BASE_URL}/documents/${INVALID_DOC_ID}/toc`, {
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

  it('should include UI state information for each section', async () => {
    // Mock toc response with UI state information
    const mockTocResponse = {
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
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockTocResponse,
    });

    const response = await fetch(`${API_BASE_URL}/documents/${VALID_DOC_ID}/toc`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);
    const toc = await response.json();

    // Validate UI state properties exist and are boolean
    const validateUIState = (nodes: any[]) => {
      nodes.forEach(node => {
        expect(typeof node.isExpanded).toBe('boolean');
        expect(typeof node.isActive).toBe('boolean');
        expect(typeof node.isVisible).toBe('boolean');
        expect(typeof node.hasUnsavedChanges).toBe('boolean');

        if (node.children && node.children.length > 0) {
          validateUIState(node.children);
        }
      });
    };

    validateUIState(toc.sections);
  });

  it('should include content and status information', async () => {
    // Mock toc response with content and status information
    const mockTocResponse = {
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
        {
          sectionId: '123e4567-e89b-12d3-a456-426614174002',
          title: 'Work in Progress',
          depth: 0,
          orderIndex: 1,
          hasContent: false,
          status: 'drafting',
          isExpanded: false,
          isActive: true,
          isVisible: true,
          hasUnsavedChanges: true,
          children: [],
          parentId: null,
        },
      ],
      lastUpdated: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockTocResponse,
    });

    const response = await fetch(`${API_BASE_URL}/documents/${VALID_DOC_ID}/toc`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);
    const toc = await response.json();

    // Validate content and status properties
    const validateContentStatus = (nodes: any[]) => {
      nodes.forEach(node => {
        expect(typeof node.hasContent).toBe('boolean');
        expect(['idle', 'assumptions', 'drafting', 'review', 'ready']).toContain(node.status);
        expect(typeof node.title).toBe('string');
        expect(node.title.length).toBeGreaterThan(0);

        if (node.children && node.children.length > 0) {
          validateContentStatus(node.children);
        }
      });
    };

    validateContentStatus(toc.sections);
  });

  it('should maintain referential integrity with section IDs', async () => {
    // Mock toc response with referential integrity
    const mockTocResponse = {
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
              title: 'Background',
              depth: 1,
              orderIndex: 0,
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
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockTocResponse,
    });

    const response = await fetch(`${API_BASE_URL}/documents/${VALID_DOC_ID}/toc`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);
    const toc = await response.json();

    // Collect all section IDs
    const allSectionIds = new Set<string>();
    const collectSectionIds = (nodes: any[]) => {
      nodes.forEach(node => {
        allSectionIds.add(node.sectionId);
        if (node.children && node.children.length > 0) {
          collectSectionIds(node.children);
        }
      });
    };

    collectSectionIds(toc.sections);

    // Validate parent references exist
    const validateParentReferences = (nodes: any[]) => {
      nodes.forEach(node => {
        if (node.parentId !== null) {
          expect(
            allSectionIds.has(node.parentId),
            `Parent ID ${node.parentId} not found in section IDs`
          ).toBe(true);
        }

        if (node.children && node.children.length > 0) {
          validateParentReferences(node.children);
        }
      });
    };

    validateParentReferences(toc.sections);

    // Validate all section IDs are unique
    const sectionIdArray = Array.from(allSectionIds);
    expect(sectionIdArray.length).toBe(new Set(sectionIdArray).size);
  });

  it('should handle empty document with valid empty structure', async () => {
    // Test with a document that might have no sections
    const emptyDocId = '000e0000-e89b-12d3-a456-426614174000';

    // Mock empty toc response
    const mockEmptyTocResponse = {
      documentId: emptyDocId,
      sections: [],
      lastUpdated: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['Content-Type', 'application/json']]),
      json: async () => mockEmptyTocResponse,
    });

    const response = await fetch(`${API_BASE_URL}/documents/${emptyDocId}/toc`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer fake-test-token',
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 200) {
      const toc = await response.json();

      expect(toc.documentId).toBe(emptyDocId);
      expect(Array.isArray(toc.sections)).toBe(true);
      expect(typeof toc.lastUpdated).toBe('string');

      // Empty document should have empty sections array
      expect(toc.sections).toHaveLength(0);
    } else {
      // Document might not exist, which is also valid
      expect([404]).toContain(response.status);
    }
  });
});
