import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { runProposalSessionMock, createVercelAIProposalProviderMock } = vi.hoisted(() => ({
  runProposalSessionMock: vi.fn().mockResolvedValue({
    sessionId: 'session-cli-123',
    proposalId: 'proposal-cli-123',
    confidence: 0.91,
    annotations: [],
    diff: { segments: [] },
    events: [],
  }),
  createVercelAIProposalProviderMock: vi.fn(() => ({
    async *streamProposal() {
      yield { type: 'progress', data: { status: 'streaming', elapsedMs: 0 } } as const;
      return {
        type: 'completed',
        data: {
          proposalId: 'proposal-cli-123',
        },
      } as const;
    },
  })),
}));

vi.mock('./session/proposal-runner', () => ({
  runProposalSession: runProposalSessionMock,
  createVercelAIProposalProvider: createVercelAIProposalProviderMock,
}));

import { cli } from './cli';

describe('@ctrl-freaq/ai CLI coauthor command', () => {
  const originalExit = process.exit;
  const payload = {
    session: {
      sessionId: 'session-cli-123',
      documentId: 'doc-architecture-demo',
      sectionId: 'architecture-overview',
      authorId: 'user_staff_eng',
    },
    prompt: {
      promptId: 'prompt-cli',
      intent: 'improve',
      text: 'Tighten architecture overview copy',
    },
    context: {
      documentId: 'doc-architecture-demo',
      sectionId: 'architecture-overview',
      documentTitle: 'CTRL FreaQ Architecture',
      completedSections: [
        {
          path: '/architecture/introduction.md',
          content: '# Intro\nApproved copy',
        },
      ],
      currentDraft: '## Draft\nPending review',
      decisionSummaries: [],
      knowledgeItems: [],
      clarifications: [],
    },
  };

  let payloadPath: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    runProposalSessionMock.mockClear();
    createVercelAIProposalProviderMock.mockClear();

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit invoked');
    }) as never);
    exitSpy.mockName('process.exit');

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    payloadPath = join(tmpdir(), `coauthor-cli-payload-${Date.now()}.json`);
    await fs.writeFile(payloadPath, JSON.stringify(payload), 'utf-8');
  });

  afterEach(async () => {
    process.exit = originalExit;
    await fs.rm(payloadPath, { force: true });
    vi.restoreAllMocks();
  });

  it('invokes proposal runner with payload and replay flag when --replay is set', async () => {
    try {
      await cli(['node', 'ai', 'coauthor', '--payload', payloadPath, '--json', '--replay']);
    } catch {
      // Commander triggers process.exit for unknown commands; swallow to keep test running.
    }

    expect(runProposalSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        session: payload.session,
        prompt: payload.prompt,
        context: payload.context,
        replay: true,
      })
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('"proposalId":"proposal-cli-123"')
    );
  });
});
