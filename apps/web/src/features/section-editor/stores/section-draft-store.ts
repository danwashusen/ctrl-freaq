import { create } from 'zustand';

import type {
  ConflictCheckResponseDTO,
  ConflictLogEntryDTO,
  FormattingAnnotationDTO,
  RebasedDraftDTO,
  SectionDraftResponseDTO,
} from '../api/section-editor.mappers';
import type { SectionEditorClientError } from '../api/section-editor.client';

type ConflictState = 'clean' | 'rebase_required' | 'rebased' | 'blocked';

interface SectionDraftStoreSnapshot {
  sectionId: string | null;
  draftId: string | null;
  draftVersion: number | null;
  draftBaseVersion: number | null;
  conflictState: ConflictState;
  conflictReason: string | null;
  latestApprovedVersion: number | null;
  conflictEvents: ConflictLogEntryDTO[];
  rebasedDraft: RebasedDraftDTO | null;
  formattingAnnotations: FormattingAnnotationDTO[];
  summaryNote: string;
  isSaving: boolean;
  lastSavedAt: string | null;
  lastSavedBy: string | null;
  lastManualSaveAt: number | null;
  lastRequestId: string | null;
  saveError: SectionEditorClientError | null;
  serverSnapshots: Record<
    number,
    {
      content: string;
      capturedAt: string;
    }
  >;
}

export interface SectionDraftStoreState extends SectionDraftStoreSnapshot {
  initialize: (payload: InitializePayload) => void;
  setSummary: (summary: string) => void;
  beginSave: (requestId: string) => void;
  completeSave: (response: SectionDraftResponseDTO, meta?: CompleteSaveMeta) => void;
  failSave: (error: SectionEditorClientError, meta?: FailSaveMeta) => void;
  applyConflict: (conflict: ConflictCheckResponseDTO) => void;
  recordConflictEvents: (events: ConflictLogEntryDTO[]) => void;
  setFormattingAnnotations: (annotations: FormattingAnnotationDTO[]) => void;
  recordServerSnapshot: (snapshot: {
    version: number;
    content: string;
    capturedAt?: string;
  }) => void;
  reset: () => void;
}

interface InitializePayload {
  sectionId: string;
  draftId?: string | null;
  draftVersion?: number | null;
  draftBaseVersion?: number | null;
  summaryNote?: string | null;
  conflictState?: ConflictState;
  conflictReason?: string | null;
  latestApprovedVersion?: number | null;
  conflictEvents?: ConflictLogEntryDTO[];
  formattingAnnotations?: FormattingAnnotationDTO[];
  lastSavedAt?: string | null;
  lastSavedBy?: string | null;
  lastManualSaveAt?: number | null;
  rebasedDraft?: RebasedDraftDTO | null;
}

interface CompleteSaveMeta {
  requestId?: string;
  draftBaseVersion?: number | null;
}

interface FailSaveMeta {
  requestId?: string;
}

const createInitialState = (): SectionDraftStoreSnapshot => ({
  sectionId: null,
  draftId: null,
  draftVersion: null,
  draftBaseVersion: null,
  conflictState: 'clean',
  conflictReason: null,
  latestApprovedVersion: null,
  conflictEvents: [],
  rebasedDraft: null,
  formattingAnnotations: [],
  summaryNote: '',
  isSaving: false,
  lastSavedAt: null,
  lastSavedBy: null,
  lastManualSaveAt: null,
  lastRequestId: null,
  saveError: null,
  serverSnapshots: {},
});

const shouldIgnoreByRequestId = (currentRequestId: string | null, metaRequestId?: string) =>
  Boolean(metaRequestId && currentRequestId && metaRequestId !== currentRequestId);

export const useSectionDraftStore = create<SectionDraftStoreState>(set => ({
  ...createInitialState(),

  initialize: payload => {
    set(() => ({
      ...createInitialState(),
      sectionId: payload.sectionId ?? null,
      draftId: payload.draftId ?? null,
      draftVersion: payload.draftVersion ?? null,
      draftBaseVersion: payload.draftBaseVersion ?? null,
      summaryNote: payload.summaryNote ?? '',
      conflictState: payload.conflictState ?? 'clean',
      conflictReason: payload.conflictReason ?? null,
      latestApprovedVersion: payload.latestApprovedVersion ?? null,
      conflictEvents: payload.conflictEvents ?? [],
      formattingAnnotations: payload.formattingAnnotations ?? [],
      lastSavedAt: payload.lastSavedAt ?? null,
      lastSavedBy: payload.lastSavedBy ?? null,
      lastManualSaveAt: payload.lastManualSaveAt ?? null,
      rebasedDraft: payload.rebasedDraft ?? null,
      saveError: null,
    }));
  },

  setSummary: summary => {
    set(state => ({
      ...state,
      summaryNote: summary,
    }));
  },

  beginSave: requestId => {
    set(state => ({
      ...state,
      isSaving: true,
      lastRequestId: requestId,
      saveError: null,
    }));
  },

  completeSave: (response, meta) => {
    set(state => {
      if (shouldIgnoreByRequestId(state.lastRequestId, meta?.requestId)) {
        return state;
      }

      return {
        ...state,
        isSaving: false,
        lastRequestId: null,
        saveError: null,
        draftId: response.draftId,
        sectionId: response.sectionId ?? state.sectionId,
        draftVersion: response.draftVersion,
        draftBaseVersion: meta?.draftBaseVersion ?? state.draftBaseVersion,
        conflictState: response.conflictState,
        conflictReason: null,
        latestApprovedVersion: null,
        rebasedDraft: null,
        formattingAnnotations: [...response.formattingAnnotations],
        summaryNote: response.summaryNote ?? '',
        lastSavedAt: response.savedAt ?? null,
        lastSavedBy: response.savedBy ?? null,
        lastManualSaveAt: Date.now(),
      };
    });
  },

  failSave: (error, meta) => {
    set(state => {
      if (shouldIgnoreByRequestId(state.lastRequestId, meta?.requestId)) {
        return state;
      }

      return {
        ...state,
        isSaving: false,
        lastRequestId: null,
        saveError: error,
      };
    });
  },

  applyConflict: conflict => {
    set(state => ({
      ...state,
      isSaving: false,
      lastRequestId: null,
      conflictState: conflict.status,
      conflictReason: conflict.conflictReason ?? null,
      latestApprovedVersion: conflict.latestApprovedVersion,
      rebasedDraft: conflict.rebasedDraft ?? null,
      conflictEvents: conflict.events ?? [],
      formattingAnnotations: conflict.rebasedDraft?.formattingAnnotations
        ? [...conflict.rebasedDraft.formattingAnnotations]
        : state.formattingAnnotations,
    }));
    if (conflict.serverSnapshot) {
      const { version, content, capturedAt } = conflict.serverSnapshot;
      set(state => ({
        ...state,
        serverSnapshots: {
          ...state.serverSnapshots,
          [version]: {
            content,
            capturedAt: capturedAt ?? new Date().toISOString(),
          },
        },
      }));
    }
  },

  recordConflictEvents: events => {
    set(state => ({
      ...state,
      conflictEvents: [...events],
    }));
  },

  setFormattingAnnotations: annotations => {
    set(state => ({
      ...state,
      formattingAnnotations: [...annotations],
    }));
  },

  recordServerSnapshot: snapshot => {
    set(state => ({
      ...state,
      serverSnapshots: {
        ...state.serverSnapshots,
        [snapshot.version]: {
          content: snapshot.content,
          capturedAt: snapshot.capturedAt ?? new Date().toISOString(),
        },
      },
    }));
  },

  reset: () => {
    set(() => ({ ...createInitialState() }));
  },
}));

export const sectionDraftInitialState: SectionDraftStoreSnapshot = createInitialState();
