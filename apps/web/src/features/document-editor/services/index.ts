/**
 * Document Editor Services
 *
 * Exports all API services for document editing functionality.
 * Provides centralized access to sections, pending changes, and session management.
 */

export {
  SectionsApiService,
  createSectionsApiService,
  type UpdateSectionStateRequest,
  type DocumentSectionsResponse,
  type SectionResponse,
  type TableOfContentsResponse,
} from './sections-api';

export {
  PendingChangesService,
  createPendingChangesService,
  type CreatePendingChangeRequest,
  type ApplyPendingChangesRequest,
  type PendingChangesResponse,
  type CreatePendingChangeResponse,
  type ApplyPendingChangesResponse,
} from './pending-changes-service';

export {
  SessionService,
  createSessionService,
  type CreateSessionRequest,
  type UpdateSessionRequest,
  type SessionResponse,
  type SessionListResponse,
  type SessionMetrics,
  type CollaboratorInfo,
} from './session-service';

export {
  DraftPersistenceClient,
  type DraftBundleRequest,
  type DraftBundleResponse,
  type DraftComplianceRequest,
  type DraftComplianceResponse,
} from './draft-client';

// Re-export common types for convenience
export type { SectionView, SectionViewState } from '../types/section-view';

export type { TableOfContents } from '../types/table-of-contents';

export type { PendingChange, PatchDiff } from '../types/pending-change';

export type { EditorSession, EditorSessionUpdate } from '../types/editor-session';
