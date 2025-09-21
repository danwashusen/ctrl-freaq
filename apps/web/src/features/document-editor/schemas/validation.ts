/**
 * Zod Validation Schemas
 *
 * Comprehensive validation schemas for all document editor data models.
 * Based on data-model.md validation rules and interface definitions.
 */

import { z } from 'zod';
import type { TocNode } from '../types/table-of-contents';

// Common validation helpers
const uuidSchema = z.string().uuid();
const isoDateTimeSchema = z.string().datetime();
const nonEmptyStringSchema = z.string().min(1);

/**
 * SectionView validation schemas
 */
export const SectionViewStateSchema = z.enum(['idle', 'read_mode', 'edit_mode', 'saving']);

export const SectionStatusSchema = z.enum(['idle', 'assumptions', 'drafting', 'review', 'ready']);

export const QualityGateStatusSchema = z.enum(['pending', 'passed', 'failed']).nullable();

export const SectionViewSchema = z.object({
  id: uuidSchema,
  docId: uuidSchema,
  parentSectionId: uuidSchema.nullable(),
  key: nonEmptyStringSchema,
  title: nonEmptyStringSchema,
  depth: z.number().int().min(0).max(5),
  orderIndex: z.number().int().min(0),
  contentMarkdown: z.string().max(100000),
  placeholderText: nonEmptyStringSchema,
  hasContent: z.boolean(),
  viewState: SectionViewStateSchema,
  editingUser: z.string().nullable(),
  lastModified: isoDateTimeSchema,
  status: SectionStatusSchema,
  assumptionsResolved: z.boolean(),
  qualityGateStatus: QualityGateStatusSchema,
});

export const SectionViewUpdateSchema = z.object({
  id: uuidSchema,
  viewState: SectionViewStateSchema.optional(),
  contentMarkdown: z.string().max(100000).optional(),
  hasContent: z.boolean().optional(),
  editingUser: z.string().nullable().optional(),
  lastModified: isoDateTimeSchema.optional(),
  status: SectionStatusSchema.optional(),
  assumptionsResolved: z.boolean().optional(),
  qualityGateStatus: QualityGateStatusSchema.optional(),
});

export const CreateSectionViewSchema = z.object({
  docId: uuidSchema,
  parentSectionId: uuidSchema.nullable(),
  key: nonEmptyStringSchema,
  title: nonEmptyStringSchema,
  depth: z.number().int().min(0).max(5),
  orderIndex: z.number().int().min(0),
  placeholderText: nonEmptyStringSchema,
});

/**
 * PendingChange validation schemas
 */
export const PatchOperationSchema = z.enum(['add', 'remove', 'replace']);

export const PendingChangeStatusSchema = z.enum(['pending', 'applying', 'applied', 'failed']);

export const PatchDiffSchema = z
  .object({
    op: PatchOperationSchema,
    path: nonEmptyStringSchema,
    value: z.string().optional(),
    oldValue: z.string().optional(),
  })
  .refine(
    data => {
      // For 'add' operations, value is required
      if (data.op === 'add') {
        return data.value !== undefined;
      }
      // For 'remove' operations, oldValue is required
      if (data.op === 'remove') {
        return data.oldValue !== undefined;
      }
      // For 'replace' operations, both value and oldValue are required
      if (data.op === 'replace') {
        return data.value !== undefined && data.oldValue !== undefined;
      }
      return true;
    },
    {
      message:
        "Patch operation requirements not met: add needs 'value', remove needs 'oldValue', replace needs both",
    }
  );

export const PendingChangeSchema = z.object({
  id: uuidSchema,
  sectionId: uuidSchema,
  documentId: uuidSchema,
  patches: z.array(PatchDiffSchema).min(1).max(100),
  originalContent: z.string().max(100000),
  previewContent: z.string().max(100000),
  createdAt: isoDateTimeSchema,
  createdBy: nonEmptyStringSchema,
  sessionId: nonEmptyStringSchema,
  status: PendingChangeStatusSchema,
  conflictsWith: z.array(uuidSchema),
});

export const CreatePendingChangeSchema = z.object({
  sectionId: uuidSchema,
  documentId: uuidSchema,
  patches: z.array(PatchDiffSchema).min(1).max(100),
  originalContent: z.string().max(100000),
  previewContent: z.string().max(100000),
  createdBy: nonEmptyStringSchema,
  sessionId: nonEmptyStringSchema,
});

export const PendingChangeUpdateSchema = z.object({
  id: uuidSchema,
  status: PendingChangeStatusSchema.optional(),
  conflictsWith: z.array(uuidSchema).optional(),
});

/**
 * EditorSession validation schemas
 */
export const EditorModeSchema = z.enum(['wysiwyg', 'markdown', 'preview']);

export const CollaboratorSchema = z.object({
  userId: nonEmptyStringSchema,
  userName: nonEmptyStringSchema,
  activeSectionId: uuidSchema.nullable(),
  lastActivity: isoDateTimeSchema,
});

export const EditorSessionSchema = z.object({
  documentId: uuidSchema,
  userId: nonEmptyStringSchema,
  sessionId: nonEmptyStringSchema,
  activeSectionId: uuidSchema.nullable(),
  expandedSections: z.array(uuidSchema).max(50),
  scrollPosition: z.number().min(0),
  editorMode: EditorModeSchema,
  showDiffView: z.boolean(),
  autoSaveEnabled: z.boolean(),
  autoSaveInterval: z.number().int().min(10000).max(300000), // 10s to 5min
  collaborators: z.array(CollaboratorSchema).max(10),
  lastSaveTime: z.number().min(0),
  pendingChangeCount: z.number().int().min(0),
});

export const CreateEditorSessionSchema = z.object({
  documentId: uuidSchema,
  userId: nonEmptyStringSchema,
  sessionId: nonEmptyStringSchema.optional(),
  editorMode: EditorModeSchema.optional(),
  autoSaveEnabled: z.boolean().optional(),
  autoSaveInterval: z.number().int().min(10000).max(300000).optional(),
});

export const EditorSessionUpdateSchema = z.object({
  sessionId: nonEmptyStringSchema,
  activeSectionId: uuidSchema.nullable().optional(),
  expandedSections: z.array(uuidSchema).max(50).optional(),
  scrollPosition: z.number().min(0).optional(),
  editorMode: EditorModeSchema.optional(),
  showDiffView: z.boolean().optional(),
  autoSaveEnabled: z.boolean().optional(),
  autoSaveInterval: z.number().int().min(10000).max(300000).optional(),
  lastSaveTime: z.number().min(0).optional(),
  pendingChangeCount: z.number().int().min(0).optional(),
});

/**
 * TableOfContents validation schemas
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TocNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    sectionId: uuidSchema,
    title: nonEmptyStringSchema.max(200),
    depth: z.number().int().min(0).max(5),
    orderIndex: z.number().int().min(0),
    hasContent: z.boolean(),
    status: SectionStatusSchema,
    isExpanded: z.boolean(),
    isActive: z.boolean(),
    isVisible: z.boolean(),
    hasUnsavedChanges: z.boolean(),
    children: z.array(TocNodeSchema).max(50),
    parentId: uuidSchema.nullable(),
  })
);

export const TableOfContentsSchema = z.object({
  documentId: uuidSchema,
  sections: z.array(TocNodeSchema).max(500),
  lastUpdated: isoDateTimeSchema,
});

export const CreateTocNodeSchema = z.object({
  sectionId: uuidSchema,
  title: nonEmptyStringSchema.max(200),
  depth: z.number().int().min(0).max(5),
  orderIndex: z.number().int().min(0),
  hasContent: z.boolean(),
  status: SectionStatusSchema,
  parentId: uuidSchema.nullable(),
});

export const TocNodeUpdateSchema = z.object({
  sectionId: uuidSchema,
  title: nonEmptyStringSchema.max(200).optional(),
  hasContent: z.boolean().optional(),
  status: SectionStatusSchema.optional(),
  isExpanded: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  hasUnsavedChanges: z.boolean().optional(),
});

export const TocFilterOptionsSchema = z.object({
  status: z.array(SectionStatusSchema).optional(),
  hasContentOnly: z.boolean().optional(),
  hasChangesOnly: z.boolean().optional(),
  searchTerm: z.string().optional(),
  maxDepth: z.number().int().min(0).max(5).optional(),
});

/**
 * API Request/Response schemas
 */

// GET /api/v1/sections/{sectionId}
export const GetSectionResponseSchema = SectionViewSchema;

// PATCH /api/v1/sections/{sectionId}
export const PatchSectionRequestSchema = z.object({
  viewState: SectionViewStateSchema,
});

export const PatchSectionResponseSchema = SectionViewSchema;

// POST /api/v1/sections/{sectionId}/pending-changes
export const PostPendingChangesRequestSchema = z.object({
  patches: z.array(PatchDiffSchema).min(1),
  originalContent: z.string().max(100000),
  previewContent: z.string().max(100000),
});

export const PostPendingChangesResponseSchema = PendingChangeSchema;

// POST /api/v1/sections/{sectionId}/save
export const PostSectionSaveRequestSchema = z.object({
  changeIds: z.array(uuidSchema).min(1),
});

export const PostSectionSaveResponseSchema = z.object({
  section: SectionViewSchema,
  appliedChanges: z.array(uuidSchema),
});

// GET /api/v1/documents/{docId}/toc
export const GetTocResponseSchema = TableOfContentsSchema;

// Error response schema
export const ErrorResponseSchema = z.object({
  code: nonEmptyStringSchema,
  message: nonEmptyStringSchema,
  details: z.object({}).passthrough().optional(),
  requestId: nonEmptyStringSchema,
  timestamp: isoDateTimeSchema,
});

/**
 * Validation utility functions
 */

/**
 * Validates section view state transitions
 */
export function validateSectionViewStateTransition(
  current: string,
  next: string
): z.SafeParseReturnType<{ current: string; next: string }, { current: string; next: string }> {
  const transitionSchema = z
    .object({
      current: SectionViewStateSchema,
      next: SectionViewStateSchema,
    })
    .refine(
      data => {
        const validTransitions: Record<string, string[]> = {
          idle: ['read_mode'],
          read_mode: ['edit_mode', 'idle'],
          edit_mode: ['saving', 'read_mode'],
          saving: ['read_mode', 'edit_mode'],
        };
        return validTransitions[data.current]?.includes(data.next) ?? false;
      },
      {
        message: 'Invalid state transition',
      }
    );

  return transitionSchema.safeParse({ current, next });
}

/**
 * Validates section status transitions
 */
export function validateSectionStatusTransition(
  current: string,
  next: string
): z.SafeParseReturnType<{ current: string; next: string }, { current: string; next: string }> {
  const transitionSchema = z
    .object({
      current: SectionStatusSchema,
      next: SectionStatusSchema,
    })
    .refine(
      data => {
        const validTransitions: Record<string, string[]> = {
          idle: ['assumptions'],
          assumptions: ['drafting'],
          drafting: ['review'],
          review: ['ready', 'drafting'],
          ready: [],
        };
        return validTransitions[data.current]?.includes(data.next) ?? false;
      },
      {
        message: 'Invalid status transition',
      }
    );

  return transitionSchema.safeParse({ current, next });
}

/**
 * Validates pending change status transitions
 */
export function validatePendingChangeStatusTransition(
  current: string,
  next: string
): z.SafeParseReturnType<{ current: string; next: string }, { current: string; next: string }> {
  const transitionSchema = z
    .object({
      current: PendingChangeStatusSchema,
      next: PendingChangeStatusSchema,
    })
    .refine(
      data => {
        const validTransitions: Record<string, string[]> = {
          pending: ['applying'],
          applying: ['applied', 'failed'],
          applied: [],
          failed: ['pending'],
        };
        return validTransitions[data.current]?.includes(data.next) ?? false;
      },
      {
        message: 'Invalid pending change status transition',
      }
    );

  return transitionSchema.safeParse({ current, next });
}

/**
 * Validates ToC tree structure for cycles and depth constraints
 */
export function validateTocTreeStructure(
  sections: unknown
): z.SafeParseReturnType<unknown[], unknown[]> {
  const treeStructureSchema = z.array(z.unknown()).refine(
    data => {
      // Parse as ToC nodes first
      const parseResult = z.array(TocNodeSchema).safeParse(data);
      if (!parseResult.success) return false;

      const nodes = parseResult.data;

      // Check for cycles and validate tree structure
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      function hasCycle(nodeId: string, parentMap: Map<string, string>): boolean {
        if (recursionStack.has(nodeId)) return true;
        if (visited.has(nodeId)) return false;

        visited.add(nodeId);
        recursionStack.add(nodeId);

        const parentId = parentMap.get(nodeId);
        if (parentId && hasCycle(parentId, parentMap)) return true;

        recursionStack.delete(nodeId);
        return false;
      }

      // Build parent map
      const parentMap = new Map<string, string>();

      function buildParentMap(tocNodes: TocNode[]): void {
        tocNodes.forEach(node => {
          if (node.parentId) {
            parentMap.set(node.sectionId, node.parentId);
          }
          if (node.children) {
            buildParentMap(node.children);
          }
        });
      }

      buildParentMap(nodes);

      // Check for cycles
      for (const [nodeId] of parentMap) {
        if (hasCycle(nodeId, parentMap)) return false;
      }

      return true;
    },
    {
      message: 'ToC tree structure contains cycles or invalid references',
    }
  );

  return treeStructureSchema.safeParse(sections);
}

/**
 * Export inferred types from schemas
 */
export type SectionViewType = z.infer<typeof SectionViewSchema>;
export type SectionViewUpdateType = z.infer<typeof SectionViewUpdateSchema>;
export type CreateSectionViewType = z.infer<typeof CreateSectionViewSchema>;

export type PendingChangeType = z.infer<typeof PendingChangeSchema>;
export type CreatePendingChangeType = z.infer<typeof CreatePendingChangeSchema>;
export type PendingChangeUpdateType = z.infer<typeof PendingChangeUpdateSchema>;
export type PatchDiffType = z.infer<typeof PatchDiffSchema>;

export type EditorSessionType = z.infer<typeof EditorSessionSchema>;
export type CreateEditorSessionType = z.infer<typeof CreateEditorSessionSchema>;
export type EditorSessionUpdateType = z.infer<typeof EditorSessionUpdateSchema>;
export type CollaboratorType = z.infer<typeof CollaboratorSchema>;

export type TocNodeType = z.infer<typeof TocNodeSchema>;
export type TableOfContentsType = z.infer<typeof TableOfContentsSchema>;
export type CreateTocNodeType = z.infer<typeof CreateTocNodeSchema>;
export type TocNodeUpdateType = z.infer<typeof TocNodeUpdateSchema>;
export type TocFilterOptionsType = z.infer<typeof TocFilterOptionsSchema>;

export type ErrorResponseType = z.infer<typeof ErrorResponseSchema>;
