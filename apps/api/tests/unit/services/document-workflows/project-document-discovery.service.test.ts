import { describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

import type {
  DocumentRepositoryImpl,
  ProjectDocumentSnapshot,
  TemplateValidationDecisionRecord,
  TemplateValidationDecisionRepository,
} from '@ctrl-freaq/shared-data';

import { ProjectDocumentDiscoveryService } from '../../../../src/services/document-workflows/project-document-discovery.service.js';

const DEFAULT_PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const DEFAULT_DOCUMENT_ID = '22222222-2222-4222-8222-222222222222';
const DEFAULT_SECTION_ID = '33333333-3333-4333-8333-333333333333';

const buildSnapshot = (overrides?: Partial<ProjectDocumentSnapshot>): ProjectDocumentSnapshot => {
  const hasDocumentOverride =
    overrides !== undefined && Object.prototype.hasOwnProperty.call(overrides, 'document');
  const documentOverride = hasDocumentOverride ? overrides?.document : undefined;
  return {
    projectId: overrides?.projectId ?? DEFAULT_PROJECT_ID,
    status: overrides?.status ?? 'ready',
    document:
      documentOverride !== undefined
        ? documentOverride
        : ({
            documentId: DEFAULT_DOCUMENT_ID,
            firstSectionId: DEFAULT_SECTION_ID,
            title: 'Architecture',
            lifecycleStatus: 'draft',
            lastModifiedAt: '2026-05-02T15:00:00.000Z',
            template: {
              templateId: 'architecture',
              templateVersion: '1.0.0',
              templateSchemaHash: 'hash-1',
            },
          } as ProjectDocumentSnapshot['document']),
    templateDecision: null,
    lastUpdatedAt: overrides?.lastUpdatedAt ?? '2026-05-02T15:00:00.000Z',
  };
};

describe('ProjectDocumentDiscoveryService', () => {
  const buildService = ({
    snapshot,
    decision,
  }: {
    snapshot?: ProjectDocumentSnapshot;
    decision?: TemplateValidationDecisionRecord | null;
  }) => {
    const documents: Pick<DocumentRepositoryImpl, 'fetchProjectDocumentSnapshot'> = {
      fetchProjectDocumentSnapshot: vi.fn().mockResolvedValue(snapshot ?? buildSnapshot()),
    };
    const templateDecisions: Pick<
      TemplateValidationDecisionRepository,
      'findLatestByDocument' | 'findLatestByProject'
    > = {
      findLatestByDocument: vi.fn().mockResolvedValue(decision ?? null),
      findLatestByProject: vi.fn(),
    };
    const logger: Pick<Logger, 'error' | 'warn'> = {
      error: vi.fn(),
      warn: vi.fn(),
    };
    return {
      service: new ProjectDocumentDiscoveryService({
        documents: documents as DocumentRepositoryImpl,
        templateDecisions: templateDecisions as TemplateValidationDecisionRepository,
        logger: logger as Logger,
      }),
      documents,
      templateDecisions,
    };
  };

  it('fetches template decisions scoped to the current document when available', async () => {
    const snapshot = buildSnapshot();
    const decision: TemplateValidationDecisionRecord = {
      id: '44444444-4444-4444-8444-444444444444',
      projectId: snapshot.projectId,
      documentId: snapshot.document!.documentId,
      templateId: 'architecture',
      currentVersion: '1.0.0',
      requestedVersion: '2.0.0',
      action: 'pending',
      notes: null,
      submittedBy: 'user-1',
      submittedAt: new Date('2026-05-02T15:05:00.000Z'),
      payload: null,
      createdAt: new Date('2026-05-02T15:05:00.000Z'),
      updatedAt: new Date('2026-05-02T15:05:00.000Z'),
    };

    const { service, templateDecisions } = buildService({ snapshot, decision });

    const result = await service.fetchPrimaryDocumentSnapshot(snapshot.projectId);

    expect(templateDecisions.findLatestByDocument).toHaveBeenCalledWith(
      snapshot.document!.documentId
    );
    expect(result.templateDecision).toEqual(
      expect.objectContaining({
        decisionId: decision.id,
        requestedVersion: decision.requestedVersion,
      })
    );
  });

  it('returns null template decision when no document is present in the snapshot', async () => {
    const snapshot = buildSnapshot({ status: 'missing', document: null });

    const { service, templateDecisions } = buildService({ snapshot, decision: null });

    const result = await service.fetchPrimaryDocumentSnapshot(snapshot.projectId);

    expect(templateDecisions.findLatestByDocument).not.toHaveBeenCalled();
    expect(result.templateDecision).toBeNull();
  });
});
