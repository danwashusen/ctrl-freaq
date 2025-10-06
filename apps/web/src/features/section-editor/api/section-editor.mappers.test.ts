import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import {
  parseConflictCheckResponse,
  parseSectionDraftResponse,
  parseSectionDiffResponse,
  parseReviewSubmissionResponse,
  parseConflictLogListResponse,
} from './section-editor.mappers';

describe('section-editor.mappers', () => {
  it('parses conflict check responses with events and rebased drafts', () => {
    const result = parseConflictCheckResponse({
      status: 'rebase_required',
      latestApprovedVersion: 5,
      conflictReason: 'New approval detected',
      rebasedDraft: {
        draftVersion: 4,
        contentMarkdown: '# Updated content',
        formattingAnnotations: [
          {
            id: 'ann-1',
            startOffset: 2,
            endOffset: 8,
            markType: 'unsupported-color',
            message: 'Custom colors are not allowed',
            severity: 'warning',
          },
        ],
      },
      events: [
        {
          detectedAt: '2025-09-25T10:15:00.000Z',
          detectedDuring: 'entry',
          previousApprovedVersion: 3,
          latestApprovedVersion: 5,
          resolvedBy: 'auto_rebase',
          resolutionNote: null,
        },
      ],
    });

    expect(result.status).toBe('rebase_required');
    expect(result.rebasedDraft?.draftVersion).toBe(4);
    expect(result.events).toHaveLength(1);
  });

  it('throws when conflict status is invalid', () => {
    expect(() =>
      parseConflictCheckResponse({
        status: 'unknown',
        latestApprovedVersion: 2,
      })
    ).toThrow(ZodError);
  });

  it('parses section draft responses and normalizes optional fields', () => {
    const payload = {
      draftId: 'draft-123',
      sectionId: 'section-456',
      draftVersion: 2,
      conflictState: 'clean',
      formattingAnnotations: [],
      savedAt: '2025-09-25T10:18:00.000Z',
      savedBy: 'user-456',
    };

    const parsed = parseSectionDraftResponse(payload);

    expect(parsed.summaryNote).toBeNull();
    expect(parsed.formattingAnnotations).toEqual([]);
    expect(parsed.savedAt).toBe('2025-09-25T10:18:00.000Z');
  });

  it('parses diff responses with metadata', () => {
    const parsed = parseSectionDiffResponse({
      mode: 'split',
      segments: [
        {
          type: 'added',
          content: '+ Added line',
          startLine: 10,
          endLine: 12,
        },
      ],
      metadata: {
        approvedVersion: 4,
        draftVersion: 5,
        generatedAt: '2025-09-25T10:20:00.000Z',
      },
    });

    expect(parsed.mode).toBe('split');
    const [segment] = parsed.segments;
    expect(segment?.type).toBe('added');
    expect(parsed.metadata?.draftVersion).toBe(5);
  });

  it('parses review submission responses', () => {
    const parsed = parseReviewSubmissionResponse({
      reviewId: 'rev-1',
      sectionId: 'sec-1',
      status: 'pending',
      submittedAt: '2025-09-25T10:22:00.000Z',
      submittedBy: 'user-789',
      summaryNote: 'Update intro',
    });

    expect(parsed.status).toBe('pending');
    expect(parsed.summaryNote).toBe('Update intro');
  });

  it('parses conflict log collections', () => {
    const parsed = parseConflictLogListResponse({
      events: [
        {
          detectedAt: '2025-09-25T10:30:00.000Z',
          detectedDuring: 'save',
          previousApprovedVersion: 2,
          latestApprovedVersion: 3,
          resolvedBy: null,
          resolutionNote: 'Manual copy required',
        },
      ],
    });

    expect(parsed.events).toHaveLength(1);
    const [event] = parsed.events;
    expect(event?.detectedDuring).toBe('save');
  });

  it('parses conflict server snapshots when provided', () => {
    const parsed = parseConflictCheckResponse({
      status: 'blocked',
      latestApprovedVersion: 9,
      serverSnapshot: {
        version: 9,
        content: '## Approved server content v9',
        capturedAt: '2025-09-30T12:00:00.000Z',
      },
    });

    expect(parsed.serverSnapshot?.version).toBe(9);
    expect(parsed.serverSnapshot?.content).toContain('Approved server content');
    expect(parsed.serverSnapshot?.capturedAt).toBe('2025-09-30T12:00:00.000Z');
  });
});
