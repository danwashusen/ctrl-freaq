import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('zustand', async () => {
  const actual = await vi.importActual<typeof import('zustand')>('zustand');
  return actual;
});

vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual<typeof import('zustand/middleware')>('zustand/middleware');
  return actual;
});

import { useEditorStore } from './editor-store';
import type { SectionView } from '../types/section-view';

const baseSection: SectionView = {
  id: 'section-1',
  docId: 'doc-1',
  parentSectionId: null,
  key: 'overview',
  title: 'Architecture Overview',
  depth: 0,
  orderIndex: 0,
  contentMarkdown: '# Intro',
  placeholderText: 'Placeholder',
  hasContent: true,
  viewState: 'read_mode',
  editingUser: null,
  lastModified: new Date().toISOString(),
  status: 'drafting',
  assumptionsResolved: true,
  qualityGateStatus: 'passed',
  approvedVersion: 6,
  approvedAt: '2025-10-01T12:00:00.000Z',
  approvedBy: 'engineer@example.com',
  lastSummary: 'Initial approval.',
  draftId: 'draft-1',
  draftVersion: 3,
  draftBaseVersion: 3,
  latestApprovedVersion: 6,
  conflictState: 'clean',
  conflictReason: null,
  summaryNote: 'Pending updates',
  lastSavedAt: '2025-10-02T11:45:00.000Z',
  lastSavedBy: 'engineer@example.com',
  lastManualSaveAt: Date.now(),
};

interface ConflictEventPayload {
  sectionId: string;
  conflictState: SectionView['conflictState'];
  conflictReason?: string | null;
  latestApprovedVersion?: number | null;
}

interface DiffEventPayload {
  sectionId: string;
  draftVersion?: number | null;
  draftBaseVersion?: number | null;
  approvedVersion?: number | null;
}

interface EditorStoreRealtimeActions {
  applyConflictEvent: (payload: ConflictEventPayload) => void;
  applyDiffEvent: (payload: DiffEventPayload) => void;
}

beforeEach(() => {
  useEditorStore.getState().reset();
  useEditorStore.getState().loadSection(baseSection);
});

describe('editor-store metadata helpers', () => {
  it('sets draft metadata without touching other fields', () => {
    useEditorStore.getState().setDraftMetadata('section-1', {
      draftId: 'draft-2',
      draftVersion: 4,
      draftBaseVersion: 4,
      latestApprovedVersion: 7,
    });

    const section = useEditorStore.getState().sections['section-1'];
    expect(section).toBeDefined();
    expect(section?.draftId).toBe('draft-2');
    expect(section?.draftVersion).toBe(4);
    expect(section?.latestApprovedVersion).toBe(7);
    expect(section?.title).toBe('Architecture Overview');
  });

  it('records conflict state updates', () => {
    useEditorStore.getState().setConflictState('section-1', {
      conflictState: 'rebase_required',
      conflictReason: 'New approved content detected.',
      latestApprovedVersion: 8,
    });

    const section = useEditorStore.getState().sections['section-1'];
    expect(section).toBeDefined();
    expect(section?.conflictState).toBe('rebase_required');
    expect(section?.conflictReason).toBe('New approved content detected.');
    expect(section?.latestApprovedVersion).toBe(8);
  });

  it('applies approval metadata and persists content', () => {
    useEditorStore.getState().setApprovalMetadata('section-1', {
      approvedVersion: 7,
      approvedAt: '2025-10-05T09:00:00.000Z',
      approvedBy: 'staff@example.com',
      lastSummary: 'Final approval note',
      contentMarkdown: '## Approved content',
    });

    const section = useEditorStore.getState().sections['section-1'];
    expect(section).toBeDefined();
    expect(section?.approvedVersion).toBe(7);
    expect(section?.approvedBy).toBe('staff@example.com');
    expect(section?.lastSummary).toBe('Final approval note');
    expect(section?.contentMarkdown).toBe('## Approved content');
    expect(section?.status).toBe('ready');
    expect(section?.conflictState).toBe('clean');
  });
});

describe('editor-store realtime reducers', () => {
  it('applies conflict events idempotently', () => {
    const store = useEditorStore.getState() as unknown as EditorStoreRealtimeActions;
    expect(typeof store.applyConflictEvent).toBe('function');

    const payload: ConflictEventPayload = {
      sectionId: 'section-1',
      conflictState: 'rebase_required',
      conflictReason: 'Server detected newer approved content.',
      latestApprovedVersion: 9,
    };

    store.applyConflictEvent(payload);
    store.applyConflictEvent(payload);

    const section = useEditorStore.getState().sections['section-1'];
    expect(section?.conflictState).toBe('rebase_required');
    expect(section?.conflictReason).toBe('Server detected newer approved content.');
    expect(section?.latestApprovedVersion).toBe(9);
  });

  it('applies diff events and maintains draft metadata consistency', () => {
    const store = useEditorStore.getState() as unknown as EditorStoreRealtimeActions;
    expect(typeof store.applyDiffEvent).toBe('function');

    const payload: DiffEventPayload = {
      sectionId: 'section-1',
      draftVersion: 8,
      draftBaseVersion: 6,
      approvedVersion: 7,
    };

    store.applyDiffEvent(payload);
    store.applyDiffEvent(payload);

    const section = useEditorStore.getState().sections['section-1'];
    expect(section?.draftVersion).toBe(8);
    expect(section?.draftBaseVersion).toBe(6);
    expect(section?.approvedVersion).toBe(7);
  });
});
