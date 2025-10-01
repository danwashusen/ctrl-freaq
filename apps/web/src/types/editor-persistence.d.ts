declare module '@ctrl-freaq/editor-persistence' {
  export {
    createDraftStore,
    DraftStore,
    type DraftSaveResult,
    type SectionDraftInput,
    type SectionDraftSnapshot,
  } from '../../../../packages/editor-persistence/src/draft-store';
  export type { DocumentDraftState } from '../../../../packages/editor-persistence/src/schema';
  export {
    createManualDraftStorage,
    type ManualDraftPayload,
    type ManualDraftRecord,
    type ManualDraftStorage,
  } from '../../../../packages/editor-persistence/src/storage/index';
}

declare module '@ctrl-freaq/editor-persistence/assumption-sessions/session-store' {
  export {
    createAssumptionSessionStore,
    type AssumptionSessionSnapshot,
    type AssumptionPromptSnapshot,
    type DraftProposalSnapshot,
  } from '../../../../packages/editor-persistence/src/assumption-sessions/session-store';
}
