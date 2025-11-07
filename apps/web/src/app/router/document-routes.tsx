import { Suspense, lazy, useMemo } from 'react';
import {
  Navigate,
  type LoaderFunctionArgs,
  useLoaderData,
  useRouteError,
  useParams,
  useLocation,
  type RouteObject,
} from 'react-router-dom';

import DocumentMissing from '@/components/document-missing';
const DocumentEditor = lazy(() => import('@/features/document-editor/components/document-editor'));
import { getDocumentFixture, getSectionFixture, type DocumentFixture } from '@/lib/fixtures/e2e';
import { isE2EModeEnabled } from '@/lib/fixtures/e2e/fixture-provider';
import { createApiClient, type ApiError } from '@/lib/api';
import type ApiClient from '@/lib/api';
import { getLoaderAuthToken } from '@/lib/auth-provider/loader-auth';

type LoaderDocumentResponse = Awaited<ReturnType<ApiClient['getDocument']>>;
type LoaderDocumentSectionsResponse = Awaited<ReturnType<ApiClient['getDocumentSections']>>;

export interface DocumentRouteLoaderData {
  documentId: string;
  sectionId: string;
  projectId?: string;
  fixtureDocument?: DocumentFixture;
  missingReason?: 'fixture' | 'not_found';
  bootstrap?: {
    document: LoaderDocumentResponse;
    sections: LoaderDocumentSectionsResponse;
  };
}

export async function documentRouteLoader({
  params,
  request,
}: LoaderFunctionArgs): Promise<DocumentRouteLoaderData> {
  const documentId = params.documentId;
  const sectionId = params.sectionId;

  if (!documentId || !sectionId) {
    throw new Response('Document and section identifiers are required.', {
      status: 400,
    });
  }

  const url = request instanceof Request ? new URL(request.url) : null;
  const fixtureOverride = url?.searchParams.get('fixture');
  const routeProjectId = url?.searchParams.get('projectId') ?? undefined;
  const shouldUseFixtures = isE2EModeEnabled() || typeof fixtureOverride === 'string';

  if (shouldUseFixtures) {
    try {
      const document = getDocumentFixture(documentId);
      const section = getSectionFixture(documentId, sectionId);
      return {
        documentId,
        sectionId: section.id,
        fixtureDocument: document,
        projectId:
          (document as DocumentFixture & { projectId?: string }).projectId ?? routeProjectId,
      } satisfies DocumentRouteLoaderData;
    } catch {
      return {
        documentId,
        sectionId,
        projectId: routeProjectId,
        missingReason: 'fixture',
      } satisfies DocumentRouteLoaderData;
    }
  }

  const resolveApiBaseUrl = () => {
    const configured = (import.meta.env?.VITE_API_BASE_URL as string | undefined) ?? '';
    const trimmed = configured.trim();
    const base = trimmed.length > 0 ? trimmed : 'http://localhost:5001/api/v1';
    return base.replace(/\/+$/, '');
  };

  const apiBaseUrl = resolveApiBaseUrl();
  const apiClient = createApiClient({
    baseUrl: apiBaseUrl,
    getAuthToken: getLoaderAuthToken,
  });

  const handleApiError = (
    error: unknown,
    context: 'document' | 'sections'
  ): DocumentRouteLoaderData => {
    if (error instanceof Response) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    const apiError = error as ApiError | undefined;
    const status = apiError?.status;

    if (status === 401) {
      throw new Response('Unauthorized', { status: 401 });
    }

    if (status === 404) {
      return {
        documentId,
        sectionId,
        projectId: routeProjectId,
        missingReason: 'not_found',
      } satisfies DocumentRouteLoaderData;
    }

    const message =
      context === 'document'
        ? 'Failed to load document metadata'
        : 'Failed to load document sections';

    throw new Response(message, { status: 502 });
  };

  let documentPayload: LoaderDocumentResponse;
  try {
    documentPayload = await apiClient.getDocument(documentId, {
      signal: request.signal,
    });
  } catch (error) {
    return handleApiError(error, 'document');
  }

  let sectionsPayload: LoaderDocumentSectionsResponse;
  try {
    sectionsPayload = await apiClient.getDocumentSections(documentId, {
      signal: request.signal,
    });
  } catch (error) {
    return handleApiError(error, 'sections');
  }

  return {
    documentId,
    sectionId,
    projectId: documentPayload.document.projectId ?? routeProjectId,
    bootstrap: {
      document: documentPayload,
      sections: sectionsPayload,
    },
  } satisfies DocumentRouteLoaderData;
}

function DocumentEditorRoute() {
  const data = useLoaderData() as DocumentRouteLoaderData | undefined;

  const editorProps = useMemo(() => {
    if (!data) {
      return null;
    }

    if (data.missingReason === 'fixture' || data.missingReason === 'not_found') {
      return { missing: true, reason: data.missingReason } as const;
    }

    const { documentId, sectionId, fixtureDocument } = data;
    return {
      missing: false,
      documentId,
      initialSectionId: sectionId,
      fixtureDocument,
    };
  }, [data]);

  if (!editorProps) {
    return <Navigate to="/dashboard" replace />;
  }

  if (editorProps.missing) {
    if (editorProps.reason === 'not_found') {
      return (
        <DocumentMissing
          documentId={data?.documentId}
          sectionId={data?.sectionId}
          projectId={data?.projectId}
        />
      );
    }
    return (
      <DocumentMissing
        documentId={data?.documentId}
        sectionId={data?.sectionId}
        title="Fixture data unavailable"
        supportingCopy="We could not locate deterministic fixtures for the requested document. Return to the dashboard and re-launch the deep link once fixtures are refreshed."
        showProvisionAction={false}
      />
    );
  }

  const { documentId, initialSectionId, fixtureDocument } = editorProps;
  return (
    <Suspense fallback={null}>
      <DocumentEditor
        documentId={documentId}
        initialSectionId={initialSectionId}
        fixtureDocument={fixtureDocument}
      />
    </Suspense>
  );
}

function DocumentRouteErrorBoundary() {
  const error = useRouteError();
  const params = useParams();
  const location = useLocation();
  const projectIdFromSearch = (() => {
    if (!location.search) {
      return undefined;
    }
    const params = new URLSearchParams(location.search);
    return params.get('projectId') ?? undefined;
  })();

  if (error instanceof Response && error.status === 404) {
    return (
      <DocumentMissing
        documentId={params.documentId}
        sectionId={params.sectionId}
        projectId={projectIdFromSearch}
      />
    );
  }

  return <Navigate to="/dashboard" replace />;
}

export const documentRoutes: RouteObject[] = [
  {
    path: '/documents/:documentId/sections/:sectionId',
    loader: documentRouteLoader,
    element: <DocumentEditorRoute />,
    errorElement: <DocumentRouteErrorBoundary />,
  },
];
