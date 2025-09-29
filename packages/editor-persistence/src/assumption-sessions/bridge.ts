import {
  createAssumptionSessionStore,
  type AssumptionSessionSnapshot,
  type DraftProposalSnapshot,
} from './session-store';

export const ASSUMPTION_SESSION_NAMESPACE = 'assumption-sessions';

export interface AssumptionSessionBridge {
  listSessions(): Promise<AssumptionSessionSnapshot[]>;
  findBySection(sectionId: string): Promise<AssumptionSessionSnapshot | undefined>;
  load(sessionId: string): Promise<AssumptionSessionSnapshot | undefined>;
  save(snapshot: AssumptionSessionSnapshot): Promise<void>;
  appendProposal(sessionId: string, proposal: DraftProposalSnapshot): Promise<void>;
  clear(): Promise<void>;
}

export function createAssumptionSessionBridge(
  namespace = ASSUMPTION_SESSION_NAMESPACE
): AssumptionSessionBridge {
  const store = createAssumptionSessionStore({ namespace });

  return {
    listSessions: () => store.listSessions(),

    async findBySection(sectionId: string): Promise<AssumptionSessionSnapshot | undefined> {
      const sessions = await store.listSessions();
      return sessions.find(session => session.sectionId === sectionId);
    },

    load: async (sessionId: string) => store.getSession(sessionId),

    save: async (snapshot: AssumptionSessionSnapshot) => store.saveSession(snapshot),

    appendProposal: async (sessionId: string, proposal: DraftProposalSnapshot) =>
      store.appendProposal(sessionId, proposal),

    clear: () => store.clear(),
  };
}
