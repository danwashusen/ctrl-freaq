import { buildApiUrl } from './co-authoring.client';
import {
  getDocumentEditorClientConfig,
  getDocumentEditorFetchImpl,
} from '@/lib/document-editor-client-config';

const resolveFetchImpl = (override?: typeof fetch): typeof fetch => {
  if (override) {
    return override;
  }
  return getDocumentEditorFetchImpl();
};

const createJsonRequest = async (
  payload: Record<string, unknown>,
  signal?: AbortSignal,
  fetchOverride?: typeof fetch
) => {
  const config = getDocumentEditorClientConfig();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = await config.getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return {
    fetchImpl: resolveFetchImpl(fetchOverride),
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
      credentials: 'include' as RequestCredentials,
    },
  };
};

const readJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) {
    throw new Error('Empty response body');
  }
  return JSON.parse(text) as T;
};

const extractStreamLocation = (response: Response): string | null => {
  return response.headers.get('hx-stream-location');
};

export interface DocumentQaReviewRequest {
  documentId: string;
  sectionId: string;
  reviewerId: string;
  sessionId: string;
  prompt: string;
}

export interface DocumentQaQueueMetadata {
  disposition: 'started' | 'pending';
  concurrencySlot?: number;
  replacedSessionId: string | null;
  replacementPolicy: 'newest_replaces_pending';
}

export interface DocumentQaReviewResponseBody {
  status: 'accepted';
  sessionId: string;
  queue: DocumentQaQueueMetadata;
  delivery: {
    mode: 'streaming' | 'fallback';
    reason: string | null;
  };
}

export interface DocumentQaRetryResponseBody {
  status: 'requeued';
  previousSessionId: string;
  sessionId: string;
  queue: DocumentQaQueueMetadata;
}

export interface DocumentQaCancelResponseBody {
  status: 'canceled' | 'not_found';
  cancelReason: 'author_cancelled' | 'replaced_by_new_request' | 'transport_failure' | 'deferred';
  promotedSessionId: string | null;
}

export const postDocumentQaReview = async (
  payload: DocumentQaReviewRequest,
  options?: { fetchImpl?: typeof fetch; signal?: AbortSignal }
): Promise<{ body: DocumentQaReviewResponseBody; streamLocation: string | null }> => {
  const url = buildApiUrl(
    `/documents/${payload.documentId}/sections/${payload.sectionId}/document-qa/review`
  );

  const { fetchImpl, init } = await createJsonRequest(
    {
      reviewerId: payload.reviewerId,
      sessionId: payload.sessionId,
      prompt: payload.prompt,
    },
    options?.signal,
    options?.fetchImpl
  );
  const response = await fetchImpl(url, init);

  if (!response.ok) {
    throw new Error(`Document QA review request failed with status ${response.status}`);
  }

  const body = await readJson<DocumentQaReviewResponseBody>(response);
  return {
    body,
    streamLocation: extractStreamLocation(response),
  };
};

export const postDocumentQaCancel = async (
  payload: {
    documentId: string;
    sectionId: string;
    sessionId: string;
    reason: DocumentQaCancelResponseBody['cancelReason'];
  },
  options?: { fetchImpl?: typeof fetch; signal?: AbortSignal }
): Promise<DocumentQaCancelResponseBody> => {
  const url = buildApiUrl(
    `/documents/${payload.documentId}/sections/${payload.sectionId}/document-qa/sessions/${payload.sessionId}/cancel`
  );

  const { fetchImpl, init } = await createJsonRequest(
    {
      reason: payload.reason,
    },
    options?.signal,
    options?.fetchImpl
  );
  const response = await fetchImpl(url, init);

  if (!response.ok) {
    throw new Error(`Document QA cancel request failed with status ${response.status}`);
  }

  return readJson<DocumentQaCancelResponseBody>(response);
};

export const postDocumentQaRetry = async (
  payload: {
    documentId: string;
    sectionId: string;
    sessionId: string;
  },
  options?: { fetchImpl?: typeof fetch; signal?: AbortSignal }
): Promise<{ body: DocumentQaRetryResponseBody; streamLocation: string | null }> => {
  const url = buildApiUrl(
    `/documents/${payload.documentId}/sections/${payload.sectionId}/document-qa/sessions/${payload.sessionId}/retry`
  );

  const { fetchImpl, init } = await createJsonRequest({}, options?.signal, options?.fetchImpl);
  const response = await fetchImpl(url, init);

  if (!response.ok) {
    throw new Error(`Document QA retry request failed with status ${response.status}`);
  }

  const body = await readJson<DocumentQaRetryResponseBody>(response);
  return {
    body,
    streamLocation: extractStreamLocation(response),
  };
};
