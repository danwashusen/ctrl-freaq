import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

import type {
  DraftConflictLogRepositoryImpl,
  SectionDraft,
  SectionDraftRepositoryImpl,
  SectionRepositoryImpl,
  SectionView,
} from '@ctrl-freaq/shared-data';

import { SectionConflictService } from './section-conflict.service';

const createLogger = () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } satisfies Record<string, unknown>;

  return logger as unknown as Logger;
};

describe('SectionConflictService', () => {
  const section = {
    id: 'section-1',
    docId: 'document-1',
    approvedVersion: 5,
    approvedContent: '# Content',
  } as unknown as SectionView;

  const draft = {
    id: 'draft-1',
    sectionId: section.id,
    draftVersion: 2,
    draftBaseVersion: 4,
    contentMarkdown: '# Draft',
    formattingAnnotations: [],
    conflictState: 'clean',
    conflictReason: null,
  } as unknown as SectionDraft;

  beforeEach(() => {
    vi.useRealTimers();
  });

  it('returns clean status when base version matches approved', async () => {
    const sections = {
      findById: vi.fn().mockResolvedValue({ ...section, approvedVersion: 2 }),
    } as unknown as SectionRepositoryImpl;

    const drafts = {
      findById: vi.fn().mockResolvedValue(draft),
      updateDraft: vi.fn(),
    } as unknown as SectionDraftRepositoryImpl;

    const logs = {
      createLogEntry: vi.fn(),
      listByDraft: vi.fn().mockResolvedValue([]),
    } as unknown as DraftConflictLogRepositoryImpl;

    const service = new SectionConflictService(sections, drafts, logs, createLogger());

    const response = await service.check({
      sectionId: section.id,
      userId: 'user-1',
      draftId: draft.id,
      draftBaseVersion: 2,
      draftVersion: 2,
    });

    expect(response.status).toBe('clean');
    expect(logs.createLogEntry).not.toHaveBeenCalled();
  });

  it('marks conflict when base version is stale', async () => {
    const sections = {
      findById: vi.fn().mockResolvedValue(section),
    } as unknown as SectionRepositoryImpl;

    const draftRecord = {
      ...draft,
      formattingAnnotations: [
        {
          id: 'ann-1',
          startOffset: 0,
          endOffset: 5,
          markType: 'unsupported-color',
          message: 'Custom colors are not allowed',
          severity: 'warning',
        },
      ],
    } as unknown as SectionDraft;

    const drafts = {
      findById: vi.fn().mockResolvedValue(draftRecord),
      updateDraft: vi.fn().mockResolvedValue({ ...draftRecord, conflictState: 'rebase_required' }),
    } as unknown as SectionDraftRepositoryImpl;

    const detectedAt = new Date('2025-09-25T15:30:00Z');

    const logs = {
      createLogEntry: vi.fn().mockResolvedValue(undefined),
      listByDraft: vi.fn().mockResolvedValue([
        {
          detectedAt,
          detectedDuring: 'entry',
          previousApprovedVersion: 4,
          latestApprovedVersion: 5,
          resolvedBy: null,
          resolutionNote: null,
        },
      ]),
    } as unknown as DraftConflictLogRepositoryImpl;

    const logger = createLogger();
    const service = new SectionConflictService(sections, drafts, logs, logger);

    const response = await service.check({
      sectionId: section.id,
      userId: 'user-1',
      draftId: draft.id,
      draftBaseVersion: 4,
      draftVersion: 2,
      approvedVersion: 5,
      triggeredBy: 'save',
      requestId: 'req-123',
    });

    expect(response.status).toBe('rebase_required');
    expect(response.rebasedDraft?.draftVersion).toBe(3);
    expect(response.rebasedDraft?.formattingAnnotations).toHaveLength(1);
    expect(response.events).toStrictEqual([
      {
        detectedAt: detectedAt.toISOString(),
        detectedDuring: 'entry',
        previousApprovedVersion: 4,
        latestApprovedVersion: 5,
        resolvedBy: null,
        resolutionNote: null,
      },
    ]);
    expect(drafts.updateDraft).toHaveBeenCalledWith(
      draft.id,
      expect.objectContaining({ conflictState: 'rebase_required' }),
      expect.objectContaining({ actorId: 'user-1' })
    );
    expect(logs.createLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: section.id,
        draftId: draft.id,
        detectedDuring: 'save',
        latestApprovedVersion: 5,
        previousApprovedVersion: 4,
      }),
      'user-1'
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-123',
        status: 'rebase_required',
      }),
      'Section conflict check completed'
    );
  });

  it('returns blocked status when draft is already blocked', async () => {
    const sections = {
      findById: vi.fn().mockResolvedValue(section),
    } as unknown as SectionRepositoryImpl;

    const drafts = {
      findById: vi.fn().mockResolvedValue({ ...draft, conflictState: 'blocked' }),
      updateDraft: vi.fn(),
    } as unknown as SectionDraftRepositoryImpl;

    const logs = {
      createLogEntry: vi.fn(),
      listByDraft: vi.fn().mockResolvedValue([]),
    } as unknown as DraftConflictLogRepositoryImpl;

    const service = new SectionConflictService(sections, drafts, logs, createLogger());

    const response = await service.check({
      sectionId: section.id,
      userId: 'user-1',
      draftId: draft.id,
      draftBaseVersion: 3,
      draftVersion: 2,
      approvedVersion: 5,
    });

    expect(response.status).toBe('blocked');
    expect(response.rebasedDraft).toBeUndefined();
    expect(drafts.updateDraft).not.toHaveBeenCalled();
    expect(logs.createLogEntry).not.toHaveBeenCalled();
  });

  it('warns when draft is missing but conflict is detected', async () => {
    const sections = {
      findById: vi.fn().mockResolvedValue(section),
    } as unknown as SectionRepositoryImpl;

    const drafts = {
      findById: vi.fn().mockResolvedValue(null),
      updateDraft: vi.fn(),
    } as unknown as SectionDraftRepositoryImpl;

    const logs = {
      createLogEntry: vi.fn(),
      listByDraft: vi.fn().mockResolvedValue([]),
    } as unknown as DraftConflictLogRepositoryImpl;

    const logger = createLogger();
    const service = new SectionConflictService(sections, drafts, logs, logger);

    await service.check({
      sectionId: section.id,
      userId: 'user-1',
      draftId: 'missing-draft',
      draftBaseVersion: 2,
      draftVersion: 1,
      approvedVersion: 5,
      requestId: 'trace-456',
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionId: section.id,
        draftId: 'missing-draft',
        userId: 'user-1',
      }),
      'Conflict detected but draft record was not found'
    );
  });

  it('throws when section cannot be found', async () => {
    const sections = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as SectionRepositoryImpl;

    const drafts = {
      findById: vi.fn(),
      updateDraft: vi.fn(),
    } as unknown as SectionDraftRepositoryImpl;

    const logs = {
      createLogEntry: vi.fn(),
      listByDraft: vi.fn(),
    } as unknown as DraftConflictLogRepositoryImpl;

    const service = new SectionConflictService(sections, drafts, logs, createLogger());

    await expect(
      service.check({
        sectionId: 'missing',
        userId: 'user-1',
        draftBaseVersion: 1,
        draftVersion: 1,
        approvedVersion: 1,
      })
    ).rejects.toThrow('Section missing not found');
  });
});
