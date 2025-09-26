import { describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import type { Logger } from 'pino';

import type {
  SectionDraft,
  SectionDraftRepositoryImpl,
  SectionRepositoryImpl,
} from '@ctrl-freaq/shared-data';

import { SectionDraftConflictError, SectionDraftService } from './section-draft.service';
import type { SectionConflictService } from './section-conflict.service';

const createLogger = (): Logger => pino({ level: 'silent' });

const baseSection = {
  id: 'section-1',
  docId: 'document-1',
  approvedVersion: 1,
  approvedContent: '# Content',
  approvedAt: new Date(),
  approvedBy: 'user-1',
  lastSummary: null,
  contentMarkdown: '# Content',
  placeholderText: '',
  hasContent: true,
  viewState: 'read_mode',
  editingUser: null,
  lastModified: new Date(),
  status: 'idle',
  assumptionsResolved: true,
  qualityGateStatus: 'passed',
  qualityGate: 'passed',
  accessibilityScore: null,
  depth: 0,
  orderIndex: 0,
  key: 'overview',
  title: 'Overview',
  createdAt: new Date(),
  updatedAt: new Date(),
} as const;

const createDraftEntity = (overrides: Partial<SectionDraft> = {}): SectionDraft => ({
  id: 'draft-1',
  sectionId: baseSection.id,
  documentId: baseSection.docId,
  userId: 'user-1',
  draftVersion: 2,
  draftBaseVersion: 1,
  contentMarkdown: '# Content',
  formattingAnnotations: [],
  summaryNote: 'Summary',
  conflictState: 'clean',
  conflictReason: null,
  rebasedAt: null,
  savedAt: new Date(),
  savedBy: 'user-1',
  createdAt: new Date(),
  createdBy: 'user-1',
  updatedAt: new Date(),
  updatedBy: 'user-1',
  deletedAt: null,
  deletedBy: null,
  ...overrides,
});

describe('SectionDraftService', () => {
  it('throws SectionDraftConflictError when base version is stale', async () => {
    const sections = {
      findById: vi.fn().mockResolvedValue({ ...baseSection, approvedVersion: 3 }),
    } as unknown as SectionRepositoryImpl;

    const drafts = {
      findById: vi.fn(),
      updateDraft: vi.fn(),
      createDraft: vi.fn(),
    } as unknown as SectionDraftRepositoryImpl;

    const conflictResponse = {
      status: 'rebase_required',
      latestApprovedVersion: 3,
      conflictReason: 'stale',
      rebasedDraft: {
        draftVersion: 2,
        contentMarkdown: '# Latest',
        formattingAnnotations: [],
      },
    };

    const conflictService = {
      check: vi.fn().mockResolvedValue(conflictResponse),
    } as unknown as SectionConflictService;

    const service = new SectionDraftService(sections, drafts, conflictService, createLogger());

    await expect(
      service.saveDraft({
        sectionId: baseSection.id,
        documentId: baseSection.docId,
        userId: 'user-1',
        contentMarkdown: '# Content',
        draftVersion: 1,
        draftBaseVersion: 1,
        summaryNote: 'Summary',
      })
    ).rejects.toBeInstanceOf(SectionDraftConflictError);

    expect(conflictService.check).toHaveBeenCalled();
  });

  it('creates a new draft when inputs are valid', async () => {
    const sections = {
      findById: vi.fn().mockResolvedValue(baseSection),
      update: vi.fn(),
    } as unknown as SectionRepositoryImpl;

    const draftEntity = createDraftEntity();

    const drafts = {
      findById: vi.fn(),
      updateDraft: vi.fn(),
      createDraft: vi.fn().mockResolvedValue(draftEntity),
    } as unknown as SectionDraftRepositoryImpl;

    const conflictService = {
      check: vi.fn(),
    } as unknown as SectionConflictService;

    const service = new SectionDraftService(sections, drafts, conflictService, createLogger());

    const response = await service.saveDraft({
      sectionId: baseSection.id,
      documentId: baseSection.docId,
      userId: 'user-1',
      contentMarkdown: draftEntity.contentMarkdown,
      draftVersion: 2,
      draftBaseVersion: 1,
      summaryNote: draftEntity.summaryNote,
    });

    expect(response.draftId).toBe(draftEntity.id);
    expect(response.conflictState).toBe('clean');
    expect(response.savedAt).toMatch(/T/);
    expect(conflictService.check).not.toHaveBeenCalled();
  });

  it('updates existing draft when draftId provided', async () => {
    const sections = {
      findById: vi.fn().mockResolvedValue(baseSection),
    } as unknown as SectionRepositoryImpl;

    const existingDraft = createDraftEntity({
      draftVersion: 2,
      formattingAnnotations: [
        {
          id: 'ann-1',
          sectionId: baseSection.id,
          draftId: 'draft-1',
          startOffset: 1,
          endOffset: 4,
          markType: 'unsupported-color',
          message: 'Custom colors are not allowed',
          severity: 'warning',
          createdAt: new Date(),
          createdBy: 'user-1',
          updatedAt: new Date(),
          updatedBy: 'user-1',
          deletedAt: null,
          deletedBy: null,
        },
      ],
    });

    const updatedDraft = {
      ...existingDraft,
      draftVersion: 3,
      contentMarkdown: '# Updated content',
      formattingAnnotations: existingDraft.formattingAnnotations,
      summaryNote: 'Updated content',
      savedAt: new Date(),
      updatedAt: new Date(),
    };

    const drafts = {
      findById: vi.fn().mockResolvedValue(existingDraft),
      updateDraft: vi.fn().mockResolvedValue(updatedDraft),
      createDraft: vi.fn(),
      createDraftWithId: vi.fn(),
    } as unknown as SectionDraftRepositoryImpl;

    const conflictService = {
      check: vi.fn(),
    } as unknown as SectionConflictService;

    const savedAt = '2025-09-25T15:30:00.000Z';
    const service = new SectionDraftService(sections, drafts, conflictService, createLogger());

    const response = await service.saveDraft({
      sectionId: baseSection.id,
      documentId: baseSection.docId,
      userId: 'user-1',
      draftId: existingDraft.id,
      contentMarkdown: '# Updated content',
      draftVersion: 3,
      draftBaseVersion: 1,
      summaryNote: 'Updated content',
      formattingAnnotations: [
        {
          id: 'ann-1',
          startOffset: 1,
          endOffset: 4,
          markType: 'unsupported-color',
          message: 'Custom colors are not allowed',
          severity: 'warning',
        },
      ],
      clientTimestamp: savedAt,
    });

    expect(drafts.updateDraft).toHaveBeenCalledWith(
      existingDraft.id,
      expect.objectContaining({
        contentMarkdown: '# Updated content',
        draftVersion: 3,
        draftBaseVersion: 1,
        savedBy: 'user-1',
      }),
      expect.objectContaining({
        actorId: 'user-1',
        savedAt: new Date(savedAt),
        formattingAnnotations: [expect.objectContaining({ markType: 'unsupported-color' })],
      })
    );
    expect(response.draftVersion).toBe(3);
    expect(response.summaryNote).toBe('Updated content');
  });

  it('creates draft with provided id when existing record missing', async () => {
    const sections = {
      findById: vi.fn().mockResolvedValue(baseSection),
    } as unknown as SectionRepositoryImpl;

    const createdDraft = createDraftEntity({ id: 'draft-2', draftVersion: 5 });

    const drafts = {
      findById: vi.fn().mockResolvedValue(null),
      createDraftWithId: vi.fn().mockResolvedValue(createdDraft),
      createDraft: vi.fn(),
      updateDraft: vi.fn(),
    } as unknown as SectionDraftRepositoryImpl;

    const conflictService = {
      check: vi.fn(),
    } as unknown as SectionConflictService;

    const service = new SectionDraftService(sections, drafts, conflictService, createLogger());

    const response = await service.saveDraft({
      sectionId: baseSection.id,
      documentId: baseSection.docId,
      userId: 'user-1',
      draftId: 'draft-2',
      contentMarkdown: createdDraft.contentMarkdown,
      draftVersion: 5,
      draftBaseVersion: 1,
      summaryNote: createdDraft.summaryNote,
    });

    expect(drafts.createDraftWithId).toHaveBeenCalledWith(
      'draft-2',
      expect.objectContaining({ sectionId: baseSection.id }),
      expect.objectContaining({ actorId: 'user-1' })
    );
    expect(response.draftId).toBe('draft-2');
  });

  it('throws when attempting to overwrite with non-incremented version', async () => {
    const sections = {
      findById: vi.fn().mockResolvedValue(baseSection),
    } as unknown as SectionRepositoryImpl;

    const existingDraft = createDraftEntity({ draftVersion: 3 });

    const drafts = {
      findById: vi.fn().mockResolvedValue(existingDraft),
      updateDraft: vi.fn(),
    } as unknown as SectionDraftRepositoryImpl;

    const conflictService = {
      check: vi.fn(),
    } as unknown as SectionConflictService;

    const service = new SectionDraftService(sections, drafts, conflictService, createLogger());

    await expect(
      service.saveDraft({
        sectionId: baseSection.id,
        documentId: baseSection.docId,
        userId: 'user-1',
        draftId: existingDraft.id,
        contentMarkdown: existingDraft.contentMarkdown,
        draftVersion: 3,
        draftBaseVersion: 1,
      })
    ).rejects.toThrow('Draft version 3 must exceed existing version 3');
  });
});
