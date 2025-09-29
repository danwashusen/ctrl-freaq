declare module '@ctrl-freaq/editor-persistence' {
  export {
    createManualDraftStorage,
    type ManualDraftPayload,
    type ManualDraftRecord,
    type ManualDraftStorage,
    createAssumptionSessionStore,
  } from '../../../../packages/editor-persistence/src/index';
}

declare module '@ctrl-freaq/editor-persistence/assumption-sessions/session-store' {
  export {
    type AssumptionSessionSnapshot,
    type AssumptionPromptSnapshot,
    type DraftProposalSnapshot,
  } from '../../../../packages/editor-persistence/src/assumption-sessions/session-store';
}
