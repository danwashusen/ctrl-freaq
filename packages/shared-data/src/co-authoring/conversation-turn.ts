import { z } from 'zod';

import { CoAuthoringIntentSchema, type CoAuthoringIntent } from './section-conversation-session.js';

export const ConversationSpeakerSchema = z.enum(['author', 'assistant', 'system']);
export type ConversationSpeaker = z.infer<typeof ConversationSpeakerSchema>;

const IsoTimestampSchema = z
  .string()
  .min(1, 'Timestamp is required')
  .refine(value => !Number.isNaN(Date.parse(value)), {
    message: 'Timestamp must be a valid ISO 8601 string',
  });

const sanitizeOptionalString = (value: string | undefined | null): string | null => {
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

export const ConversationTurnSchema = z
  .object({
    turnId: z.string().min(1, 'turnId is required'),
    sessionId: z.string().min(1, 'sessionId is required'),
    speaker: ConversationSpeakerSchema,
    intent: CoAuthoringIntentSchema,
    promptText: z.string().min(1, 'promptText is required'),
    responseText: z
      .string()
      .optional()
      .nullable()
      .transform(value => sanitizeOptionalString(value))
      .default(null),
    citations: z.array(z.string()).optional().default([]),
    confidence: z.number().min(0).max(1).optional().nullable().default(null),
    createdAt: IsoTimestampSchema,
  })
  .strict();

export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;

export interface CreateConversationTurnInput
  extends Omit<ConversationTurn, 'responseText' | 'citations' | 'confidence'> {
  responseText?: string | null;
  citations?: string[];
  confidence?: number | null;
}

export function createConversationTurn(input: CreateConversationTurnInput): ConversationTurn {
  const parsed = ConversationTurnSchema.parse({
    ...input,
    responseText: sanitizeOptionalString(input.responseText),
    citations: sanitizeStringList(input.citations),
    confidence: input.confidence ?? null,
  });

  return {
    ...parsed,
    responseText: sanitizeOptionalString(parsed.responseText),
    citations: sanitizeStringList(parsed.citations),
    confidence:
      typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
        ? parsed.confidence
        : null,
  };
}

export function normaliseConversationTurnResponse(
  turn: ConversationTurn,
  responseText: string | null
): ConversationTurn {
  return {
    ...turn,
    responseText: sanitizeOptionalString(responseText),
  };
}

export type { CoAuthoringIntent };
