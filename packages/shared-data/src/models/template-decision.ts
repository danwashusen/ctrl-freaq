import { z } from 'zod';

import { TemplateValidationDecisionActionSchema } from '../types/project-document.js';

export const TemplateValidationDecisionRecordSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  documentId: z.string().uuid(),
  templateId: z.string().min(1, 'templateId is required'),
  currentVersion: z.string().min(1, 'currentVersion is required'),
  requestedVersion: z.string().min(1, 'requestedVersion is required'),
  action: TemplateValidationDecisionActionSchema,
  notes: z.string().nullable(),
  submittedBy: z.string().nullable(),
  submittedAt: z.date(),
  payload: z.unknown().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TemplateValidationDecisionRecord = z.infer<
  typeof TemplateValidationDecisionRecordSchema
>;

export const RecordTemplateValidationDecisionInputSchema =
  TemplateValidationDecisionRecordSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  }).extend({
    notes: z.string().nullable().optional(),
    submittedBy: z.string().nullable().optional(),
    payload: z.unknown().nullable().optional(),
    submittedAt: z.date().optional(),
  });

export type RecordTemplateValidationDecisionInput = z.infer<
  typeof RecordTemplateValidationDecisionInputSchema
>;
