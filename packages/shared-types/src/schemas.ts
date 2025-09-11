// Shared zod schemas for Authoring API and MCP Read API
// These outline request/response contracts for the local authoring endpoints
// and the MCP read endpoints. Keep deterministic shapes and stable enums.

import { z } from 'zod';

// Common enums
export const AggressivenessEnum = z.enum(['conservative', 'balanced', 'yolo']);
export const DocumentTypeEnum = z.enum(['architecture']); // extend as needed
export const DocumentStatusEnum = z.enum(['draft', 'ready', 'published']);
export const SectionStatusEnum = z.enum(['idle', 'assumptions', 'drafting', 'review', 'ready']);
export const AssumptionScopeEnum = z.enum(['document', 'section']);
export const AssumptionStatusEnum = z.enum([
  'clear',
  'unclear',
  'unanswered',
  'ambiguous',
  'conflicting',
  'tradeoffs',
]);
export const ProposalStateEnum = z.enum(['proposed', 'applied', 'rejected']);

// Error envelope
export const ErrorEnvelopeSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string().optional(),
});

// Core models
export const DocumentMetaSchema = z.object({
  id: z.string(),
  type: DocumentTypeEnum,
  title: z.string(),
  templateId: z.string(),
  templateVersion: z.string(),
  schemaVersion: z.string(),
  version: z.string(),
  status: DocumentStatusEnum,
  assumptionAggressivenessDefault: AggressivenessEnum,
});

export const SectionSummarySchema = z.object({
  id: z.string(),
  parentSectionId: z.string().optional(),
  key: z.string(),
  title: z.string(),
  status: SectionStatusEnum,
  order: z.number().int(),
  depth: z.number().int(),
  assumptionsResolved: z.boolean(),
});

export const AssumptionItemSchema = z.object({
  id: z.string(),
  scope: AssumptionScopeEnum,
  sectionId: z.string().optional(),
  title: z.string(),
  intent: z.string(),
  status: AssumptionStatusEnum,
  decision: z.string(),
  order: z.number().int(),
});

export const ProposalSchema = z.object({
  id: z.string(),
  sectionId: z.string(),
  state: ProposalStateEnum,
  diffPatch: z.string(),
  reason: z.string().optional(),
  createdAt: z.string(), // ISO-8601
});

// Generic page factory
export const makePageSchema = <T extends z.ZodTypeAny>(Item: T) =>
  z.object({ items: z.array(Item), nextCursor: z.string().optional() });

// MCP Read API: Knowledge
export const KnowledgeTypeEnum = z.enum(['standard', 'pattern', 'decision']);
export const KnowledgeItemSchema = z.object({
  id: z.string(),
  type: KnowledgeTypeEnum,
  title: z.string(),
  slug: z.string(),
  body: z.string(),
  tags: z.array(z.string()),
  version: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const KnowledgeListQuerySchema = z.object({
  type: KnowledgeTypeEnum,
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});
export const KnowledgePageSchema = makePageSchema(KnowledgeItemSchema);

// Authoring API requests
export const ChatRoleEnum = z.enum(['user', 'assistant', 'system']);
export const ChatMessageSchema = z.object({
  id: z.string().optional(),
  role: ChatRoleEnum,
  content: z.string(),
  createdAt: z.string().optional(),
});
export const CreateDocumentBodySchema = z.object({
  type: DocumentTypeEnum,
  title: z.string().min(1),
});

export const PatchDocumentBodySchema = z
  .object({
    title: z.string().min(1).optional(),
    assumptionAggressivenessDefault: AggressivenessEnum.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided',
  });

export const PatchSectionBodySchema = z
  .object({
    title: z.string().min(1).optional(),
    contentMarkdown: z.string().optional(),
    status: SectionStatusEnum.optional(),
    decisionAggressivenessOverride: AggressivenessEnum.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided',
  });

export const ResolveAssumptionsBodySchema = z
  .object({
    scope: AssumptionScopeEnum,
    sectionId: z.string().optional(),
    decisions: z.array(
      z.object({ id: z.string(), decision: z.string().min(1) })
    ),
  })
  .superRefine((v, ctx) => {
    if (v.scope === 'section' && !v.sectionId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'sectionId is required when scope=section' });
    }
  });

export const ChatReadBodySchema = z.object({
  prompt: z.string().min(1),
  history: z.array(ChatMessageSchema).optional(),
  threadId: z.string().optional(),
});

export const ProposalsGenerateBodySchema = z.object({
  mode: z.enum(['improve', 'expand', 'clarify', 'applyTemplate']),
  notes: z.string().optional(),
  history: z.array(ChatMessageSchema).optional(),
  threadId: z.string().optional(),
});

// Document-level chat
export const DocumentChatBodySchema = z.object({
  prompt: z.string().min(1),
  history: z.array(ChatMessageSchema).optional(),
  threadId: z.string().optional(),
  includeSections: z.array(z.string()).optional(), // restrict context to specific sectionIds
  includeKnowledge: z.boolean().optional(),        // include knowledge items in context
  maxTokens: z.number().int().positive().optional(),
});

export const ChatCitationSchema = z.object({
  type: z.enum(['section', 'knowledge']),
  id: z.string(),
  range: z.string().optional(),
});

export const ProposalApplyBodySchema = z.object({ reason: z.string().optional() });
export const ProposalRejectBodySchema = z.object({ reason: z.string().optional() });

// Gates and Export
export const GateSeverityEnum = z.enum(['blocker', 'warning']);
export const GateIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: GateSeverityEnum,
  sectionId: z.string().optional(),
});
export const GatesRunResponseSchema = z.object({
  pass: z.boolean(),
  blockers: z.array(GateIssueSchema),
  warnings: z.array(GateIssueSchema),
  snapshotId: z.string(),
});

export const ExportBodySchema = z.object({
  full: z.string().min(1),
  shards: z.string().min(1),
});
export const ExportResponseSchema = z.object({
  wrote: z.array(z.string()),
  unchanged: z.array(z.string()),
});

// Re-exports of inferred types (optional)
export type DocumentMeta = z.infer<typeof DocumentMetaSchema>;
export type SectionSummary = z.infer<typeof SectionSummarySchema>;
export type AssumptionItem = z.infer<typeof AssumptionItemSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
export type KnowledgeItem = z.infer<typeof KnowledgeItemSchema>;
