import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export type DraftStatus = 'synced' | 'pending' | 'conflict';

interface DraftEntry {
  status: DraftStatus;
  complianceWarning: boolean;
  lastUpdated: number;
}

type RehydratedDraftStatus = 'pending' | 'applied' | 'discarded';

interface RehydratedDraftRecord {
  draftKey: string;
  sectionTitle: string;
  sectionPath: string;
  baselineVersion?: string | null;
  lastEditedAt?: number | null;
  status: RehydratedDraftStatus;
  confirm?: () => Promise<void>;
  discard?: () => Promise<void>;
}

interface DraftStateStore {
  drafts: Record<string, DraftEntry>;
  setDraftStatus: (draftKey: string, status: DraftStatus) => void;
  setComplianceWarning: (draftKey: string, warning: boolean) => void;
  clearDraft: (draftKey: string) => void;
  rehydratedDrafts: Record<string, RehydratedDraftRecord>;
  markDraftRehydrated: (record: Omit<RehydratedDraftRecord, 'status'>) => void;
  resolveRehydratedDraft: (
    draftKey: string,
    status: Exclude<RehydratedDraftStatus, 'pending'>
  ) => void;
  clearRehydratedDraft: (draftKey: string) => void;
  reset: () => void;
}

export const useDraftStateStore = create<DraftStateStore>()(
  devtools(
    immer(set => ({
      drafts: {},
      rehydratedDrafts: {},
      setDraftStatus: (draftKey, status) => {
        set(state => {
          const existing = state.drafts[draftKey];
          state.drafts[draftKey] = {
            status,
            complianceWarning: existing?.complianceWarning ?? false,
            lastUpdated: Date.now(),
          };
        });
      },
      setComplianceWarning: (draftKey, warning) => {
        set(state => {
          const existing = state.drafts[draftKey];
          if (!existing) {
            state.drafts[draftKey] = {
              status: warning ? 'conflict' : 'pending',
              complianceWarning: warning,
              lastUpdated: Date.now(),
            };
          } else {
            existing.complianceWarning = warning;
            existing.lastUpdated = Date.now();
            if (warning && existing.status !== 'conflict') {
              existing.status = 'conflict';
            }
          }
        });
      },
      clearDraft: draftKey => {
        set(state => {
          delete state.drafts[draftKey];
          delete state.rehydratedDrafts[draftKey];
        });
      },
      markDraftRehydrated: record => {
        set(state => {
          const baselineVersion = record.baselineVersion ?? null;
          const lastEditedAt = record.lastEditedAt ?? null;
          const existing = state.rehydratedDrafts[record.draftKey];

          if (
            existing &&
            existing.status === 'pending' &&
            existing.sectionTitle === record.sectionTitle &&
            existing.sectionPath === record.sectionPath &&
            existing.baselineVersion === baselineVersion &&
            existing.lastEditedAt === lastEditedAt &&
            existing.confirm === record.confirm &&
            existing.discard === record.discard
          ) {
            return;
          }

          state.rehydratedDrafts[record.draftKey] = {
            draftKey: record.draftKey,
            sectionTitle: record.sectionTitle,
            sectionPath: record.sectionPath,
            baselineVersion,
            lastEditedAt,
            status: 'pending',
            confirm: record.confirm,
            discard: record.discard,
          } satisfies RehydratedDraftRecord;
        });
      },
      resolveRehydratedDraft: (draftKey, status) => {
        set(state => {
          const existing = state.rehydratedDrafts[draftKey];
          if (!existing) {
            return;
          }
          existing.status = status;
        });
      },
      clearRehydratedDraft: draftKey => {
        set(state => {
          delete state.rehydratedDrafts[draftKey];
        });
      },
      reset: () => {
        set(state => {
          state.drafts = {};
          state.rehydratedDrafts = {};
        });
      },
    }))
  )
);
