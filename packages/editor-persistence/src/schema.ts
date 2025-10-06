import { z } from 'zod';

export const SectionDraftStatusSchema = z.enum(['draft', 'ready', 'conflict']);
export type SectionDraftStatus = z.infer<typeof SectionDraftStatusSchema>;

export const SectionDraftSchema = z.object({
  draftKey: z.string().min(1),
  projectSlug: z.string().min(1),
  documentSlug: z.string().min(1),
  sectionTitle: z.string().min(1),
  sectionPath: z.string().min(1),
  authorId: z.string().min(1),
  baselineVersion: z.string().min(1),
  patch: z.string(),
  status: SectionDraftStatusSchema,
  lastEditedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  complianceWarning: z.boolean().default(false),
});
export type SectionDraft = z.infer<typeof SectionDraftSchema>;

export const DocumentDraftStateSchema = z.object({
  projectSlug: z.string().min(1),
  documentSlug: z.string().min(1),
  authorId: z.string().min(1),
  sections: z.array(SectionDraftSchema),
  updatedAt: z.coerce.date(),
  rehydratedAt: z.coerce.date(),
  pendingComplianceWarning: z.boolean(),
});
export type DocumentDraftState = z.infer<typeof DocumentDraftStateSchema>;

export const DraftStorageRecordSchema = SectionDraftSchema.extend({
  lastEditedAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export type DraftStorageRecord = z.infer<typeof DraftStorageRecordSchema>;
