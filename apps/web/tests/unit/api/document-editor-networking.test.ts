import { beforeEach, describe, expect, it, vi } from 'vitest';

import { postAnalyze } from '@/features/document-editor/api/co-authoring.client';
import { postDocumentQaReview } from '@/features/document-editor/api/document-qa.client';
import { configureDocumentEditorClients } from '@/lib/document-editor-client-config';

const BASE_URL = 'http://auth-tests.local/api/v1';
const AUTH_TOKEN = 'simple:test-user';

describe('document editor networking auth', () => {
  beforeEach(() => {
    configureDocumentEditorClients({
      baseUrl: BASE_URL,
      getAuthToken: async () => AUTH_TOKEN,
    });
  });

  it('applies Authorization headers and credentials for co-authoring requests', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      return new Response(
        JSON.stringify({
          status: 'accepted',
          sessionId: 'session-123',
          contextSummary: {
            completedSectionCount: 2,
            knowledgeItemCount: 1,
            decisionCount: 1,
          },
          audit: {
            documentId: 'doc-1',
            sectionId: 'section-1',
            intent: 'revise',
          },
        }),
        { status: 200, headers: { 'hx-stream-location': '/streams/session-123' } }
      );
    });

    await postAnalyze(
      {
        documentId: 'doc-1',
        sectionId: 'section-1',
        sessionId: 'session-123',
        intent: 'revise',
        prompt: 'Improve introduction',
        knowledgeItemIds: [],
        decisionIds: [],
        completedSections: [],
        currentDraft: '# Draft',
      },
      { fetchImpl }
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) {
      throw new Error('fetch was not called');
    }
    const [, init] = call;
    expect(init?.credentials).toBe('include');
    expect(init?.headers).toMatchObject({
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    });
  });

  it('applies Authorization headers for document QA requests', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      return new Response(
        JSON.stringify({
          status: 'accepted',
          sessionId: 'qa-session',
          queue: {
            disposition: 'started',
            replacedSessionId: null,
            replacementPolicy: 'newest_replaces_pending',
          },
          delivery: {
            mode: 'streaming',
            reason: null,
          },
        }),
        { status: 200, headers: { 'hx-stream-location': '/streams/qa-session' } }
      );
    });

    await postDocumentQaReview(
      {
        documentId: 'doc-qa',
        sectionId: 'section-qa',
        reviewerId: 'reviewer-1',
        sessionId: 'qa-session',
        prompt: 'Run QA',
      },
      { fetchImpl }
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) {
      throw new Error('fetch was not called');
    }
    const [, init] = call;
    expect(init?.credentials).toBe('include');
    expect(init?.headers).toMatchObject({
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    });
  });
});
