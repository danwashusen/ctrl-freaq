export interface ProposalRecord {
  proposalId: string;
  proposalIndex: number;
  contentMarkdown: string;
  rationale: Array<{ assumptionId: string; summary: string }>;
  source: 'ai_generated' | 'manual_revision' | 'ai_retry' | 'fallback_manual';
  recordedAt?: string;
}

export interface ProposalHistoryEntry extends ProposalRecord {
  supersededByProposalId: string | null;
  createdAt: string;
}

export interface ProposalStoreOptions {
  sessionId: string;
}

export interface ProposalStore {
  recordProposal(record: ProposalRecord): void;
  getHistory(): ProposalHistoryEntry[];
  recordFailure(details: {
    reason: string;
    recoveryAction: 'retry' | 'manual';
    timestamp: string;
  }): void;
  getLatestFailure(): {
    reason: string;
    recoveryAction: 'retry' | 'manual';
    timestamp: string;
  } | null;
  hydrateHistory(entries: ProposalHistoryEntry[]): void;
  clear(): void;
}

const MAX_HISTORY_ENTRIES = 10;

const normaliseHistoryEntries = (entries: ProposalHistoryEntry[]): ProposalHistoryEntry[] => {
  const deduped: ProposalHistoryEntry[] = [];

  for (const entry of entries) {
    if (!deduped.some(existing => existing.proposalId === entry.proposalId)) {
      deduped.push({ ...entry });
    }
  }

  deduped.sort((a, b) => {
    if (a.proposalIndex === b.proposalIndex) {
      return a.createdAt.localeCompare(b.createdAt);
    }
    return a.proposalIndex - b.proposalIndex;
  });

  const start = Math.max(deduped.length - MAX_HISTORY_ENTRIES, 0);
  const limited = deduped.slice(start);

  return limited.map((entry, index) => ({
    ...entry,
    supersededByProposalId: limited[index + 1]?.proposalId ?? null,
  }));
};

export const createProposalStore = (_options: ProposalStoreOptions): ProposalStore => {
  let history: ProposalHistoryEntry[] = [];
  let latestFailure: {
    reason: string;
    recoveryAction: 'retry' | 'manual';
    timestamp: string;
  } | null = null;

  const cloneHistory = () => history.map(entry => ({ ...entry }));

  return {
    recordProposal(record: ProposalRecord) {
      const timestamp = record.recordedAt ?? new Date().toISOString();
      const nextEntry: ProposalHistoryEntry = {
        ...record,
        createdAt: timestamp,
        supersededByProposalId: null,
      };

      history = normaliseHistoryEntries([
        ...history.filter(entry => entry.proposalId !== record.proposalId),
        nextEntry,
      ]);

      latestFailure = null;
    },

    getHistory(): ProposalHistoryEntry[] {
      return cloneHistory();
    },

    recordFailure(details) {
      latestFailure = { ...details };
    },

    getLatestFailure() {
      return latestFailure ? { ...latestFailure } : null;
    },

    hydrateHistory(entries: ProposalHistoryEntry[]) {
      history = normaliseHistoryEntries(entries);
      latestFailure = null;
    },

    clear() {
      history = [];
      latestFailure = null;
    },
  };
};
