import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SectionEditorClientError, SectionEditorConflictError } from '../api/section-editor.client';
import type { ConflictCheckResponseDTO } from '../api/section-editor.mappers';
import { useSectionDraftStore } from './section-draft-store';

const baseConflict: ConflictCheckResponseDTO = {
  status: 'rebase_required',
  latestApprovedVersion: 4,
  conflictReason: 'Server has newer content',
  events: [],
};

describe('section-draft-store', () => {
  beforeEach(() => {
    useSectionDraftStore.getState().reset();
    vi.useRealTimers();
  });

  it('initializes metadata and defaults', () => {
    useSectionDraftStore.getState().initialize({
      sectionId: 'sec-1',
      draftBaseVersion: 7,
    });

    const state = useSectionDraftStore.getState();

    expect(state.sectionId).toBe('sec-1');
    expect(state.draftBaseVersion).toBe(7);
    expect(state.summaryNote).toBe('');
    expect(state.conflictState).toBe('clean');
    expect(state.lastManualSaveAt).toBeNull();
  });

  it('tracks summary updates', () => {
    const store = useSectionDraftStore.getState();
    store.setSummary('Initial summary');

    expect(useSectionDraftStore.getState().summaryNote).toBe('Initial summary');
  });

  it('updates state after successful manual save with matching request id', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-09-25T10:00:00.000Z'));

    const store = useSectionDraftStore.getState();

    store.initialize({
      sectionId: 'sec-1',
      draftId: 'draft-0',
      draftVersion: 2,
      draftBaseVersion: 1,
      summaryNote: 'Existing summary',
    });

    store.beginSave('req-1');

    store.completeSave(
      {
        draftId: 'draft-1',
        sectionId: 'sec-1',
        draftVersion: 3,
        conflictState: 'clean',
        formattingAnnotations: [
          {
            id: 'ann-1',
            startOffset: 0,
            endOffset: 10,
            markType: 'unsupported-color',
            message: 'No inline colors',
            severity: 'warning',
          },
        ],
        savedAt: '2025-09-25T10:00:00.000Z',
        savedBy: 'user-1',
        summaryNote: 'Updated summary',
      },
      { requestId: 'req-1', draftBaseVersion: 3 }
    );

    const state = useSectionDraftStore.getState();
    expect(state.isSaving).toBe(false);
    expect(state.draftId).toBe('draft-1');
    expect(state.draftVersion).toBe(3);
    expect(state.draftBaseVersion).toBe(3);
    expect(state.summaryNote).toBe('Updated summary');
    expect(state.formattingAnnotations).toHaveLength(1);
    expect(state.lastSavedAt).toBe('2025-09-25T10:00:00.000Z');
    expect(state.lastManualSaveAt).toBe(Date.now());
  });

  it('ignores save completion when request identifiers differ', () => {
    const store = useSectionDraftStore.getState();
    store.initialize({ sectionId: 'sec-1' });
    store.beginSave('req-expected');

    store.completeSave(
      {
        draftId: 'draft-should-ignore',
        sectionId: 'sec-1',
        draftVersion: 5,
        conflictState: 'rebased',
        formattingAnnotations: [],
        savedAt: '2025-09-25T10:01:00.000Z',
        savedBy: 'user-2',
        summaryNote: 'Should not apply',
      },
      { requestId: 'req-other' }
    );

    const state = useSectionDraftStore.getState();
    expect(state.draftId).toBeNull();
    expect(state.draftVersion).toBeNull();
    expect(state.summaryNote).toBe('');
    expect(state.isSaving).toBe(true);
  });

  it('records conflicts and rebased draft content', () => {
    const store = useSectionDraftStore.getState();

    store.applyConflict({
      ...baseConflict,
      latestApprovedVersion: 8,
      rebasedDraft: {
        draftVersion: 6,
        contentMarkdown: '# Rebases',
        formattingAnnotations: [],
      },
      serverSnapshot: {
        version: 8,
        content: '## Server view v8',
        capturedAt: '2025-09-30T12:00:00.000Z',
      },
    });

    const state = useSectionDraftStore.getState();
    expect(state.conflictState).toBe('rebase_required');
    expect(state.latestApprovedVersion).toBe(8);
    expect(state.conflictReason).toBe('Server has newer content');
    expect(state.rebasedDraft?.draftVersion).toBe(6);
    expect(state.serverSnapshots[8]?.content).toBe('## Server view v8');
  });

  it('retains conflict events from history calls', () => {
    const store = useSectionDraftStore.getState();
    store.recordConflictEvents([
      {
        detectedAt: '2025-09-25T10:10:00.000Z',
        detectedDuring: 'entry',
        previousApprovedVersion: 3,
        latestApprovedVersion: 4,
        resolvedBy: 'auto_rebase',
        resolutionNote: null,
      },
    ]);

    expect(useSectionDraftStore.getState().conflictEvents).toHaveLength(1);
  });

  it('archives server revisions for later replay', () => {
    const store = useSectionDraftStore.getState();
    store.recordServerSnapshot({
      version: 9,
      content: '## Approved server content v9',
      capturedAt: '2025-09-30T12:34:56.000Z',
    });

    const state = useSectionDraftStore.getState();
    expect(state.serverSnapshots[9]?.content).toBe('## Approved server content v9');
    expect(state.serverSnapshots[9]?.capturedAt).toBe('2025-09-30T12:34:56.000Z');
  });

  it('captures errors on failed saves and clears saving flag', () => {
    const store = useSectionDraftStore.getState();
    const error = new SectionEditorClientError('Unauthorized', {
      status: 401,
      requestId: 'req-err',
    });

    store.beginSave('req-err');
    store.failSave(error, { requestId: 'req-err' });

    const state = useSectionDraftStore.getState();
    expect(state.isSaving).toBe(false);
    expect(state.saveError).toBe(error);
  });

  it('ignores error updates for stale requests', () => {
    const store = useSectionDraftStore.getState();
    const error = new SectionEditorConflictError(baseConflict);
    store.beginSave('req-current');
    store.failSave(error, { requestId: 'req-stale' });

    expect(useSectionDraftStore.getState().saveError).toBeNull();
  });

  it('resets to initial state', () => {
    const store = useSectionDraftStore.getState();
    store.initialize({ sectionId: 'sec-1', draftId: 'draft-1' });
    store.reset();

    const state = useSectionDraftStore.getState();
    expect(state.sectionId).toBeNull();
    expect(state.draftId).toBeNull();
    expect(state.conflictState).toBe('clean');
  });
});
