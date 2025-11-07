import { createAssumptionSessionStore } from '@ctrl-freaq/editor-persistence/assumption-sessions/session-store';
import type {
  AssumptionPromptSnapshot,
  DraftProposalSnapshot,
} from '@ctrl-freaq/editor-persistence/assumption-sessions/session-store';

import { assumptionsApi, AssumptionsApiService } from '../services/assumptions-api';
import type { AssumptionAction, AssumptionPromptState } from '../types/assumption-session';
import {
  createProposalStore,
  type ProposalHistoryEntry,
  type ProposalStore,
} from './stores/proposal-store';

export interface AssumptionFlowState {
  sessionId: string;
  promptsRemaining: number;
  overridesOpen: number;
  proposalHistory: Array<{ proposalId: string; proposalIndex: number }>;
  prompts: AssumptionPromptState[];
  summaryMarkdown: string | null;
}

export interface StartAssumptionsFlowOptions {
  sectionId: string;
  documentId: string;
  templateVersion?: string;
  decisionSnapshotId?: string;
}

export interface ResumeAssumptionsFlowOptions {
  sessionId: string;
}

export interface RespondToPromptOptions {
  sectionId: string;
  documentId: string;
  templateVersion?: string;
  sessionId: string;
  promptId: string;
  action: AssumptionAction;
  payload?: {
    answer?: string;
    notes?: string;
    overrideJustification?: string;
  };
  currentState: AssumptionFlowState;
}

export interface AssumptionsFlowBootstrap {
  start(options: StartAssumptionsFlowOptions): Promise<AssumptionFlowState>;
  resume(options: ResumeAssumptionsFlowOptions): Promise<AssumptionFlowState>;
  respond(options: RespondToPromptOptions): Promise<AssumptionFlowState>;
  stop(sessionId?: string): Promise<void>;
}

interface AssumptionsFlowDependencies {
  api: AssumptionsApiService;
  proposalStoreFactory: (sessionId: string) => ProposalStore;
  sessionStore: ReturnType<typeof createAssumptionSessionStore>;
}

const isPromptResolved = (prompt: AssumptionPromptState): boolean => {
  return prompt.status === 'answered' || prompt.status === 'override_skipped';
};

const calculatePromptsRemaining = (prompts: AssumptionPromptState[]): number =>
  prompts.filter(prompt => !isPromptResolved(prompt)).length;

const calculateOverridesOpen = (prompts: AssumptionPromptState[]): number =>
  prompts.filter(prompt => prompt.status === 'override_skipped').length;

const buildFlowState = (
  sessionId: string,
  prompts: AssumptionPromptState[],
  overridesOpen: number,
  summaryMarkdown: string | null,
  proposalHistory: ProposalHistoryEntry[]
): AssumptionFlowState => ({
  sessionId,
  prompts,
  promptsRemaining: calculatePromptsRemaining(prompts),
  overridesOpen: overridesOpen ?? calculateOverridesOpen(prompts),
  summaryMarkdown,
  proposalHistory: proposalHistory.map(({ proposalId, proposalIndex }) => ({
    proposalId,
    proposalIndex,
  })),
});

const createDependencies = (
  overrides?: Partial<AssumptionsFlowDependencies>
): AssumptionsFlowDependencies => {
  const sessionStore = overrides?.sessionStore ?? createAssumptionSessionStore();
  const proposalStores = new Map<string, ProposalStore>();

  return {
    api: overrides?.api ?? assumptionsApi,
    sessionStore,
    proposalStoreFactory: (sessionId: string) => {
      let store = proposalStores.get(sessionId);
      if (!store) {
        store = overrides?.proposalStoreFactory?.(sessionId) ?? createProposalStore({ sessionId });
        proposalStores.set(sessionId, store);
      }
      return store;
    },
  };
};

const persistSessionSnapshot = async (
  deps: AssumptionsFlowDependencies,
  options: StartAssumptionsFlowOptions,
  payload: AssumptionFlowState
): Promise<void> => {
  await deps.sessionStore.saveSession({
    sessionId: payload.sessionId,
    sectionId: options.sectionId,
    documentId: options.documentId,
    templateVersion: options.templateVersion ?? '1.0.0',
    prompts: payload.prompts.map((prompt: AssumptionPromptState) => ({
      id: prompt.id,
      heading: prompt.heading,
      body: prompt.body,
      responseType: prompt.responseType,
      options: prompt.options,
      status: prompt.status,
      priority: prompt.priority,
      answer: prompt.answer,
      overrideJustification: prompt.overrideJustification,
    })),
    overridesOpen: calculateOverridesOpen(payload.prompts),
    updatedAt: new Date().toISOString(),
  });
};

const seedProposalHistoryFromPersistence = async (
  deps: AssumptionsFlowDependencies,
  sessionId: string
): Promise<ProposalHistoryEntry[]> => {
  const snapshots = await deps.sessionStore.getProposals(sessionId);
  const store = deps.proposalStoreFactory(sessionId);

  store.clear();
  for (const snapshot of snapshots) {
    store.recordProposal({
      proposalId: snapshot.proposalId,
      proposalIndex: snapshot.proposalIndex,
      contentMarkdown: snapshot.contentMarkdown,
      rationale: snapshot.rationale,
      source: snapshot.source,
      recordedAt: snapshot.recordedAt,
    });
  }

  return store.getHistory();
};

export const createAssumptionsFlowBootstrap = (
  overrides?: Partial<AssumptionsFlowDependencies>
): AssumptionsFlowBootstrap => {
  const deps = createDependencies(overrides);

  return {
    async start(options: StartAssumptionsFlowOptions): Promise<AssumptionFlowState> {
      const response = await deps.api.startSession(options.documentId, options.sectionId, {
        templateVersion: options.templateVersion ?? '1.0.0',
        decisionSnapshotId: options.decisionSnapshotId,
      });

      const store = deps.proposalStoreFactory(response.sessionId);
      store.clear();

      const existingProposals = await deps.sessionStore.getProposals(response.sessionId);
      if (existingProposals.length === 0) {
        const placeholderProposal: DraftProposalSnapshot = {
          proposalId: `${response.sessionId}-draft-0`,
          proposalIndex: 0,
          contentMarkdown:
            response.summaryMarkdown ?? '## Draft proposal pending assumption reconciliation',
          rationale: response.prompts.map(prompt => ({
            assumptionId: prompt.id,
            summary: prompt.answer ?? prompt.status,
          })),
          source: 'ai_generated',
          recordedAt: new Date().toISOString(),
        };

        await deps.sessionStore.appendProposal(response.sessionId, placeholderProposal);
        store.recordProposal({
          proposalId: placeholderProposal.proposalId,
          proposalIndex: placeholderProposal.proposalIndex,
          contentMarkdown: placeholderProposal.contentMarkdown,
          rationale: placeholderProposal.rationale,
          source: placeholderProposal.source,
          recordedAt: placeholderProposal.recordedAt,
        });
      }

      const state = buildFlowState(
        response.sessionId,
        response.prompts,
        response.overridesOpen,
        response.summaryMarkdown,
        store.getHistory()
      );

      await persistSessionSnapshot(deps, options, state);
      return state;
    },

    async resume({ sessionId }: ResumeAssumptionsFlowOptions): Promise<AssumptionFlowState> {
      const snapshot = await deps.sessionStore.getSession(sessionId);
      if (!snapshot) {
        throw new Error(`No persisted assumption session found for ${sessionId}`);
      }

      const prompts: AssumptionPromptState[] = snapshot.prompts.map(
        (prompt: AssumptionPromptSnapshot): AssumptionPromptState => ({
          id: prompt.id,
          heading: prompt.heading,
          body: prompt.body,
          responseType: prompt.responseType,
          options: prompt.options,
          priority: prompt.priority,
          status: prompt.status,
          answer: prompt.answer ?? null,
          overrideJustification: prompt.overrideJustification ?? null,
          unresolvedOverrideCount: snapshot.overridesOpen,
        })
      );

      const history = await seedProposalHistoryFromPersistence(deps, sessionId);

      return buildFlowState(sessionId, prompts, snapshot.overridesOpen, null, history);
    },

    async respond(options: RespondToPromptOptions): Promise<AssumptionFlowState> {
      const {
        sectionId,
        documentId,
        sessionId,
        templateVersion,
        promptId,
        action,
        payload,
        currentState,
      } = options;

      const prompt = await deps.api.respondToPrompt(
        documentId,
        sectionId,
        promptId,
        {
          action,
          answer: payload?.answer,
          notes: payload?.notes,
          overrideJustification: payload?.overrideJustification,
        },
        { sessionId }
      );

      const nextPrompts = currentState.prompts.map(existing =>
        existing.id === prompt.id
          ? {
              ...existing,
              heading: prompt.heading,
              body: prompt.body,
              responseType: prompt.responseType,
              options: prompt.options,
              priority: prompt.priority,
              status: prompt.status,
              answer: prompt.answer ?? null,
              overrideJustification: prompt.overrideJustification ?? null,
              unresolvedOverrideCount: prompt.unresolvedOverrideCount,
              escalation: prompt.escalation,
            }
          : existing
      );

      const history = deps.proposalStoreFactory(sessionId).getHistory();
      const nextState = buildFlowState(
        sessionId,
        nextPrompts,
        calculateOverridesOpen(nextPrompts),
        currentState.summaryMarkdown,
        history
      );

      await persistSessionSnapshot(
        deps,
        {
          sectionId,
          documentId,
          templateVersion,
        },
        nextState
      );

      return nextState;
    },

    async stop(sessionId?: string): Promise<void> {
      if (!sessionId) {
        return;
      }

      const store = deps.proposalStoreFactory(sessionId);
      store.clear();
    },
  };
};

export const ASSUMPTIONS_FLOW_FEATURE_FLAG = 'assumptions-flow:enabled';
