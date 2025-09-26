import { describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import type { Logger } from 'pino';

import type {
  SectionDraft,
  SectionDraftRepositoryImpl,
  SectionRepositoryImpl,
} from '@ctrl-freaq/shared-data';

import { SectionDiffService } from './section-diff.service';

const createLogger = (): Logger => pino({ level: 'silent' });

describe('SectionDiffService', () => {
  it('produces diff using provided draft content', async () => {
    const sections = {
      findById: vi.fn().mockResolvedValue({
        id: 'section-1',
        docId: 'document-1',
        approvedVersion: 4,
        approvedContent: '# Title\nOriginal',
      }),
    } as unknown as SectionRepositoryImpl;

    const drafts = {
      findById: vi.fn(),
    } as unknown as SectionDraftRepositoryImpl;

    const diffGenerator = vi.fn(() => ({
      mode: 'unified' as const,
      segments: [{ type: 'added' as const, content: '# Title\nUpdated', startLine: 1, endLine: 1 }],
      metadata: { approvedVersion: 4, draftVersion: 5 },
    }));

    const service = new SectionDiffService(sections, drafts, diffGenerator, createLogger());

    const diff = await service.buildDiff({
      sectionId: 'section-1',
      userId: 'user-1',
      draftContent: '# Title\nUpdated',
      draftVersion: 5,
    });

    expect(diff.mode).toBe('unified');
    expect(diff.metadata?.approvedVersion).toBe(4);
    expect(diff.metadata?.draftVersion).toBe(5);
    expect(diff.segments.some(segment => segment.type === 'added')).toBe(true);
    expect(diffGenerator).toHaveBeenCalledWith(
      '# Title\nOriginal',
      '# Title\nUpdated',
      expect.objectContaining({
        approvedVersion: 4,
        draftVersion: 5,
        mode: 'split',
        metadata: expect.objectContaining({ sectionId: 'section-1' }),
      })
    );
  });

  it('loads draft content when draftId is provided', async () => {
    const section = {
      id: 'section-1',
      docId: 'document-1',
      approvedVersion: 2,
      approvedContent: 'Alpha',
    };

    const draft = {
      id: 'draft-1',
      sectionId: section.id,
      draftVersion: 3,
      contentMarkdown: 'Alpha Beta',
    } as unknown as Pick<SectionDraft, 'id' | 'sectionId' | 'draftVersion' | 'contentMarkdown'>;

    const sections = {
      findById: vi.fn().mockResolvedValue(section),
    } as unknown as SectionRepositoryImpl;

    const drafts = {
      findById: vi.fn().mockResolvedValue(draft),
    } as unknown as SectionDraftRepositoryImpl;

    const diffGenerator = vi.fn(() => ({
      mode: 'unified' as const,
      segments: [{ type: 'added' as const, content: 'Alpha Beta', startLine: 1, endLine: 1 }],
      metadata: { approvedVersion: 2, draftVersion: draft.draftVersion },
    }));

    const service = new SectionDiffService(sections, drafts, diffGenerator, createLogger());

    const diff = await service.buildDiff({
      sectionId: section.id,
      userId: 'user-1',
      draftId: draft.id,
    });

    expect(drafts.findById).toHaveBeenCalledWith(draft.id);
    expect(diffGenerator).toHaveBeenCalledWith(
      'Alpha',
      'Alpha Beta',
      expect.objectContaining({
        approvedVersion: 2,
        draftVersion: draft.draftVersion,
        mode: 'split',
        metadata: expect.objectContaining({
          sectionId: section.id,
          draftId: draft.id,
        }),
      })
    );
    expect(diff.metadata?.draftVersion).toBe(draft.draftVersion);
  });
});
