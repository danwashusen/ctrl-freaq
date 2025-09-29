import localforage from 'localforage';

export interface AssumptionPromptSnapshot {
  id: string;
  heading: string;
  body: string;
  responseType: 'single_select' | 'multi_select' | 'text';
  options: Array<{
    id: string;
    label: string;
    description: string | null;
    defaultSelected: boolean;
  }>;
  status: 'pending' | 'answered' | 'deferred' | 'escalated' | 'override_skipped';
  priority: number;
  answer: string | null;
  overrideJustification: string | null;
}

export interface AssumptionSessionSnapshot {
  sessionId: string;
  sectionId: string;
  documentId: string;
  templateVersion: string;
  prompts: AssumptionPromptSnapshot[];
  overridesOpen: number;
  updatedAt: string;
}

export interface DraftProposalSnapshot {
  proposalId: string;
  proposalIndex: number;
  contentMarkdown: string;
  rationale: Array<{ assumptionId: string; summary: string }>;
  source: 'ai_generated' | 'manual_revision' | 'ai_retry' | 'fallback_manual';
  recordedAt: string;
}

export interface AssumptionSessionStoreOptions {
  namespace?: string;
}

export interface AssumptionSessionStore {
  saveSession(session: AssumptionSessionSnapshot): Promise<void>;
  getSession(sessionId: string): Promise<AssumptionSessionSnapshot | undefined>;
  appendProposal(sessionId: string, proposal: DraftProposalSnapshot): Promise<void>;
  getProposals(sessionId: string): Promise<DraftProposalSnapshot[]>;
  listSessions(): Promise<AssumptionSessionSnapshot[]>;
  clear(): Promise<void>;
}

const DEFAULT_NAMESPACE = 'assumption-sessions';

const normaliseNamespace = (namespace?: string): string => {
  const base = namespace?.trim() || DEFAULT_NAMESPACE;
  return base.replace(/[^a-z0-9_]/giu, '-');
};

const sessionKey = (sessionId: string): string => `session:${sessionId}`;
const proposalsKey = (sessionId: string): string => `session:${sessionId}:proposals`;

export const createAssumptionSessionStore = (
  options: AssumptionSessionStoreOptions = {}
): AssumptionSessionStore => {
  const namespace = normaliseNamespace(options.namespace);
  const store = localforage.createInstance({
    name: '@ctrl-freaq/editor-persistence',
    storeName: namespace,
    description: 'Assumption session offline storage',
    driver: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE],
  });

  const saveSession = async (session: AssumptionSessionSnapshot): Promise<void> => {
    const payload = {
      ...session,
      prompts: session.prompts.map(prompt => ({
        ...prompt,
        answer: prompt.answer,
        overrideJustification: prompt.overrideJustification,
      })),
    } satisfies AssumptionSessionSnapshot;

    await store.setItem(sessionKey(session.sessionId), payload);
  };

  const getSession = async (sessionId: string): Promise<AssumptionSessionSnapshot | undefined> => {
    const stored = (await store.getItem(sessionKey(sessionId))) as AssumptionSessionSnapshot | null;
    return stored ?? undefined;
  };

  const appendProposal = async (
    sessionId: string,
    proposal: DraftProposalSnapshot
  ): Promise<void> => {
    const existingRaw = await store.getItem(proposalsKey(sessionId));
    const existing = Array.isArray(existingRaw) ? (existingRaw as DraftProposalSnapshot[]) : [];

    const sliced = existing.filter(item => item.proposalId !== proposal.proposalId);
    sliced.push(proposal);
    sliced.sort((a, b) => a.proposalIndex - b.proposalIndex);

    await store.setItem(proposalsKey(sessionId), sliced);
  };

  const getProposals = async (sessionId: string): Promise<DraftProposalSnapshot[]> => {
    const proposals = (await store.getItem(proposalsKey(sessionId))) as
      | DraftProposalSnapshot[]
      | null;
    return proposals ?? [];
  };

  const listSessions = async (): Promise<AssumptionSessionSnapshot[]> => {
    const sessions: AssumptionSessionSnapshot[] = [];
    await store.iterate((value, key) => {
      if (typeof key === 'string' && key.startsWith('session:') && !key.endsWith(':proposals')) {
        sessions.push(value as AssumptionSessionSnapshot);
      }
    });
    sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return sessions;
  };

  const clear = async (): Promise<void> => {
    await store.clear();
  };

  return {
    saveSession,
    getSession,
    appendProposal,
    getProposals,
    listSessions,
    clear,
  };
};
