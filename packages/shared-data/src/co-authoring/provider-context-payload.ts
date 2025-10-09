import { z } from 'zod';

const nonEmptyString = (label: string) => z.string().min(1, `${label} is required`).trim();

const uniqueBy = <TItem, TKey>(
  items: readonly TItem[],
  keySelector: (item: TItem) => TKey
): TItem[] => {
  const seen = new Set<TKey>();
  const result: TItem[] = [];

  for (const item of items) {
    const key = keySelector(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }

  return result;
};

const ClarificationsSchema = z
  .array(z.string())
  .default([])
  .transform(values => {
    const result: string[] = [];
    for (const value of values) {
      if (typeof value !== 'string') {
        continue;
      }
      const trimmed = value.trim();
      if (!trimmed) {
        continue;
      }
      if (!result.includes(trimmed)) {
        result.push(trimmed);
      }
    }
    return result;
  });

const CompletedSectionSchema = z.object({
  path: nonEmptyString('Section path'),
  content: z.string().min(1, 'Section content is required'),
});

const DecisionSummarySchema = z.object({
  id: nonEmptyString('Decision id'),
  summary: nonEmptyString('Decision summary'),
});

const KnowledgeItemSchema = z.object({
  id: nonEmptyString('Knowledge item id'),
  excerpt: nonEmptyString('Knowledge item excerpt'),
});

export const ProviderContextPayloadSchema = z
  .object({
    documentId: nonEmptyString('documentId'),
    sectionId: nonEmptyString('sectionId'),
    documentTitle: nonEmptyString('documentTitle'),
    completedSections: z
      .array(CompletedSectionSchema)
      .min(1, 'At least one completed section is required'),
    currentDraft: z
      .string()
      .default('')
      .transform(value => value ?? ''),
    decisionSummaries: z.array(DecisionSummarySchema).optional().default([]),
    knowledgeItems: z.array(KnowledgeItemSchema).optional().default([]),
    clarifications: ClarificationsSchema,
  })
  .strict();

export type ProviderContextPayload = z.infer<typeof ProviderContextPayloadSchema>;

export interface CreateProviderContextPayloadInput
  extends Omit<
    ProviderContextPayload,
    'clarifications' | 'completedSections' | 'decisionSummaries' | 'knowledgeItems'
  > {
  clarifications?: string[];
  completedSections: Array<{ path: string; content: string }>;
  decisionSummaries?: Array<{ id: string; summary: string }>;
  knowledgeItems?: Array<{ id: string; excerpt: string }>;
}

const sanitizeCompletedSections = (
  sections: Array<{ path: string; content: string }>
): Array<{ path: string; content: string }> => {
  const cleaned = sections
    .map(section => ({
      path: section.path.trim(),
      content: section.content,
    }))
    .filter(section => section.path.length > 0 && section.content.length > 0);

  return uniqueBy(cleaned, section => section.path);
};

const sanitizeDecisionSummaries = (
  summaries: Array<{ id: string; summary: string }> | undefined
): Array<{ id: string; summary: string }> => {
  if (!summaries) {
    return [];
  }
  const cleaned = summaries
    .map(summary => ({
      id: summary.id.trim(),
      summary: summary.summary.trim(),
    }))
    .filter(summary => summary.id.length > 0 && summary.summary.length > 0);

  return uniqueBy(cleaned, summary => summary.id);
};

const sanitizeKnowledgeItems = (
  items: Array<{ id: string; excerpt: string }> | undefined
): Array<{ id: string; excerpt: string }> => {
  if (!items) {
    return [];
  }

  const cleaned = items
    .map(item => ({
      id: item.id.trim(),
      excerpt: item.excerpt.trim(),
    }))
    .filter(item => item.id.length > 0 && item.excerpt.length > 0);

  return uniqueBy(cleaned, item => item.id);
};

export function createProviderContextPayload(
  input: CreateProviderContextPayloadInput
): ProviderContextPayload {
  const sanitized = {
    ...input,
    documentTitle: input.documentTitle.trim(),
    currentDraft: input.currentDraft ?? '',
    completedSections: sanitizeCompletedSections(input.completedSections),
    decisionSummaries: sanitizeDecisionSummaries(input.decisionSummaries),
    knowledgeItems: sanitizeKnowledgeItems(input.knowledgeItems),
    clarifications: input.clarifications ?? [],
  } satisfies ProviderContextPayload;

  return ProviderContextPayloadSchema.parse(sanitized);
}

export function sanitizeProviderContextPayload(
  payload: ProviderContextPayload
): ProviderContextPayload {
  return createProviderContextPayload(payload);
}
