import { z } from 'zod';

export const CoAuthoringIntentSchema = z.enum(['explain', 'outline', 'improve']);
export type CoAuthoringIntent = z.infer<typeof CoAuthoringIntentSchema>;

export const CoAuthoringStreamStateSchema = z.enum(['idle', 'streaming', 'awaiting-approval']);
export type CoAuthoringStreamState = z.infer<typeof CoAuthoringStreamStateSchema>;

const IsoTimestampSchema = z
  .string()
  .min(1, 'Timestamp is required')
  .refine(value => !Number.isNaN(Date.parse(value)), {
    message: 'Timestamp must be a valid ISO 8601 string',
  });

const sanitizeOptionalString = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeStringList = (values: readonly string[] | undefined): string[] => {
  if (!values) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
};

export const SectionConversationSessionSchema = z
  .object({
    sessionId: z.string().uuid('sessionId must be a valid UUID'),
    documentId: z.string().min(1, 'documentId is required'),
    sectionId: z.string().min(1, 'sectionId is required'),
    authorId: z.string().min(1, 'authorId is required'),
    startedAt: IsoTimestampSchema,
    activeIntent: CoAuthoringIntentSchema,
    contextSources: z.array(z.string()).optional().default([]),
    streamState: CoAuthoringStreamStateSchema,
    lastTurnId: z
      .string()
      .optional()
      .nullable()
      .transform(value => sanitizeOptionalString(value))
      .default(null),
  })
  .strict();

export type SectionConversationSession = z.infer<typeof SectionConversationSessionSchema>;

export interface CreateSectionConversationSessionInput
  extends Omit<SectionConversationSession, 'contextSources' | 'lastTurnId'> {
  contextSources?: string[];
  lastTurnId?: string | null;
}

export function createSectionConversationSession(
  input: CreateSectionConversationSessionInput
): SectionConversationSession {
  const parsed = SectionConversationSessionSchema.parse({
    ...input,
    contextSources: sanitizeStringList(input.contextSources),
    lastTurnId: sanitizeOptionalString(input.lastTurnId),
  });

  return {
    ...parsed,
    contextSources: sanitizeStringList(parsed.contextSources),
    lastTurnId: sanitizeOptionalString(parsed.lastTurnId),
  };
}

export function updateConversationSessionStreamState(
  session: SectionConversationSession,
  streamState: CoAuthoringStreamState
): SectionConversationSession {
  SectionConversationSessionSchema.pick({ streamState: true }).parse({ streamState });

  return {
    ...session,
    streamState,
  };
}

export function withUpdatedContextSources(
  session: SectionConversationSession,
  sources: string[]
): SectionConversationSession {
  const contextSources = sanitizeStringList(sources);

  return {
    ...session,
    contextSources,
  };
}
