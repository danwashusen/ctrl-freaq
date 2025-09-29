import { beforeEach, describe, expect, it, vi } from 'vitest';
import localforage from 'localforage';

import {
  createAssumptionSessionStore,
  type AssumptionSessionSnapshot,
  type DraftProposalSnapshot,
} from '../../src/assumption-sessions/session-store';

vi.mock('localforage', () => ({
  default: {
    createInstance: vi.fn(),
    INDEXEDDB: 'indexeddb',
    WEBSQL: 'websql',
    LOCALSTORAGE: 'localstorage',
  },
}));

describe('AssumptionSessionStore IndexedDB persistence', () => {
  const session: AssumptionSessionSnapshot = {
    sessionId: 'sess-1',
    sectionId: 'sec-1',
    documentId: 'doc-1',
    templateVersion: '1.0.0',
    overridesOpen: 0,
    updatedAt: '2025-09-29T05:00:00.000Z',
    prompts: [
      {
        id: 'assume-1',
        heading: 'Confirm queue strategy',
        body: 'Should we rely on managed queues?',
        responseType: 'single_select',
        options: [
          { id: 'managed', label: 'Managed', description: null, defaultSelected: true },
          { id: 'self-hosted', label: 'Self-hosted', description: null, defaultSelected: false },
        ],
        status: 'answered',
        priority: 1,
        answer: 'Use managed queues',
        overrideJustification: null,
      },
      {
        id: 'assume-2',
        heading: 'Security escalations',
        body: 'Are there pending security reviews?',
        responseType: 'text',
        options: [],
        status: 'override_skipped',
        priority: 2,
        answer: null,
        overrideJustification: 'Pending security review',
      },
    ],
  };

  const proposal: DraftProposalSnapshot = {
    proposalId: 'prop-1',
    proposalIndex: 0,
    contentMarkdown: '## Draft content',
    rationale: [{ assumptionId: 'assume-1', summary: 'Matches queue decision' }],
    source: 'ai_generated',
    recordedAt: '2025-09-29T05:00:01.000Z',
  };

  const mockStore = {
    setItem: vi.fn().mockResolvedValue(undefined),
    getItem: vi.fn().mockResolvedValue(null),
    removeItem: vi.fn().mockResolvedValue(undefined),
    iterate: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localforage.createInstance).mockReturnValue(mockStore as never);
  });

  it('persists assumption sessions with prompt states and retrieves them by session id', async () => {
    const store = createAssumptionSessionStore({ namespace: 'test-assumptions' });

    await store.saveSession(session);

    expect(mockStore.setItem).toHaveBeenCalledWith(
      'session:sess-1',
      expect.objectContaining({
        sectionId: session.sectionId,
        prompts: session.prompts,
        overridesOpen: session.overridesOpen,
      })
    );

    mockStore.getItem.mockResolvedValueOnce({ ...session, proposals: [] });
    const restored = await store.getSession('sess-1');

    expect(restored).toMatchObject({
      sessionId: 'sess-1',
      prompts: session.prompts,
      overridesOpen: 0,
    });
  });

  it('appends proposals and returns ordered history with audit metadata', async () => {
    const store = createAssumptionSessionStore({ namespace: 'test-assumptions' });

    mockStore.getItem.mockResolvedValueOnce({ ...session, proposals: [] });

    await store.appendProposal('sess-1', proposal);

    expect(mockStore.setItem).toHaveBeenCalledWith(
      'session:sess-1:proposals',
      expect.arrayContaining([
        expect.objectContaining({
          proposalId: 'prop-1',
          proposalIndex: 0,
          rationale: proposal.rationale,
        }),
      ])
    );

    mockStore.getItem.mockResolvedValueOnce([proposal]);
    const history = await store.getProposals('sess-1');

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ proposalId: 'prop-1', recordedAt: proposal.recordedAt });
  });

  it('clears persisted assumption data for namespace cleanup', async () => {
    const store = createAssumptionSessionStore({ namespace: 'test-assumptions' });

    await store.clear();

    expect(mockStore.clear).toHaveBeenCalled();
  });

  it('stores multi-select answers as JSON strings and restores them on resume', async () => {
    const store = createAssumptionSessionStore({ namespace: 'test-assumptions' });

    const selections = JSON.stringify(['ai-service', 'telemetry']);
    const multiSelectSession: AssumptionSessionSnapshot = {
      ...session,
      sessionId: 'sess-multi',
      prompts: [
        ...session.prompts,
        {
          id: 'assume-multi',
          heading: 'Select impacted integrations',
          body: 'Choose all integrations that require updates.',
          responseType: 'multi_select',
          options: [
            { id: 'ai-service', label: 'AI Service', description: null, defaultSelected: false },
            { id: 'telemetry', label: 'Telemetry', description: null, defaultSelected: false },
          ],
          status: 'answered',
          priority: 3,
          answer: selections,
          overrideJustification: null,
        },
      ],
    };

    await store.saveSession(multiSelectSession);

    mockStore.getItem.mockResolvedValueOnce(multiSelectSession);
    const restored = await store.getSession('sess-multi');

    expect(restored?.prompts.find(prompt => prompt.id === 'assume-multi')?.answer).toBe(selections);
  });
});
