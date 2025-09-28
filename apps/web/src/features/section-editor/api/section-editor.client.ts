import { logger } from '@/lib/logger';

import {
  parseConflictCheckResponse,
  parseConflictLogListResponse,
  parseSectionDiffResponse,
  parseSectionDraftResponse,
  parseReviewSubmissionResponse,
  parseApprovalResponse,
} from './section-editor.mappers';
import type {
  ConflictCheckResponseDTO,
  ConflictLogListResponseDTO,
  DiffResponseDTO,
  FormattingAnnotationDTO,
  ReviewSubmissionResponseDTO,
  SectionDraftResponseDTO,
  ApprovalResponseDTO,
} from './section-editor.mappers';

export type ConflictTriggerSource = 'entry' | 'save';

export interface ConflictCheckRequestPayload {
  draftBaseVersion: number;
  draftVersion: number;
  approvedVersion?: number;
  requestId?: string;
  triggeredBy?: ConflictTriggerSource;
}

export interface SaveDraftRequestPayload {
  contentMarkdown: string;
  draftVersion: number;
  draftBaseVersion: number;
  summaryNote?: string;
  formattingAnnotations?: FormattingAnnotationDTO[];
  clientTimestamp?: string;
}

export interface SubmitDraftRequestPayload {
  draftId: string;
  summaryNote: string;
  reviewers?: string[];
}

export interface ApproveSectionRequestPayload {
  draftId: string;
  approvalNote?: string;
}

export interface SectionEditorClientOptions {
  baseUrl?: string;
  getAuthToken?: () => Promise<string | null>;
  fetch?: typeof fetch;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
  headers?: HeadersInit;
}

interface ErrorPayload {
  message?: string;
  code?: string;
  details?: unknown;
}

const DEFAULT_BASE_URL =
  (import.meta?.env?.VITE_API_BASE_URL as string | undefined) || 'http://localhost:5001/api/v1';

const RESPONSE_CONTENT_TYPE = 'application/json';

export class SectionEditorClientError extends Error {
  status: number;
  requestId?: string;
  body?: unknown;
  code?: string;

  constructor(
    message: string,
    options: { status: number; requestId?: string; body?: unknown; code?: string }
  ) {
    super(message);
    this.name = 'SectionEditorClientError';
    this.status = options.status;
    this.requestId = options.requestId;
    this.body = options.body;
    this.code = options.code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SectionEditorConflictError extends SectionEditorClientError {
  conflict: ConflictCheckResponseDTO;

  constructor(conflict: ConflictCheckResponseDTO, requestId?: string) {
    super(conflict.conflictReason ?? 'Section draft conflict detected', {
      status: 409,
      requestId,
      body: conflict,
      code: 'section_draft_conflict',
    });
    this.name = 'SectionEditorConflictError';
    this.conflict = conflict;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SectionEditorClient {
  private readonly baseUrl: string;
  private readonly getAuthToken?: () => Promise<string | null>;
  private readonly fetchImpl: typeof fetch;
  private requestId: string;

  constructor(options: SectionEditorClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.getAuthToken = options.getAuthToken;

    const fetchFn = options.fetch ?? fetch;
    const boundFetch = options.fetch ? fetchFn : fetchFn.bind(globalThis);
    this.fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) =>
      boundFetch(input, init)) as typeof fetch;

    this.requestId = this.generateRequestId();
  }

  async checkConflicts(
    sectionId: string,
    payload: ConflictCheckRequestPayload,
    options: { signal?: AbortSignal } = {}
  ): Promise<ConflictCheckResponseDTO> {
    return this.request(
      `/sections/${encodeURIComponent(sectionId)}/conflicts/check`,
      {
        method: 'POST',
        body: payload,
        signal: options.signal,
      },
      parseConflictCheckResponse
    );
  }

  async saveDraft(
    sectionId: string,
    payload: SaveDraftRequestPayload,
    options: { signal?: AbortSignal } = {}
  ): Promise<SectionDraftResponseDTO> {
    return this.request(
      `/sections/${encodeURIComponent(sectionId)}/drafts`,
      {
        method: 'POST',
        body: payload,
        signal: options.signal,
      },
      parseSectionDraftResponse
    );
  }

  async getDiff(
    sectionId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<DiffResponseDTO> {
    return this.request(
      `/sections/${encodeURIComponent(sectionId)}/diff`,
      {
        method: 'GET',
        signal: options.signal,
      },
      parseSectionDiffResponse
    );
  }

  async submitDraft(
    sectionId: string,
    payload: SubmitDraftRequestPayload,
    options: { signal?: AbortSignal } = {}
  ): Promise<ReviewSubmissionResponseDTO> {
    return this.request(
      `/sections/${encodeURIComponent(sectionId)}/submit`,
      {
        method: 'POST',
        body: payload,
        signal: options.signal,
      },
      parseReviewSubmissionResponse
    );
  }

  async listConflictLogs(
    sectionId: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<ConflictLogListResponseDTO> {
    return this.request(
      `/sections/${encodeURIComponent(sectionId)}/conflicts/logs`,
      {
        method: 'GET',
        signal: options.signal,
      },
      parseConflictLogListResponse
    );
  }

  async approveSection(
    sectionId: string,
    payload: ApproveSectionRequestPayload,
    options: { signal?: AbortSignal } = {}
  ): Promise<ApprovalResponseDTO> {
    return this.request(
      `/sections/${encodeURIComponent(sectionId)}/approve`,
      {
        method: 'POST',
        body: payload,
        signal: options.signal,
      },
      parseApprovalResponse
    );
  }

  private generateRequestId(): string {
    return `section-editor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private async request<T>(
    path: string,
    init: RequestOptions,
    parser: (payload: unknown) => T
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = await this.buildHeaders(init.headers, init.body !== undefined);

    const requestInit: RequestInit = {
      method: init.method ?? 'GET',
      headers,
      signal: init.signal,
    };

    if (init.body !== undefined) {
      requestInit.body = JSON.stringify(init.body);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, requestInit);
    } catch (error) {
      logger.error(
        'SectionEditorClient request failed before reaching server',
        { path, method: requestInit.method },
        error instanceof Error ? error : undefined
      );
      throw new SectionEditorClientError('Network request failed', {
        status: 0,
        requestId: this.requestId,
        body: undefined,
      });
    }

    this.applyCorrelationFromResponse(response);

    const payload = await this.readPayload(response);

    if (!response.ok) {
      this.handleError(response, payload, path);
    }

    return parser(payload);
  }

  private async buildHeaders(
    overrideHeaders?: HeadersInit,
    includeContentType = false
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      Accept: RESPONSE_CONTENT_TYPE,
      'X-Request-ID': this.requestId,
      ...this.normalizeHeaders(overrideHeaders),
    };

    if (includeContentType && !headers['Content-Type']) {
      headers['Content-Type'] = RESPONSE_CONTENT_TYPE;
    }

    if (this.getAuthToken) {
      try {
        const token = await this.getAuthToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (error) {
        logger.error(
          'Failed to retrieve Clerk auth token for section editor request',
          {},
          error instanceof Error ? error : undefined
        );
      }
    }

    return headers;
  }

  private normalizeHeaders(input?: HeadersInit): Record<string, string> {
    if (!input) {
      return {};
    }

    if (input instanceof Headers) {
      return Object.fromEntries(input.entries());
    }

    if (Array.isArray(input)) {
      return Object.fromEntries(input);
    }

    return { ...input };
  }

  private async readPayload(response: Response): Promise<unknown> {
    const contentType = response.headers.get('Content-Type') ?? '';

    if (!contentType.includes('application/json')) {
      return null;
    }

    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      logger.error(
        'Failed to parse JSON payload from section editor response',
        { status: response.status },
        error instanceof Error ? error : undefined
      );
      return null;
    }
  }

  private handleError(response: Response, payload: unknown, path: string): never {
    const requestId = response.headers.get('x-request-id') ?? this.requestId;

    if (response.status === 409) {
      try {
        const conflict = parseConflictCheckResponse(payload);
        throw new SectionEditorConflictError(conflict, requestId ?? undefined);
      } catch (error) {
        if (error instanceof SectionEditorConflictError) {
          throw error;
        }
        logger.error(
          'Failed to parse conflict payload for section editor response',
          { path, status: response.status },
          error instanceof Error ? error : undefined
        );
      }
    }

    const normalizedError: ErrorPayload = this.normalizeErrorPayload(payload);

    const message = normalizedError.message ?? `HTTP ${response.status}: ${response.statusText}`;

    throw new SectionEditorClientError(message, {
      status: response.status,
      requestId,
      body: payload,
      code: normalizedError.code,
    });
  }

  private normalizeErrorPayload(payload: unknown): ErrorPayload {
    if (!payload || typeof payload !== 'object') {
      return {};
    }

    const maybeError = payload as Record<string, unknown>;

    const directMessage = maybeError['message'];
    const embeddedError = maybeError['error'];

    if (typeof directMessage === 'string' && directMessage.length > 0) {
      return {
        message: directMessage,
        code: typeof maybeError['code'] === 'string' ? (maybeError['code'] as string) : undefined,
        details: maybeError['details'],
      };
    }

    if (embeddedError && typeof embeddedError === 'object') {
      const errorData = embeddedError as Record<string, unknown>;
      return {
        message:
          typeof errorData['message'] === 'string' ? (errorData['message'] as string) : undefined,
        code: typeof errorData['code'] === 'string' ? (errorData['code'] as string) : undefined,
        details: errorData['details'],
      };
    }

    return {};
  }

  private applyCorrelationFromResponse(response: Response): void {
    const headerRequestId = response.headers.get('x-request-id');
    if (headerRequestId && headerRequestId !== this.requestId) {
      this.requestId = headerRequestId;
    }
  }
}

export const createSectionEditorClient = (options?: SectionEditorClientOptions) =>
  new SectionEditorClient(options);

export type {
  ConflictCheckResponseDTO,
  ConflictLogListResponseDTO,
  DiffResponseDTO,
  FormattingAnnotationDTO,
  ReviewSubmissionResponseDTO,
  SectionDraftResponseDTO,
  ApprovalResponseDTO,
} from './section-editor.mappers';
