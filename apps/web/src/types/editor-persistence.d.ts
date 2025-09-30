declare module '@ctrl-freaq/editor-persistence' {
  export const createAssumptionSessionStore: any;
  export const createManualDraftStorage: any;
  export const createDraftStore: any;
  export type DraftStore = any;
  export type DraftSaveResult = any;
  export type SectionDraftInput = any;
  export type SectionDraftSnapshot = any;
  export type DocumentDraftState = any;
  export type ManualDraftPayload = any;
  export type ManualDraftRecord = any;
  export type ManualDraftStorage = any;
}

declare module '@ctrl-freaq/editor-persistence/assumption-sessions/session-store' {
  export const createAssumptionSessionStore: any;
  export type AssumptionSessionSnapshot = any;
  export type AssumptionPromptSnapshot = any;
  export type DraftProposalSnapshot = any;
}
