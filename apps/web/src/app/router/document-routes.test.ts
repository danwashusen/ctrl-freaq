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

type LoaderFunctionArgsWithPattern = LoaderFunctionArgs & {
  unstable_pattern?: LoaderFunctionArgs extends { unstable_pattern: infer T }
    ? T
    : Record<string, never>;
};

const buildLoaderArgs = (
  overrides?: Partial<LoaderFunctionArgsWithPattern> & { search?: string }
): LoaderFunctionArgs => {
  const controller = new AbortController();
  const url = new URL('http://localhost/documents/doc-123');
  if (overrides?.search) {
    url.search = overrides.search;
  }
  const defaultRequest = new Request(url, { signal: controller.signal });

  const loaderArgs = {
    params: overrides?.params ?? {
      documentId: 'doc-123',
      sectionId: 'sec-777',
    },
    request: overrides?.request ?? defaultRequest,
    context: overrides?.context ?? {},
  } as LoaderFunctionArgsWithPattern;

  if (
    overrides?.unstable_pattern ||
    // Newer React Router versions require unstable_pattern;
    // older versions simply ignore the extra field.
    'unstable_pattern' in loaderArgs
  ) {
    loaderArgs.unstable_pattern =
      overrides?.unstable_pattern ?? ({} as LoaderFunctionArgsWithPattern['unstable_pattern']);
  }

  return loaderArgs;
};

describe('documentRouteLoader', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses the API client with auth token to load document and sections', async () => {
    const args = buildLoaderArgs();
    const documentPayload = {
      document: {
        id: 'doc-123',
        projectId: 'project-777',
        title: 'Architecture',
        content: null,
        templateId: 'tmpl-123',
        templateVersion: '1.0.0',
        templateSchemaHash: 'hash-abc',
      },
      migration: null,
      templateDecision: null,
    };
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

    expect(result.projectId).toBe('project-777');
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

  it('preserves projectId from the request when returning a missing snapshot', async () => {
    const args = buildLoaderArgs({ search: '?projectId=project-123' });
    const error = new Error('Not found') as MockApiError;
    error.status = 404;

    mockGetDocument.mockRejectedValueOnce(error);

    const result = await documentRouteLoader(args);

    expect(result.projectId).toBe('project-123');
    expect(result.missingReason).toBe('not_found');
  });

  it('propagates unauthorized responses as loader errors', async () => {
    const args = buildLoaderArgs();
    const error = new Error('Unauthorized') as MockApiError;
    error.status = 401;

    mockGetDocument.mockRejectedValueOnce(error);

    await expect(documentRouteLoader(args)).rejects.toHaveProperty('status', 401);
  });
});
