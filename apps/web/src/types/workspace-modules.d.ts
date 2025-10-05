declare module '@ctrl-freaq/qa' {
  export { logDraftComplianceWarning } from '../../../../packages/qa/src/compliance/drafts.js';
}

declare module '@ctrl-freaq/editor-core' {
  export { createPatchEngine } from '../../../../packages/editor-core/src/patch-engine.js';
}

declare module '@ctrl-freaq/editor-persistence/assumption-sessions/session-store' {
  export {
    createAssumptionSessionStore,
    type AssumptionSessionStore,
  } from '../../../../packages/editor-persistence/src/assumption-sessions/session-store.js';
}
