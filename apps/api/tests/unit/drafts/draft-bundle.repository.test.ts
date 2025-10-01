import { describe, expect, test, vi } from 'vitest';

import { createPatchEngine } from '@ctrl-freaq/editor-core';
import type { FinalizeApprovalContext, SectionView } from '@ctrl-freaq/shared-data';
import type { Logger } from 'pino';

import { DraftBundleRepositoryImpl } from '../../../src/services/drafts/draft-bundle.repository';
import { DraftBundleValidationError } from '../../../src/services/drafts/draft-bundle.service';

function createSection(overrides: Partial<SectionView> = {}): SectionView {
  const timestamp = new Date('2025-09-30T12:00:00.000Z');
  return {
    id: 'section-1',
    docId: 'document-1',
    parentSectionId: null,
    key: 'section-1',
    title: 'Architecture Overview',
    depth: 0,
    orderIndex: 1,
    contentMarkdown: overrides.contentMarkdown ?? 'Original content',
    placeholderText: 'Placeholder content pending author input.',
    hasContent: true,
    viewState: 'read_mode',
    editingUser: null,
    lastModified: timestamp,
    status: 'ready',
    assumptionsResolved: true,
    qualityGateStatus: 'passed',
    approvedVersion: overrides.approvedVersion ?? 1,
    approvedContent: overrides.approvedContent ?? 'Original content',
    approvedAt: timestamp,
    approvedBy: 'reviewer-1',
    lastSummary: null,
    qualityGate: overrides.qualityGate ?? 'passed',
    accessibilityScore: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  } satisfies SectionView;
}

function createRepository(section: SectionView) {
  const sections = {
    findById: vi.fn(async (id: string) => (id === section.id ? section : null)),
    finalizeApproval: vi.fn(async (_section: SectionView, context: FinalizeApprovalContext) => {
      section.approvedContent = context.approvedContent;
      section.approvedVersion = context.approvedVersion;
      section.updatedAt = context.approvedAt;
      section.approvedAt = context.approvedAt;
      section.approvedBy = context.approvedBy;
      section.status = context.status ?? section.status;
      section.qualityGate = context.qualityGate ?? section.qualityGate;
      section.contentMarkdown = context.approvedContent;
      return { ...section } satisfies SectionView;
    }),
  };

  const logger = {
    info: vi.fn(),
    error: vi.fn(),
  } as unknown as Logger;

  const repository = new DraftBundleRepositoryImpl(sections as unknown as any, logger);

  return { repository, sections };
}

describe('DraftBundleRepositoryImpl', () => {
  test('applies JSON patch operations to baseline content', async () => {
    const section = createSection();
    const { repository, sections } = createRepository(section);
    const patchEngine = createPatchEngine();
    const patches = patchEngine.createPatch('Original content', 'Updated content');

    await repository.applySectionPatch({
      draftKey: 'project/demo/document/Architecture Overview/user-1',
      sectionPath: section.id,
      patch: JSON.stringify(patches),
      baselineVersion: 'rev-1',
      qualityGateReport: { status: 'pass', issues: [] },
      documentId: section.docId,
      projectSlug: 'project-demo',
      authorId: 'user-1',
    });

    expect(sections.finalizeApproval).toHaveBeenCalledWith(
      section,
      expect.objectContaining({
        approvedContent: 'Updated content',
        approvedVersion: 2,
        approvedBy: 'user-1',
      })
    );
  });

  test('falls back to raw patch content when JSON parsing fails', async () => {
    const section = createSection();
    const { repository, sections } = createRepository(section);

    await repository.applySectionPatch({
      draftKey: 'project/demo/document/Architecture Overview/user-1',
      sectionPath: section.id,
      patch: 'Updated raw content block',
      baselineVersion: 'rev-1',
      qualityGateReport: { status: 'pass', issues: [] },
      documentId: section.docId,
      projectSlug: 'project-demo',
      authorId: 'user-1',
    });

    expect(sections.finalizeApproval).toHaveBeenCalledWith(
      section,
      expect.objectContaining({ approvedContent: 'Updated raw content block' })
    );
  });

  test('throws DraftBundleValidationError when patch application fails', async () => {
    const section = createSection({
      approvedContent: 'Server baseline',
      contentMarkdown: 'Server baseline',
    });
    const { repository } = createRepository(section);
    const impossiblePatch = JSON.stringify([
      {
        op: 'remove',
        path: '/line/1',
        oldValue: 'Content that does not exist in baseline',
      },
    ]);

    await expect(
      repository.applySectionPatch({
        draftKey: 'project/demo/document/Architecture Overview/user-1',
        sectionPath: section.id,
        patch: impossiblePatch,
        baselineVersion: 'rev-1',
        qualityGateReport: { status: 'pass', issues: [] },
        documentId: section.docId,
        projectSlug: 'project-demo',
        authorId: 'user-1',
      })
    ).rejects.toBeInstanceOf(DraftBundleValidationError);
  });

  test('includes server snapshot when baseline validation fails', async () => {
    const section = createSection({
      approvedVersion: 5,
      approvedContent: '## Server approved content v5',
    });
    const { repository } = createRepository(section);

    await expect(
      repository.validateBaseline({
        draftKey: 'project/demo/document/Architecture Overview/user-1',
        sectionPath: section.id,
        patch: 'noop',
        baselineVersion: 'rev-4',
        qualityGateReport: { status: 'pass', issues: [] },
        documentId: section.docId,
        projectSlug: 'project-demo',
        authorId: 'user-1',
      })
    ).rejects.toMatchObject({
      conflicts: [
        {
          sectionPath: section.id,
          serverVersion: 5,
          serverContent: '## Server approved content v5',
        },
      ],
    });
  });
});
