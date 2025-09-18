import { readFile } from 'node:fs/promises';

import Database from 'better-sqlite3';

import { resolveWorkspaceDatabasePath } from '@ctrl-freaq/shared-data/utils/database-path';
import { DocumentRepositoryImpl } from '@ctrl-freaq/shared-data/models/document';
import { DocumentTemplateMigrationRepositoryImpl } from '@ctrl-freaq/shared-data/models/document-template-migration';
import { DocumentTemplateRepositoryImpl } from '@ctrl-freaq/shared-data/models/document-template';
import {
  TemplateVersionRepositoryImpl,
  TemplateVersionStatus,
} from '@ctrl-freaq/shared-data/models/template-version';

import { templateEngine } from '../templates/index.js';
import { createTemplateValidator } from '../validators/template-validator.js';

export interface PublishTemplateVersionOptions {
  file: string;
  version: string;
  changelog?: string | null;
  activate?: boolean;
}

export interface ActivateTemplateVersionOptions {
  templateId: string;
  version: string;
}

export interface MigrateDocumentOptions {
  documentId: string;
  templateId: string;
  targetVersion: string;
  dryRun?: boolean;
}

export interface TemplatePublisherConfig {
  databasePath?: string;
  userId?: string;
  logger?: Pick<Console, 'info' | 'warn' | 'error'>;
}

export interface TemplatePublisher {
  publishFromFile(options: PublishTemplateVersionOptions): Promise<void>;
  activateVersion(options: ActivateTemplateVersionOptions): Promise<void>;
  migrateDocument(options: MigrateDocumentOptions): Promise<void>;
}

function resolveDatabasePath(config?: TemplatePublisherConfig): string {
  return resolveWorkspaceDatabasePath({ databasePath: config?.databasePath ?? null });
}

function resolveUserId(config?: TemplatePublisherConfig): string {
  return config?.userId || process.env.TEMPLATE_MANAGER_USER_ID || 'cli_template_manager';
}

function resolveLogger(config?: TemplatePublisherConfig) {
  const fallback = console;
  return config?.logger ?? fallback;
}

export function createTemplatePublisher(config?: TemplatePublisherConfig): TemplatePublisher {
  const databasePath = resolveDatabasePath(config);
  const logger = resolveLogger(config);
  const userId = resolveUserId(config);

  const database = new Database(databasePath);
  const documentTemplates = new DocumentTemplateRepositoryImpl(database);
  const templateVersions = new TemplateVersionRepositoryImpl(database);
  const documentMigrations = new DocumentTemplateMigrationRepositoryImpl(database);
  const documents = new DocumentRepositoryImpl(database);

  async function publishFromFile(options: PublishTemplateVersionOptions): Promise<void> {
    const source = await readFile(options.file, 'utf-8');
    const template = await templateEngine.loadTemplate(source, options.file);

    if (template.metadata.version !== options.version) {
      logger.warn(
        {
          file: options.file,
          templateId: template.metadata.id,
          versionInFile: template.metadata.version,
          requestedVersion: options.version,
        },
        'Requested version overrides YAML metadata version'
      );
    }

    const existingVersion = await templateVersions.findByTemplateAndVersion(
      template.metadata.id,
      options.version
    );
    if (existingVersion) {
      throw new Error(
        `Template version already exists: ${template.metadata.id}@${options.version}`
      );
    }

    const existingTemplate = await documentTemplates.findById(template.metadata.id);
    const defaultAggressiveness = existingTemplate?.defaultAggressiveness ?? null;

    await documentTemplates.upsertMetadata({
      id: template.metadata.id,
      name: template.metadata.name,
      description: template.metadata.description ?? null,
      documentType: template.metadata.documentType,
      defaultAggressiveness,
      createdBy: userId,
      updatedBy: userId,
    });

    const version = await templateVersions.create({
      templateId: template.metadata.id,
      version: options.version,
      status: TemplateVersionStatus.DRAFT,
      changelog: options.changelog ?? template.metadata.changelog ?? null,
      schemaHash: template.schemaHash,
      schemaJson: template.schemaJson,
      sectionsJson: template.sections,
      sourcePath: template.sourcePath,
      createdBy: userId,
      updatedBy: userId,
    });

    logger.info(
      {
        action: 'publish_template_version',
        templateId: template.metadata.id,
        version: options.version,
        schemaHash: template.schemaHash,
        databasePath,
      },
      'Template version published'
    );

    if (options.activate) {
      await activateVersion({ templateId: template.metadata.id, version: version.version });
    }
  }

  async function activateVersion(options: ActivateTemplateVersionOptions): Promise<void> {
    const template = await documentTemplates.findById(options.templateId);
    if (!template) {
      throw new Error(`Template not found: ${options.templateId}`);
    }

    const version = await templateVersions.findByTemplateAndVersion(
      options.templateId,
      options.version
    );
    if (!version) {
      throw new Error(`Template version not found: ${options.templateId}@${options.version}`);
    }

    const activated = await templateVersions.markActive({
      versionId: version.id,
      activatedBy: userId,
    });

    await documentTemplates.setActiveVersion({
      templateId: template.id,
      versionId: activated.id,
      updatedBy: userId,
    });

    logger.info(
      {
        action: 'activate_template_version',
        templateId: options.templateId,
        version: options.version,
        schemaHash: activated.schemaHash,
        databasePath,
      },
      'Template version activated'
    );
  }

  async function migrateDocument(options: MigrateDocumentOptions): Promise<void> {
    const document = await documents.findById(options.documentId);
    if (!document) {
      throw new Error(`Document not found: ${options.documentId}`);
    }

    if (document.templateId !== options.templateId) {
      throw new Error(
        `Document ${options.documentId} is bound to template ${document.templateId}, not ${options.templateId}`
      );
    }

    const targetVersion = await templateVersions.findByTemplateAndVersion(
      options.templateId,
      options.targetVersion
    );
    if (!targetVersion) {
      throw new Error(`Template version not found: ${options.templateId}@${options.targetVersion}`);
    }

    const validator = createTemplateValidator({
      templateId: options.templateId,
      version: options.targetVersion,
      schemaJson: targetVersion.schemaJson,
    });

    const validation = validator.safeParse(document.content);
    if (!validation.success) {
      logger.error(
        {
          action: 'migrate_document',
          documentId: options.documentId,
          templateId: options.templateId,
          targetVersion: options.targetVersion,
          issues: validation.error.issues,
        },
        'Document content failed validation for target template version'
      );
      if (options.dryRun) {
        return;
      }

      const pending = await documentMigrations.logPending({
        documentId: document.id,
        fromVersion: document.templateVersion,
        toVersion: options.targetVersion,
        initiatedBy: userId,
      });
      await documentMigrations.markFailed({
        migrationId: pending.id,
        validationErrors: validation.error.issues,
      });
      throw new Error('Document content does not satisfy target template schema');
    }

    if (options.dryRun) {
      logger.info(
        {
          action: 'migrate_document_dry_run',
          documentId: options.documentId,
          templateId: options.templateId,
          fromVersion: document.templateVersion,
          toVersion: options.targetVersion,
        },
        'Dry-run migration succeeded'
      );
      return;
    }

    const migration = await documentMigrations.logPending({
      documentId: document.id,
      fromVersion: document.templateVersion,
      toVersion: options.targetVersion,
      initiatedBy: userId,
    });

    await documents.updateTemplateBinding({
      documentId: document.id,
      templateId: options.templateId,
      templateVersion: options.targetVersion,
      templateSchemaHash: targetVersion.schemaHash,
      updatedBy: userId,
    });

    await documentMigrations.markSucceeded({ migrationId: migration.id });

    logger.info(
      {
        action: 'migrate_document',
        documentId: options.documentId,
        templateId: options.templateId,
        fromVersion: document.templateVersion,
        toVersion: options.targetVersion,
      },
      'Document migrated to target template version'
    );
  }

  return {
    publishFromFile,
    activateVersion,
    migrateDocument,
  };
}
