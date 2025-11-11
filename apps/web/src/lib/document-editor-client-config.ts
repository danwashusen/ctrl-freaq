import type { ApiClientOptions } from './api';

type DocumentEditorGetToken = () => Promise<string | null>;
type DocumentEditorFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type DocumentEditorEventSourceFactory = (url: string, init?: EventSourceInit) => EventSource;

export interface DocumentEditorClientConfig {
  baseUrl: string;
  getAuthToken: DocumentEditorGetToken;
  fetchImpl?: DocumentEditorFetch;
  eventSourceFactory?: DocumentEditorEventSourceFactory;
}

let currentConfig: DocumentEditorClientConfig | null = null;

const normalizeBaseUrl = (input: string): string => {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error('Document editor API base URL cannot be empty.');
  }
  return trimmed.replace(/\/+$/, '');
};

const resolveGlobalFetch = (): DocumentEditorFetch => {
  if (typeof fetch !== 'function') {
    throw new Error(
      'Global fetch is unavailable. Provide a fetch implementation via configureDocumentEditorClients().'
    );
  }
  return fetch.bind(globalThis) as DocumentEditorFetch;
};

export const configureDocumentEditorClients = (config: DocumentEditorClientConfig): void => {
  const normalizedBaseUrl = normalizeBaseUrl(config.baseUrl);
  const getAuthToken: DocumentEditorGetToken =
    typeof config.getAuthToken === 'function' ? config.getAuthToken : async () => null;

  currentConfig = {
    baseUrl: normalizedBaseUrl,
    getAuthToken,
    fetchImpl: config.fetchImpl,
    eventSourceFactory: config.eventSourceFactory,
  };
};

export const resetDocumentEditorClientConfig = (): void => {
  currentConfig = null;
};

const requireDocumentEditorClientConfig = (): DocumentEditorClientConfig => {
  if (!currentConfig) {
    throw new Error(
      'Document editor clients are not configured. Wrap your tree in <ApiProvider> or call configureDocumentEditorClients() before using document-editor services.'
    );
  }
  return currentConfig;
};

export const getDocumentEditorClientConfig = (): DocumentEditorClientConfig => {
  return requireDocumentEditorClientConfig();
};

export const createDocumentEditorApiClientOptions = (
  overrides: ApiClientOptions = {}
): ApiClientOptions => {
  const config = requireDocumentEditorClientConfig();
  return {
    baseUrl: overrides.baseUrl ?? config.baseUrl,
    getAuthToken: overrides.getAuthToken ?? config.getAuthToken,
  };
};

export const getDocumentEditorFetchImpl = (): DocumentEditorFetch => {
  const config = requireDocumentEditorClientConfig();
  return config.fetchImpl ?? resolveGlobalFetch();
};

export const getDocumentEditorEventSourceFactory = (): DocumentEditorEventSourceFactory => {
  const config = requireDocumentEditorClientConfig();
  return (
    config.eventSourceFactory ??
    ((url: string, init?: EventSourceInit) => new EventSource(url, init))
  );
};
