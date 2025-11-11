import type { Logger } from 'pino';

import {
  ProjectDocumentSnapshotSchema,
  TemplateValidationDecisionSchema,
  type ProjectDocumentSnapshot,
} from '@ctrl-freaq/shared-data';

import type {
  DocumentRepositoryImpl,
  TemplateValidationDecisionRepository,
} from '@ctrl-freaq/shared-data';

export interface ProjectDocumentDiscoveryDependencies {
  documents: DocumentRepositoryImpl;
  templateDecisions: TemplateValidationDecisionRepository;
  logger: Logger;
}

export class ProjectDocumentDiscoveryService {
  constructor(private readonly dependencies: ProjectDocumentDiscoveryDependencies) {}

  async fetchPrimaryDocumentSnapshot(projectId: string): Promise<ProjectDocumentSnapshot> {
    try {
      const snapshot = await this.dependencies.documents.fetchProjectDocumentSnapshot(projectId);
      const documentId = snapshot.document?.documentId;
      const decisionRecord =
        documentId != null
          ? await this.dependencies.templateDecisions.findLatestByDocument(documentId)
          : null;
      let templateDecision = null;
      if (decisionRecord) {
        try {
          templateDecision = TemplateValidationDecisionSchema.parse({
            decisionId: decisionRecord.id,
            action: decisionRecord.action,
            templateId: decisionRecord.templateId,
            currentVersion: decisionRecord.currentVersion,
            requestedVersion: decisionRecord.requestedVersion,
            submittedAt: decisionRecord.submittedAt.toISOString(),
            submittedBy: decisionRecord.submittedBy ?? undefined,
            notes: decisionRecord.notes ?? null,
          });
        } catch (decisionError) {
          this.dependencies.logger.warn(
            {
              projectId,
              documentId: decisionRecord.documentId,
              decisionId: decisionRecord.id,
              error: decisionError instanceof Error ? decisionError.message : String(decisionError),
            },
            'Failed to normalize template validation decision'
          );
          templateDecision = null;
        }
      }

      return ProjectDocumentSnapshotSchema.parse({
        ...snapshot,
        templateDecision,
      });
    } catch (error) {
      this.dependencies.logger.error(
        {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to fetch project document snapshot'
      );
      throw error;
    }
  }
}
