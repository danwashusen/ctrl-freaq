import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createAssumptionSessionStore } from '@ctrl-freaq/editor-persistence';
import type { AssumptionSessionSnapshot } from '@ctrl-freaq/editor-persistence/assumption-sessions/session-store';

import {
  createAssumptionsFlowBootstrap,
  type AssumptionFlowState,
  type RespondToPromptOptions,
  type StartAssumptionsFlowOptions,
} from '..';
import type { AssumptionAction } from '../../types/assumption-session';
import { useDocumentStore } from '../../stores/document-store';

interface UseAssumptionsFlowOptions {
  sectionId?: string | null;
  documentId: string;
  templateVersion?: string;
  decisionSnapshotId?: string;
  enabled?: boolean;
}

interface RespondPayload {
  answer?: string;
  notes?: string;
  overrideJustification?: string;
}

interface UseAssumptionsFlowResult {
  state: AssumptionFlowState | null;
  isLoading: boolean;
  error: string | null;
  respond: (promptId: string, action: AssumptionAction, payload?: RespondPayload) => Promise<void>;
  reset: () => void;
}

export function useAssumptionsFlow({
  sectionId,
  documentId,
  templateVersion,
  decisionSnapshotId,
  enabled = true,
}: UseAssumptionsFlowOptions): UseAssumptionsFlowResult {
  const [state, setState] = useState<AssumptionFlowState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionStoreRef = useRef(createAssumptionSessionStore());
  const bootstrapRef = useRef(
    createAssumptionsFlowBootstrap({ sessionStore: sessionStoreRef.current })
  );

  const setAssumptionSession = useDocumentStore(store => store.setAssumptionSession);

  const reset = useCallback(() => {
    setState(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!enabled || !sectionId) {
      reset();
      return;
    }

    let cancelled = false;
    const loadSession = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const sessions = await sessionStoreRef.current.listSessions();
        const existing = sessions.find(
          (snapshot: AssumptionSessionSnapshot) => snapshot.sectionId === sectionId
        );
        let nextState: AssumptionFlowState;

        if (existing) {
          nextState = await bootstrapRef.current.resume({ sessionId: existing.sessionId });
        } else {
          const startOptions: StartAssumptionsFlowOptions = {
            sectionId,
            documentId,
            templateVersion,
            decisionSnapshotId,
          };
          nextState = await bootstrapRef.current.start(startOptions);
        }

        if (cancelled) {
          return;
        }

        setState(nextState);
        setAssumptionSession(sectionId, nextState);
      } catch (unknownError) {
        if (cancelled) {
          return;
        }

        const message =
          unknownError instanceof Error ? unknownError.message : 'Failed to load assumption flow.';
        setError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [
    decisionSnapshotId,
    documentId,
    enabled,
    sectionId,
    templateVersion,
    reset,
    setAssumptionSession,
  ]);

  const respond = useCallback(
    async (promptId: string, action: AssumptionAction, payload?: RespondPayload) => {
      if (!state || !sectionId) {
        return;
      }

      try {
        setError(null);
        const nextState = await bootstrapRef.current.respond({
          sectionId,
          documentId,
          templateVersion,
          sessionId: state.sessionId,
          promptId,
          action,
          payload,
          currentState: state,
        } satisfies RespondToPromptOptions);

        setState(nextState);
        setAssumptionSession(sectionId, nextState);
      } catch (unknownError) {
        const message =
          unknownError instanceof Error
            ? unknownError.message
            : 'Failed to update assumption prompt.';
        setError(message);
      }
    },
    [documentId, sectionId, state, templateVersion, setAssumptionSession]
  );

  return useMemo(
    () => ({
      state,
      isLoading,
      error,
      respond,
      reset,
    }),
    [error, isLoading, respond, reset, state]
  );
}
