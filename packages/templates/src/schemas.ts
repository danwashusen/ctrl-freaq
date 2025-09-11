import { z } from 'zod';

export const TemplateSectionSchema: z.ZodType<any> = z.lazy(() => z.object({
  id: z.string(),
  title: z.string().optional(),
  version: z.string().optional(),
  assumptions: z.object({
    assertions: z.array(z.string()).optional(),
    checklist: z.array(z.string()).optional(),
    guidance: z.string().optional(),
  }).optional(),
  instruction: z.string().optional(),
  content: z.string().optional(),
  sections: z.array(TemplateSectionSchema).optional(),
  condition: z.string().optional(),
  type: z.enum(['paragraphs','bullet-list','numbered-list','table','mermaid','custom']).optional(),
  decisionAggressivenessDefault: z.enum(['conservative','balanced','yolo']).optional(),
}));

export const TemplateDocumentSchema = z.object({
  template: z.object({
    id: z.string(),
    name: z.string(),
    version: z.string(),
    decisionAggressivenessDefault: z.enum(['conservative','balanced','yolo']).optional(),
  }),
  workflow: z.any().optional(),
  sections: z.array(TemplateSectionSchema),
});

export type TemplateDocument = z.infer<typeof TemplateDocumentSchema>;

