import { Buffer } from 'node:buffer';
import { z, ZodIssueCode, type RefinementCtx } from 'zod';

const MAX_CONTEXT_KEYS = 20;
const MAX_ATTRIBUTES_BYTES = 5 * 1024;
const MAX_TIMESTAMP_DRIFT_MS = 24 * 60 * 60 * 1000;

const TimestampSchema = z
  .string()
  .datetime()
  .superRefine((value, ctx: RefinementCtx) => {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'timestamp must be a valid ISO 8601 value',
      });
      return;
    }

    const drift = Math.abs(Date.now() - parsed);
    if (drift > MAX_TIMESTAMP_DRIFT_MS) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'timestamp must be within 24 hours of server time',
      });
    }
  });

const BrowserLogErrorSchema = z
  .object({
    name: z.string().min(1),
    message: z.string().min(1),
    stack: z.string().max(10_000).optional(),
  })
  .strict();

const BrowserLogContextValueSchema = z.union([z.string(), z.number(), z.boolean()]);

const BrowserLogContextSchema = z
  .record(z.string(), BrowserLogContextValueSchema)
  .superRefine((value, ctx: RefinementCtx) => {
    const keyCount = Object.keys(value).length;
    if (keyCount > MAX_CONTEXT_KEYS) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: `context may include at most ${MAX_CONTEXT_KEYS} properties`,
      });
    }
  });

const BrowserLogAttributesSchema = z
  .record(z.string(), z.unknown())
  .superRefine((value, ctx: RefinementCtx) => {
    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'attributes must be JSON serializable',
      });
      return;
    }

    const size = Buffer.byteLength(serialized, 'utf8');
    if (size > MAX_ATTRIBUTES_BYTES) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: 'attributes must be ≤5KB when stringified',
      });
    }
  });

export const BrowserLogEntrySchema = z
  .object({
    timestamp: TimestampSchema,
    level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']),
    message: z.string().min(1).max(2048),
    requestId: z.string().min(1),
    sessionId: z.string().min(1).optional(),
    event_type: z.string().min(1).max(100).optional(),
    context: BrowserLogContextSchema.optional(),
    attributes: BrowserLogAttributesSchema.optional(),
    error: BrowserLogErrorSchema.optional(),
  })
  .strict();

export const BrowserLogBatchSchema = z
  .object({
    source: z.literal('browser'),
    sessionId: z.string().min(1).max(128),
    userId: z.string().min(1).nullable().optional(),
    logs: z.array(BrowserLogEntrySchema).min(1).max(100),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const BrowserLogsAckSchema = z
  .object({
    requestId: z.string().min(1),
    status: z.literal('accepted'),
    receivedCount: z.number().int().min(1).max(100),
  })
  .strict();

export type BrowserLogEntry = z.infer<typeof BrowserLogEntrySchema>;
export type BrowserLogEntryWithIndex = BrowserLogEntry & { index: number };
export type BrowserLogBatchInput = z.infer<typeof BrowserLogBatchSchema>;
type BrowserLogBatchBase = BrowserLogBatchInput;
export type BrowserLogBatch = Omit<BrowserLogBatchBase, 'logs'> & {
  logs: BrowserLogEntryWithIndex[];
};
export type BrowserLogsAckResponse = z.infer<typeof BrowserLogsAckSchema>;
