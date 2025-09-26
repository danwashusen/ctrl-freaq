import { describe, expect, it } from 'vitest';
import {
  ConflictCheckRequestSchema,
  ConflictCheckResponseSchema,
  DiffResponseSchema,
  FormattingAnnotationSchema,
  SaveDraftRequestSchema,
} from './section-editor.schema';

describe('section-editor schemas', () => {
  it('validates conflict check request payloads', () => {
    const payload = {
      draftBaseVersion: 4,
      draftVersion: 2,
      approvedVersion: 5,
      triggeredBy: 'entry',
    };

    expect(() => ConflictCheckRequestSchema.parse(payload)).not.toThrow();
    expect(() =>
      ConflictCheckRequestSchema.parse({ draftBaseVersion: -1, draftVersion: 2 })
    ).toThrow();
  });

  it('validates conflict check responses', () => {
    const response = {
      status: 'clean',
      latestApprovedVersion: 5,
      events: [
        {
          detectedAt: new Date().toISOString(),
          detectedDuring: 'entry',
          previousApprovedVersion: 4,
          latestApprovedVersion: 5,
        },
      ],
    };

    expect(() => ConflictCheckResponseSchema.parse(response)).not.toThrow();
  });

  it('rejects invalid formatting annotations', () => {
    expect(() =>
      FormattingAnnotationSchema.parse({
        id: 'ann-1',
        startOffset: 10,
        endOffset: 5,
        markType: 'unsupported-color',
        message: 'Alert',
        severity: 'warning',
      })
    ).toThrow();
  });

  it('validates diff responses', () => {
    const diffResponse = {
      mode: 'unified',
      segments: [
        {
          type: 'added',
          content: '+ New line',
          startLine: 3,
          endLine: 3,
          metadata: {
            original: { startLine: 2, endLine: 2 },
            modified: { startLine: 3, endLine: 3 },
          },
        },
      ],
      metadata: {
        approvedVersion: 10,
        draftVersion: 11,
        generatedAt: new Date().toISOString(),
      },
    };

    expect(() => DiffResponseSchema.parse(diffResponse)).not.toThrow();
  });

  it('validates save draft requests', () => {
    const request = {
      contentMarkdown: '# Heading',
      draftVersion: 2,
      draftBaseVersion: 1,
      summaryNote: 'Summary',
      formattingAnnotations: [
        {
          id: 'ann-1',
          startOffset: 0,
          endOffset: 10,
          markType: 'unsupported',
          message: 'message',
          severity: 'warning',
        },
      ],
    };

    expect(() => SaveDraftRequestSchema.parse(request)).not.toThrow();
  });
});
