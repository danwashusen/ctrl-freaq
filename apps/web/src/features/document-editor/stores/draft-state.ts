import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export type DraftStatus = 'synced' | 'pending' | 'conflict';

interface DraftEntry {
  status: DraftStatus;
  complianceWarning: boolean;
  lastUpdated: number;
}

interface DraftStateStore {
  drafts: Record<string, DraftEntry>;
  setDraftStatus: (draftKey: string, status: DraftStatus) => void;
  setComplianceWarning: (draftKey: string, warning: boolean) => void;
  clearDraft: (draftKey: string) => void;
  reset: () => void;
}

export const useDraftStateStore = create<DraftStateStore>()(
  devtools(
    immer(set => ({
      drafts: {},
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
        });
      },
      reset: () => {
        set(state => {
          state.drafts = {};
        });
      },
    }))
  )
);
