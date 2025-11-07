import type { Logger } from 'pino';
import { DocumentExporter, type DocumentContent } from '@ctrl-freaq/exporter';
import {
  DocumentExportJobRepository,
  type DocumentExportJob,
  DocumentRepositoryImpl,
  ProjectRepositoryImpl,
  SectionRepositoryImpl,
  type Document,
  type SectionView,
} from '@ctrl-freaq/shared-data';

import { ProjectNotFoundError } from '../document-provisioning.service.js';

export class ExportJobInProgressError extends Error {
  constructor(
    public readonly projectId: string,
    public readonly jobId: string
  ) {
    super(`An export job is already in progress for project ${projectId}`);
    this.name = 'ExportJobInProgressError';
  }
}

export class DocumentExportPreparationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentExportPreparationError';
  }
}

export interface EnqueueExportJobOptions {
  projectId: string;
  format: 'markdown' | 'zip' | 'pdf' | 'bundle';
  scope: 'primary_document' | 'all_documents';
  requestedBy: string;
  notifyEmail?: string | null;
}

interface DocumentExportServiceDependencies {
  logger: Logger;
  projects: ProjectRepositoryImpl;
  jobs: DocumentExportJobRepository;
  documents: DocumentRepositoryImpl;
  sections: SectionRepositoryImpl;
  exporter: DocumentExporter;
}

export class DocumentExportService {
  constructor(private readonly deps: DocumentExportServiceDependencies) {}

  async enqueue(options: EnqueueExportJobOptions): Promise<DocumentExportJob> {
    const project = await this.deps.projects.findById(options.projectId);
    if (!project) {
      throw new ProjectNotFoundError(options.projectId);
    }

    const existingJob = await this.deps.jobs.findActiveJob(options.projectId);
    if (existingJob) {
      throw new ExportJobInProgressError(options.projectId, existingJob.id);
    }

    const job = await this.deps.jobs.createQueuedJob({
      projectId: options.projectId,
      format: options.format,
      scope: options.scope,
      requestedBy: options.requestedBy,
      requestedAt: new Date(),
      notifyEmail: options.notifyEmail ?? null,
    });

    this.deps.logger.info(
      {
        jobId: job.id,
        projectId: job.projectId,
        format: job.format,
        scope: job.scope,
      },
      'Queued document export job'
    );

    try {
      await this.deps.jobs.updateJobStatus(job.id, { status: 'running' });
      const artifactUrl = await this.generateArtifact({
        projectId: options.projectId,
        format: options.format,
      });
      const completedJob = await this.deps.jobs.updateJobStatus(job.id, {
        status: 'completed',
        artifactUrl,
        errorMessage: null,
        completedAt: new Date(),
      });

      this.deps.logger.info(
        {
          jobId: completedJob.id,
          projectId: completedJob.projectId,
          format: completedJob.format,
        },
        'Completed document export job'
      );

      return completedJob;
    } catch (error) {
      await this.deps.jobs.updateJobStatus(job.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Export failed',
        completedAt: new Date(),
      });

      this.deps.logger.error(
        {
          jobId: job.id,
          projectId: job.projectId,
          format: job.format,
          reason: error instanceof Error ? error.message : 'unknown',
        },
        'Document export job failed'
      );
      throw error;
    }
  }

  private async generateArtifact(input: {
    projectId: string;
    format: EnqueueExportJobOptions['format'];
  }): Promise<string> {
    const document = await this.resolvePrimaryDocument(input.projectId);
    const sections = await this.fetchOrderedSections(document.id);

    const exporterContent = this.buildDocumentContent(document, sections);
    await this.deps.exporter.export(exporterContent, {
      format: input.format,
    });

    const artifactBody = this.composeMarkdown(document, sections);
    const encoded = Buffer.from(artifactBody, 'utf-8').toString('base64');
    return `data:text/markdown;base64,${encoded}`;
  }

  private async resolvePrimaryDocument(projectId: string): Promise<Document> {
    const documents = await this.deps.documents.listByProject(projectId);
    const document = documents[0];
    if (!document) {
      throw new DocumentExportPreparationError(
        'No project document available to export. Create a document first.'
      );
    }
    return document;
  }

  private async fetchOrderedSections(documentId: string): Promise<SectionView[]> {
    const sections = await this.deps.sections.findByDocumentId(documentId, {
      orderBy: 'order_index',
      orderDirection: 'ASC',
    });

    if (sections.length === 0) {
      throw new DocumentExportPreparationError(
        'Document has no sections to export. Add content before exporting.'
      );
    }

    return sections;
  }

  private buildDocumentContent(document: Document, sections: SectionView[]): DocumentContent {
    const content: Record<string, unknown> = {};
    for (const section of sections) {
      const body =
        section.contentMarkdown && section.contentMarkdown.trim().length > 0
          ? section.contentMarkdown
          : (section.placeholderText ?? '');
      content[section.key] = {
        title: section.title,
        status: section.status,
        content: body,
      };
    }

    return {
      title: document.title,
      content,
      metadata: {
        projectId: document.projectId,
        templateId: document.templateId,
        templateVersion: document.templateVersion,
        sectionCount: sections.length,
      },
    };
  }

  private composeMarkdown(document: Document, sections: SectionView[]): string {
    const lines = [`# ${document.title}`, '', `_Generated ${new Date().toISOString()}_`, ''];

    for (const section of sections) {
      const headingPrefix = '#'.repeat(Math.min(section.depth + 2, 6));
      const body =
        section.contentMarkdown && section.contentMarkdown.trim().length > 0
          ? section.contentMarkdown
          : (section.placeholderText ?? '');
      lines.push(`${headingPrefix} ${section.title}`);
      lines.push('');
      lines.push(body);
      lines.push('');
    }

    return lines.join('\n');
  }
}
