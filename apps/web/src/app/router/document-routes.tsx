import { Suspense, lazy, useMemo } from 'react';
import {
  Navigate,
  type LoaderFunctionArgs,
  useLoaderData,
  useRouteError,
  useParams,
  type RouteObject,
} from 'react-router-dom';

import DocumentMissing from '@/components/document-missing';
const DocumentEditor = lazy(() => import('@/features/document-editor/components/document-editor'));
import { getDocumentFixture, getSectionFixture, type DocumentFixture } from '@/lib/fixtures/e2e';
import { isE2EModeEnabled } from '@/lib/fixtures/e2e/fixture-provider';

export interface DocumentRouteLoaderData {
  documentId: string;
  sectionId: string;
  fixtureDocument?: DocumentFixture;
  missingReason?: 'fixture';
}

export async function documentRouteLoader({ params, request }: LoaderFunctionArgs) {
  const documentId = params.documentId;
  const sectionId = params.sectionId;

  if (!documentId || !sectionId) {
    throw new Response('Document and section identifiers are required.', {
      status: 400,
    });
  }

  const url = request instanceof Request ? new URL(request.url) : null;
  const fixtureOverride = url?.searchParams.get('fixture');
  const shouldUseFixtures = isE2EModeEnabled() || typeof fixtureOverride === 'string';

  if (shouldUseFixtures) {
    try {
      const document = getDocumentFixture(documentId);
      const section = getSectionFixture(documentId, sectionId);
      return {
        documentId,
        sectionId: section.id,
        fixtureDocument: document,
      } satisfies DocumentRouteLoaderData;
    } catch {
      return {
        documentId,
        sectionId,
        missingReason: 'fixture',
      } satisfies DocumentRouteLoaderData;
    }
  }

  return {
    documentId,
    sectionId,
  } satisfies DocumentRouteLoaderData;
}

function DocumentEditorRoute() {
  const data = useLoaderData() as DocumentRouteLoaderData | undefined;

  const editorProps = useMemo(() => {
    if (!data) {
      return null;
    }

    if (data.missingReason === 'fixture') {
      return { missing: true } as const;
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
    return <DocumentMissing documentId={data?.documentId} sectionId={data?.sectionId} />;
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

  if (error instanceof Response && error.status === 404) {
    return <DocumentMissing documentId={params.documentId} sectionId={params.sectionId} />;
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
