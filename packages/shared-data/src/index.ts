/**
 * @ctrl-freaq/shared-data
 *
 * Shared data models, repositories, and types for CTRL FreaQ
 *
 * Provides:
 * - Entity models with validation
 * - Repository pattern implementations
 * - Database abstraction layer
 * - Type definitions
 */

// Export types
export type {
  AuditableEntity,
  BaseEntity,
  DatabaseConnection,
  QueryOptions,
  Repository,
} from './types/index.js';
export type {
  DocumentLifecycleStatus,
  ProjectDocumentWorkflowStatus,
  TemplateValidationDecisionAction,
  TemplateBinding,
  TemplateValidationDecision,
  ProjectDocumentSummary,
  ProjectDocumentSnapshot,
} from './types/project-document.js';
export {
  DocumentLifecycleStatusSchema,
  ProjectDocumentWorkflowStatusSchema,
  TemplateValidationDecisionActionSchema,
  TemplateBindingSchema,
  TemplateValidationDecisionSchema,
  ProjectDocumentSummarySchema,
  ProjectDocumentSnapshotSchema,
} from './types/project-document.js';

// Section editor model types
export type {
  SectionRecord,
  SectionRecordStatus,
  SectionRecordQualityGate,
} from './models/section-record.js';
export type {
  SectionDraft,
  SectionDraftConflictState,
  CreateSectionDraftInput,
  UpdateSectionDraftInput,
} from './models/section-draft.js';
export type { FormattingAnnotation } from './models/formatting-annotation.js';
export type { DraftConflictLog } from './models/draft-conflict-log.js';
export type { SectionReviewSummary } from './models/section-review-summary.js';
export type {
  SectionAssumption,
  AssumptionStatus,
  AssumptionOption,
  AssumptionResponseType,
  SectionAssumptionUpdate,
} from './models/section-assumption.js';
export type {
  AssumptionSession,
  AssumptionSessionStatus,
  AssumptionSessionCreateInput,
  AssumptionSessionUpdateInput,
} from './models/assumption-session.js';
export type {
  DraftProposal,
  DraftProposalSource,
  DraftProposalRationale,
  DraftProposalCreateInput,
  DraftProposalUpdateInput,
} from './models/draft-proposal.js';

// Export models
export * from './models/index.js';

// Co-authoring value objects
export * from './co-authoring/index.js';
export type {
  StreamingInteractionSession,
  StreamingInteractionMode,
  StreamingInteractionStatus,
  StreamingInteractionType,
  StreamingCancellationReason,
  StreamingFallbackReason,
  StreamingProgressEvent,
  StreamingFallbackRecord,
  StreamingDeliveryChannel,
  StreamingAnnouncementPriority,
  StreamingDeltaType,
  StreamingFallbackRootCause,
} from './co-authoring/streaming-interaction-session.js';
export {
  StreamingInteractionSessionSchema,
  StreamingProgressEventSchema,
  StreamingFallbackRecordSchema,
  StreamingInteractionModeSchema,
  StreamingInteractionStatusSchema,
  StreamingInteractionTypeSchema,
  StreamingCancellationReasonSchema,
  StreamingFallbackReasonSchema,
  StreamingDeliveryChannelSchema,
  StreamingAnnouncementPrioritySchema,
  StreamingDeltaTypeSchema,
  StreamingFallbackRootCauseSchema,
  createStreamingInteractionSession,
  createStreamingProgressEvent,
  createStreamingFallbackRecord,
} from './co-authoring/streaming-interaction-session.js';

// Export repositories
export * from './repositories/index.js';

// Export utilities
export * from './utils/index.js';

// Export migrations loader
export * from './migrations/index.js';
export { runSharedDataMigrations } from './migrations/run-migrations.js';

// Package metadata
export const PACKAGE_INFO = {
  name: '@ctrl-freaq/shared-data',
  version: '0.1.0',
  description: 'Shared data models and repositories for CTRL FreaQ',
} as const;
