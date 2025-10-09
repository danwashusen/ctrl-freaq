import { describe, expect, it, vi } from 'vitest';

import { createCoAuthoringAuditLogger } from './co-authoring';

describe('createCoAuthoringAuditLogger', () => {
  it('logs sanitized approval payload without transcript text', () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const auditLogger = createCoAuthoringAuditLogger(logger);

    auditLogger.logApproval({
      eventId: 'evt-approval-001',
      documentId: 'doc-architecture-demo',
      sectionId: 'architecture-overview',
      authorId: 'user_staff_eng',
      proposalId: 'proposal-123',
      diffHash: 'sha256:fixture',
      confidence: 0.82,
      citations: ['decision:telemetry'],
      approvalNotes: 'Improves accessibility messaging',
      transcriptExcerpt: 'Assistant: Recommended accessibility callout',
    });

    expect(logger.info).toHaveBeenCalledTimes(1);
    const [payload, message] = logger.info.mock.calls[0] ?? [];
    expect(message).toBe('Co-authoring proposal approved');
    expect(payload).toMatchObject({
      event: 'coauthor.approved',
      documentId: 'doc-architecture-demo',
      sectionId: 'architecture-overview',
      authorId: 'user_staff_eng',
      proposalId: 'proposal-123',
      diffHash: 'sha256:fixture',
    });
    expect(payload).not.toHaveProperty('transcriptExcerpt');
  });

  it('logs proposal streaming metrics with elapsed time buckets', () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const auditLogger = createCoAuthoringAuditLogger(logger);

    auditLogger.logProposal({
      eventId: 'evt-proposal-001',
      documentId: 'doc-architecture-demo',
      sectionId: 'architecture-overview',
      sessionId: 'session-123',
      promptId: 'prompt-improve-1',
      intent: 'improve',
      elapsedMs: 6200,
      status: 'streaming',
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'coauthor.proposal',
        sessionId: 'session-123',
        promptId: 'prompt-improve-1',
        latencyBucket: '5000-10000ms',
      }),
      'Co-authoring proposal streaming'
    );
  });
});
