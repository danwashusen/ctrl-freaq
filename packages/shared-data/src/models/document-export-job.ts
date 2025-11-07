import { z } from 'zod';

export const DocumentExportJobSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  format: z.enum(['markdown', 'zip', 'pdf', 'bundle']),
  scope: z.enum(['primary_document', 'all_documents']).default('primary_document'),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  requestedBy: z.string().min(1),
  requestedAt: z.date(),
  notifyEmail: z.string().email().nullable().optional(),
  artifactUrl: z.string().url().nullable(),
  errorMessage: z.string().nullable(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DocumentExportJob = z.infer<typeof DocumentExportJobSchema>;

export const CreateDocumentExportJobSchema = DocumentExportJobSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  artifactUrl: true,
  errorMessage: true,
  completedAt: true,
}).extend({
  status: z.enum(['queued', 'running', 'completed', 'failed']).default('queued'),
});

export type CreateDocumentExportJobInput = z.infer<typeof CreateDocumentExportJobSchema>;

export const UpdateDocumentExportJobSchema = DocumentExportJobSchema.partial().omit({
  id: true,
  projectId: true,
  createdAt: true,
  requestedAt: true,
  requestedBy: true,
});

export type UpdateDocumentExportJobInput = z.infer<typeof UpdateDocumentExportJobSchema>;
