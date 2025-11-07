import { describe, beforeEach, expect, it, vi } from 'vitest';
import type { LoaderFunctionArgs } from 'react-router-dom';

type MockApiError = Error & { status?: number };

const mocks = vi.hoisted(() => {
  const getDocument = vi.fn();
  const getDocumentSections = vi.fn();
  const createApiClient = vi.fn(() => ({
    getDocument,
    getDocumentSections,
  }));
  const getLoaderAuthToken = vi.fn(async () => 'mock-token');

  return {
    getDocument,
    getDocumentSections,
    createApiClient,
    getLoaderAuthToken,
  };
});

const mockGetDocument = mocks.getDocument;
const mockGetDocumentSections = mocks.getDocumentSections;
const mockCreateApiClient = mocks.createApiClient;
const mockGetLoaderAuthToken = mocks.getLoaderAuthToken;

vi.mock('@/lib/fixtures/e2e', () => ({
  getDocumentFixture: vi.fn(),
  getSectionFixture: vi.fn(),
}));

vi.mock('@/lib/fixtures/e2e/fixture-provider', () => ({
  isE2EModeEnabled: () => false,
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  createApiClient: mocks.createApiClient,
  default: class {},
}));

vi.mock('@/lib/auth-provider/loader-auth', () => ({
  getLoaderAuthToken: mocks.getLoaderAuthToken,
}));

import { documentRouteLoader } from './document-routes';

const buildLoaderArgs = (overrides?: Partial<LoaderFunctionArgs>): LoaderFunctionArgs => {
  const controller = new AbortController();
  const defaultRequest = new Request('http://localhost/documents/doc-123', {
    signal: controller.signal,
  });

  return {
    params: overrides?.params ?? {
      documentId: 'doc-123',
      sectionId: 'sec-777',
    },
    request: overrides?.request ?? defaultRequest,
    context: overrides?.context ?? {},
  };
};

describe('documentRouteLoader', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses the API client with auth token to load document and sections', async () => {
    const args = buildLoaderArgs();
    const documentPayload = { id: 'doc-123', title: 'Architecture' };
    const sectionsPayload = [{ id: 'sec-777' }];

    mockGetDocument.mockResolvedValueOnce(documentPayload);
    mockGetDocumentSections.mockResolvedValueOnce(sectionsPayload);

    const result = await documentRouteLoader(args);

    expect(mockCreateApiClient).toHaveBeenCalledTimes(1);
    expect(mockCreateApiClient).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: expect.any(String),
        getAuthToken: mockGetLoaderAuthToken,
      })
    );

    expect(mockGetDocument).toHaveBeenCalledWith('doc-123', {
      signal: args.request.signal,
    });
    expect(mockGetDocumentSections).toHaveBeenCalledWith('doc-123', {
      signal: args.request.signal,
    });

    expect(result.bootstrap?.document).toBe(documentPayload);
    expect(result.bootstrap?.sections).toBe(sectionsPayload);
    expect(result.missingReason).toBeUndefined();
  });

  it('returns a missing state when the document is not found', async () => {
    const args = buildLoaderArgs();
    const error = new Error('Not found') as MockApiError;
    error.status = 404;

    mockGetDocument.mockRejectedValueOnce(error);

    const result = await documentRouteLoader(args);

    expect(result.missingReason).toBe('not_found');
    expect(result.documentId).toBe('doc-123');
    expect(mockGetDocumentSections).not.toHaveBeenCalled();
  });

  it('propagates unauthorized responses as loader errors', async () => {
    const args = buildLoaderArgs();
    const error = new Error('Unauthorized') as MockApiError;
    error.status = 401;

    mockGetDocument.mockRejectedValueOnce(error);

    await expect(documentRouteLoader(args)).rejects.toHaveProperty('status', 401);
  });
});
