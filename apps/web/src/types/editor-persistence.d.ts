declare module '@ctrl-freaq/editor-persistence' {
  export interface ManualDraftFormattingAnnotation {
    id: string;
    startOffset: number;
    endOffset: number;
    markType: string;
    message: string;
    severity: 'warning' | 'error';
  }

  export interface ManualDraftPayload {
    draftId: string;
    sectionId: string;
    documentId: string;
    userId: string;
    contentMarkdown: string;
    summaryNote?: string;
    draftVersion: number;
    draftBaseVersion: number;
    conflictState: 'clean' | 'rebase_required' | 'rebased' | 'blocked';
    conflictReason?: string | null;
    formattingAnnotations?: ManualDraftFormattingAnnotation[];
    savedAt?: string | Date;
    lastSyncedAt?: string | Date | null;
  }

  export interface ManualDraftRecord extends ManualDraftPayload {
    summaryNote: string;
    conflictReason: string | null;
    formattingAnnotations: ManualDraftFormattingAnnotation[];
    savedAt: string;
    updatedAt: string;
    lastSyncedAt: string | null;
  }

  export interface ManualDraftStorage {
    saveDraft(payload: ManualDraftPayload): Promise<ManualDraftRecord>;
    loadDraft(
      documentId: string,
      sectionId: string,
      userId: string
    ): Promise<ManualDraftRecord | null>;
    deleteDraft(documentId: string, sectionId: string, userId: string): Promise<void>;
  }

  export function createManualDraftStorage(config?: Record<string, unknown>): ManualDraftStorage;
}
