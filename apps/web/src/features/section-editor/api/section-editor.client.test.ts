import { beforeEach, describe, expect, it } from 'vitest';
import { mockAsyncFn, type MockedAsyncFn } from '@ctrl-freaq/test-support';

import {
  SectionEditorClient,
  SectionEditorClientError,
  SectionEditorConflictError,
} from './section-editor.client';

const baseUrl = 'https://api.example.com';

const buildResponse = (body: unknown, init: ResponseInit): Response => {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
};

describe('SectionEditorClient', () => {
  let fetchMock: MockedAsyncFn<typeof fetch>;

  beforeEach(() => {
    fetchMock = mockAsyncFn<typeof fetch>();
  });

  it('sends conflict check requests with auth headers and parses response', async () => {
    const client = new SectionEditorClient({
      baseUrl,
      fetch: fetchMock as unknown as typeof fetch,
      getAuthToken: async () => 'token-123',
    });

    fetchMock.mockResolvedValueOnce(
      buildResponse(
        {
          status: 'clean',
          latestApprovedVersion: 2,
          events: [],
        },
        {
          status: 200,
          headers: {
            'x-request-id': 'req-123',
          },
        }
      )
    );

    const result = await client.checkConflicts('sec-1', {
      draftBaseVersion: 1,
      draftVersion: 2,
    });

    expect(result.status).toBe('clean');
    expect(result.latestApprovedVersion).toBe(2);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${baseUrl}/sections/sec-1/conflicts/check`);
    expect(init.method).toBe('POST');

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-123');
    expect(headers['X-Request-ID']).toMatch(/^section-editor-/);

    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      draftBaseVersion: 1,
      draftVersion: 2,
    });
  });

  it('parses draft responses on saveDraft success', async () => {
    const client = new SectionEditorClient({
      baseUrl,
      fetch: fetchMock as unknown as typeof fetch,
    });

    fetchMock.mockResolvedValueOnce(
      buildResponse(
        {
          draftId: 'draft-1',
          sectionId: 'sec-1',
          draftVersion: 3,
          conflictState: 'clean',
          formattingAnnotations: [],
          savedAt: '2025-09-25T10:00:00.000Z',
          savedBy: 'user-1',
          summaryNote: 'Updated overview',
        },
        {
          status: 202,
          headers: {
            'x-request-id': 'req-456',
          },
        }
      )
    );

    const result = await client.saveDraft('sec-1', {
      contentMarkdown: '# Intro',
      draftVersion: 3,
      draftBaseVersion: 2,
      summaryNote: 'Updated overview',
    });

    expect(result.draftId).toBe('draft-1');
    expect(result.conflictState).toBe('clean');
  });

  it('throws SectionEditorConflictError when server returns conflict payload', async () => {
    const client = new SectionEditorClient({
      baseUrl,
      fetch: fetchMock as unknown as typeof fetch,
    });

    fetchMock.mockResolvedValueOnce(
      buildResponse(
        {
          status: 'rebase_required',
          latestApprovedVersion: 5,
          conflictReason: 'New approval in place',
          events: [],
        },
        {
          status: 409,
          headers: {
            'x-request-id': 'req-789',
          },
        }
      )
    );

    const error = await client
      .saveDraft('sec-1', {
        contentMarkdown: '# Intro',
        draftVersion: 2,
        draftBaseVersion: 1,
      })
      .then(() => null)
      .catch(err => err as unknown);

    expect(error).toBeInstanceOf(SectionEditorConflictError);
    expect(error).toMatchObject({
      conflict: {
        status: 'rebase_required',
        latestApprovedVersion: 5,
      },
      requestId: 'req-789',
    });
  });

  it('wraps non-conflict errors with SectionEditorClientError', async () => {
    const client = new SectionEditorClient({
      baseUrl,
      fetch: fetchMock as unknown as typeof fetch,
    });

    fetchMock.mockResolvedValueOnce(
      buildResponse(
        {
          code: 'unauthorized',
          message: 'Unauthorized',
        },
        {
          status: 401,
          headers: {
            'x-request-id': 'req-401',
          },
        }
      )
    );

    await expect(client.getDiff('sec-1')).rejects.toBeInstanceOf(SectionEditorClientError);
  });
});
