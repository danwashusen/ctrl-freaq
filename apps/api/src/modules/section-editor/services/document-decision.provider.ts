import { createHash } from 'crypto';

import type { Logger } from 'pino';

import type { DocumentRepositoryImpl } from '@ctrl-freaq/shared-data';

import type {
  DocumentDecision,
  DocumentDecisionProvider,
  DocumentDecisionSnapshot,
} from './assumption-session.service.js';

interface DocumentDecisionProviderDeps {
  documents: DocumentRepositoryImpl;
  logger: Logger;
}

interface DecisionLogEntry {
  id?: string;
  decision?: string;
  outcome?: string;
  status?: string;
  responseType?: 'single_select' | 'multi_select' | 'text';
  assumptionKeys?: string[];
  assumptionKey?: string;
  optionIds?: string[];
  allowedAnswers?: string[];
}

const DEFAULT_RESPONSE_TYPE: DocumentDecision['responseType'] = 'single_select';

export class DocumentDecisionProviderImpl implements DocumentDecisionProvider {
  private readonly documents: DocumentRepositoryImpl;
  private readonly logger: Logger;

  constructor(deps: DocumentDecisionProviderDeps) {
    this.documents = deps.documents;
    this.logger = deps.logger;
  }

  async getDecisionSnapshot(input: {
    documentId: string;
    sectionId: string;
  }): Promise<DocumentDecisionSnapshot | null> {
    try {
      const document = await this.documents.findById(input.documentId);
      if (!document) {
        this.logger.debug(
          { documentId: input.documentId },
          'No document found when resolving decision snapshot'
        );
        return null;
      }

      const decisions = this.extractDecisions(document.content);
      if (decisions.length === 0) {
        return null;
      }

      const snapshotId = this.computeSnapshotId(decisions);
      return { snapshotId, decisions };
    } catch (error) {
      this.logger.warn(
        {
          documentId: input.documentId,
          sectionId: input.sectionId,
          error: error instanceof Error ? error.message : error,
        },
        'Failed to resolve document decision snapshot'
      );
      return null;
    }
  }

  private extractDecisions(content: Record<string, unknown>): DocumentDecision[] {
    const rawLog = (content?.decision_log ?? []) as unknown;
    if (!Array.isArray(rawLog)) {
      return [];
    }

    const decisions: DocumentDecision[] = [];

    for (const entry of rawLog as DecisionLogEntry[]) {
      if (!entry) {
        continue;
      }

      const assumptionKeys = Array.isArray(entry.assumptionKeys)
        ? entry.assumptionKeys
        : entry.assumptionKey
          ? [entry.assumptionKey]
          : [];

      if (assumptionKeys.length === 0) {
        continue;
      }

      const value =
        typeof entry.decision === 'string'
          ? entry.decision
          : typeof entry.outcome === 'string'
            ? entry.outcome
            : undefined;

      const responseType = entry.responseType ?? DEFAULT_RESPONSE_TYPE;
      const allowedOptionIds = Array.isArray(entry.optionIds)
        ? entry.optionIds.filter((candidate): candidate is string => typeof candidate === 'string')
        : [];
      const allowedAnswers = Array.isArray(entry.allowedAnswers)
        ? entry.allowedAnswers.filter(
            (candidate): candidate is string => typeof candidate === 'string'
          )
        : value
          ? [value]
          : [];

      for (const key of assumptionKeys) {
        if (typeof key !== 'string' || key.trim().length === 0) {
          continue;
        }

        decisions.push({
          id: entry.id ?? key,
          templateKey: key,
          responseType,
          allowedOptionIds,
          allowedAnswers,
          value,
          status: entry.status,
        });
      }
    }

    return decisions;
  }

  private computeSnapshotId(decisions: DocumentDecision[]): string {
    const hash = createHash('sha256');
    hash.update(
      JSON.stringify(
        decisions
          .map(decision => ({
            id: decision.id,
            key: decision.templateKey,
            value: decision.value ?? null,
            options: decision.allowedOptionIds ?? [],
            answers: decision.allowedAnswers ?? [],
            status: decision.status ?? null,
          }))
          .sort((a, b) => `${a.key}:${a.id}`.localeCompare(`${b.key}:${b.id}`))
      )
    );
    return hash.digest('hex');
  }
}
