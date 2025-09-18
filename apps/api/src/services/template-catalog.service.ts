import type { Logger } from 'pino';

import {
  DocumentTemplateRepositoryImpl,
  type DocumentTemplate,
  type UpsertDocumentTemplateInput,
} from '@ctrl-freaq/shared-data';
import {
  TemplateVersionRepositoryImpl,
  TemplateVersionStatus,
  type TemplateVersion,
} from '@ctrl-freaq/shared-data';
import { TemplateCompilationError, compileTemplateSource } from '@ctrl-freaq/templates';
import type { TemplateCompilationResult } from '@ctrl-freaq/templates';

export interface PublishTemplateVersionOptions {
  templateId: string;
  requestedVersion: string;
  templateYaml: string;
  changelog?: string | null;
  autoActivate?: boolean;
  userId: string;
}

export interface ActivateTemplateVersionOptions {
  templateId: string;
  version: string;
  userId: string;
}

export interface TemplateSummary {
  template: DocumentTemplate;
  activeVersion?: TemplateVersion | null;
}

export interface TemplateVersionDetails {
  template: DocumentTemplate;
  version: TemplateVersion;
}

export class TemplateCatalogError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'TemplateCatalogError';
  }
}

export class TemplateCatalogService {
  constructor(
    private readonly templates: DocumentTemplateRepositoryImpl,
    private readonly versions: TemplateVersionRepositoryImpl,
    private readonly logger: Logger
  ) {}

  async listTemplates(): Promise<TemplateSummary[]> {
    const catalog = await this.templates.listAll();
    const summaries: TemplateSummary[] = [];

    for (const template of catalog) {
      const activeVersion = template.activeVersionId
        ? await this.versions.findById(template.activeVersionId)
        : null;
      summaries.push({ template, activeVersion: activeVersion ?? null });
    }

    return summaries;
  }

  async getTemplateDetails(templateId: string): Promise<TemplateSummary> {
    const template = await this.templates.findById(templateId);
    if (!template) {
      throw new TemplateCatalogError(`Template not found: ${templateId}`, 404);
    }

    const activeVersion = template.activeVersionId
      ? await this.versions.findById(template.activeVersionId)
      : null;

    return { template, activeVersion: activeVersion ?? null };
  }

  async listVersions(templateId: string): Promise<TemplateVersion[]> {
    const template = await this.templates.findById(templateId);
    if (!template) {
      throw new TemplateCatalogError(`Template not found: ${templateId}`, 404);
    }

    return this.versions.listByTemplate(templateId);
  }

  async getVersion(templateId: string, version: string): Promise<TemplateVersionDetails> {
    const template = await this.templates.findById(templateId);
    if (!template) {
      throw new TemplateCatalogError(`Template not found: ${templateId}`, 404);
    }

    const versionEntity = await this.versions.findByTemplateAndVersion(templateId, version);
    if (!versionEntity) {
      throw new TemplateCatalogError(`Template version not found: ${templateId}@${version}`, 404);
    }

    return { template, version: versionEntity };
  }

  async publishVersion(options: PublishTemplateVersionOptions): Promise<TemplateVersionDetails> {
    const versionPattern = /^\d+\.\d+\.\d+$/u;
    if (!versionPattern.test(options.requestedVersion)) {
      throw new TemplateCatalogError(
        `Requested version '${options.requestedVersion}' is not a valid semantic version`,
        400
      );
    }

    try {
      const compilation = await compileTemplateSource({
        source: options.templateYaml,
        sourcePath: `<api-upload:${options.templateId}@${options.requestedVersion}>`,
      });

      if (compilation.catalog.id !== options.templateId) {
        throw new TemplateCatalogError(
          `Template id mismatch. Expected '${options.templateId}', found '${compilation.catalog.id}' in YAML`,
          400
        );
      }

      const normalizedVersion = {
        ...compilation.version,
        version: options.requestedVersion,
        id: `${options.templateId}@${options.requestedVersion}`,
      } as TemplateCompilationResult['version'];

      await this.ensureTemplateCatalog(compilation, options.userId);

      const existing = await this.versions.findByTemplateAndVersion(
        options.templateId,
        options.requestedVersion
      );
      if (existing) {
        throw new TemplateCatalogError(
          `Template version already exists: ${options.templateId}@${options.requestedVersion}`,
          409
        );
      }

      const version = await this.versions.create({
        templateId: options.templateId,
        version: options.requestedVersion,
        status: TemplateVersionStatus.DRAFT,
        changelog: options.changelog ?? normalizedVersion.changelog ?? null,
        schemaHash: normalizedVersion.schemaHash,
        schemaJson: normalizedVersion.schemaJson,
        sectionsJson: normalizedVersion.sections,
        sourcePath: normalizedVersion.sourcePath,
        createdBy: options.userId,
        updatedBy: options.userId,
      });

      this.logger.info(
        {
          templateId: options.templateId,
          version: options.requestedVersion,
          schemaHash: version.schemaHash,
          autoActivate: options.autoActivate ?? false,
        },
        'Template version published'
      );

      if (options.autoActivate) {
        const activated = await this.activateVersion({
          templateId: options.templateId,
          version: options.requestedVersion,
          userId: options.userId,
        });
        return activated;
      }

      const template = await this.templates.findById(options.templateId);
      if (!template) {
        throw new TemplateCatalogError(
          `Template not found after publish: ${options.templateId}`,
          500
        );
      }

      return { template, version };
    } catch (error) {
      if (error instanceof TemplateCatalogError) {
        throw error;
      }

      if (error instanceof TemplateCompilationError) {
        throw new TemplateCatalogError(error.message, 422, {
          issues: [error.message],
        });
      }

      this.logger.error(
        {
          templateId: options.templateId,
          version: options.requestedVersion,
          error: error instanceof Error ? error.message : 'unknown',
        },
        'Failed to publish template version'
      );

      throw new TemplateCatalogError('Failed to publish template version', 500);
    }
  }

  async activateVersion(options: ActivateTemplateVersionOptions): Promise<TemplateVersionDetails> {
    const template = await this.templates.findById(options.templateId);
    if (!template) {
      throw new TemplateCatalogError(`Template not found: ${options.templateId}`, 404);
    }

    const version = await this.versions.findByTemplateAndVersion(
      options.templateId,
      options.version
    );
    if (!version) {
      throw new TemplateCatalogError(
        `Template version not found: ${options.templateId}@${options.version}`,
        404
      );
    }

    if (template.activeVersionId === version.id) {
      return { template, version };
    }

    const activated = await this.versions.markActive({
      versionId: version.id,
      activatedBy: options.userId,
    });
    const updatedTemplate = await this.templates.setActiveVersion({
      templateId: options.templateId,
      versionId: activated.id,
      updatedBy: options.userId,
    });

    this.logger.info(
      {
        templateId: options.templateId,
        version: options.version,
        schemaHash: activated.schemaHash,
      },
      'Template version activated'
    );

    return { template: updatedTemplate, version: activated };
  }

  private async ensureTemplateCatalog(
    compilation: {
      catalog: { id: string; name: string; description?: string | null; documentType: string };
    },
    userId: string
  ): Promise<DocumentTemplate> {
    const existingTemplate = await this.templates.findById(compilation.catalog.id);

    const upsert: UpsertDocumentTemplateInput = {
      id: compilation.catalog.id,
      name: compilation.catalog.name,
      description: compilation.catalog.description ?? null,
      documentType: compilation.catalog.documentType,
      defaultAggressiveness: existingTemplate?.defaultAggressiveness ?? null,
      createdBy: existingTemplate?.createdBy ?? userId,
      updatedBy: userId,
    };

    return this.templates.upsertMetadata(upsert);
  }
}
