import { randomUUID, createHash } from 'crypto';

import type { Logger } from 'pino';
import {
  DocumentRepositoryImpl,
  DocumentTemplateRepositoryImpl,
  ProjectRepositoryImpl,
  SectionRepositoryImpl,
  TemplateVersionRepositoryImpl,
  TemplateVersionStatus,
  validateCreateSectionView,
  type Document,
  type SectionView,
} from '@ctrl-freaq/shared-data';
import {
  TemplateEngine,
  type NormalizedTemplateSection,
  type TemplateRecord,
} from '@ctrl-freaq/templates';

import { createTemplateLocator, type TemplateLocator } from './templates/template-path-resolver.js';

interface DocumentProvisioningDependencies {
  logger: Logger;
  projects: ProjectRepositoryImpl;
  documents: DocumentRepositoryImpl;
  sections: SectionRepositoryImpl;
  templates: DocumentTemplateRepositoryImpl;
  templateVersions: TemplateVersionRepositoryImpl;
}

type SeedStrategy = 'authoritative' | 'empty' | 'fixture';

export interface ProvisionPrimaryDocumentResult {
  status: 'created' | 'already_exists';
  projectId: string;
  documentId: string;
  firstSectionId: string;
  lifecycleStatus: 'draft' | 'review' | 'published';
  title: string;
  lastModifiedAt: string;
  template: {
    templateId: string;
    templateVersion: string;
    templateSchemaHash: string;
  };
}

export class ProjectNotFoundError extends Error {
  constructor(public readonly projectId: string) {
    super(`Project not found: ${projectId}`);
    this.name = 'ProjectNotFoundError';
  }
}

export class TemplateProvisioningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateProvisioningError';
  }
}

export class DocumentProvisioningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentProvisioningError';
  }
}

interface ResolvedTemplateVersion {
  id: string;
  version: string;
  schemaHash: string;
  sections: NormalizedTemplateSection[];
  schemaJson: unknown;
}

const DEFAULT_TEMPLATE_ID = 'architecture-reference';

function resolvePlaceholder(section: NormalizedTemplateSection): string {
  if (section.guidance && section.guidance.trim().length > 0) {
    return section.guidance.trim();
  }
  return `Add details for “${section.title}”.`;
}

function buildContentFromTemplate(templateVersion: string, sections: NormalizedTemplateSection[]) {
  const summary = sections.map(section => ({
    id: section.id,
    title: section.title,
    guidance: section.guidance ?? null,
    required: section.required ?? false,
    children: section.children?.map(child => ({
      id: child.id,
      title: child.title,
      guidance: child.guidance ?? null,
      required: child.required ?? false,
    })),
  }));

  return {
    version: templateVersion,
    sections: summary,
  } as Record<string, unknown>;
}

export class DocumentProvisioningService {
  private readonly templateEngine = new TemplateEngine();
  private readonly templateLocator: TemplateLocator;
  private readonly templateCache = new Map<string, TemplateRecord>();

  constructor(private readonly dependencies: DocumentProvisioningDependencies) {
    this.templateLocator = createTemplateLocator(import.meta.url, dependencies.logger);
  }

  async provisionPrimaryDocument(options: {
    projectId: string;
    requestedBy?: string | null;
    title?: string | null;
    templateId?: string | null;
    templateVersion?: string | null;
    seedStrategy?: SeedStrategy | null;
  }): Promise<ProvisionPrimaryDocumentResult> {
    const requestedBy =
      options.requestedBy?.trim() && options.requestedBy.trim().length > 0
        ? options.requestedBy.trim()
        : 'system';
    const seedStrategy = this.resolveSeedStrategy(options.seedStrategy);

    const project = await this.dependencies.projects.findById(options.projectId);
    if (!project) {
      throw new ProjectNotFoundError(options.projectId);
    }

    const existingDocuments = await this.dependencies.documents.listByProject(project.id);
    if (existingDocuments.length > 0) {
      const existingDocument = existingDocuments[0];
      if (!existingDocument) {
        throw new DocumentProvisioningError('Unable to resolve existing project document record');
      }
      return this.buildExistingDocumentResponse(project.id, existingDocument);
    }

    const templateRecord = await this.loadTemplateDefinition({
      templateId: options.templateId,
      templateVersion: options.templateVersion,
    });
    const template = await this.ensureTemplateAvailability({ requestedBy, templateRecord });

    const documentTitle = this.resolveDocumentTitle(project.name, options.title);
    const documentContent = buildContentFromTemplate(template.version, templateRecord.sections);

    let document: Document | null = null;
    try {
      document = await this.dependencies.documents.create({
        projectId: project.id,
        title: documentTitle,
        content: documentContent,
        templateId: templateRecord.metadata.id,
        templateVersion: template.version,
        templateSchemaHash: template.schemaHash,
        createdBy: requestedBy,
        updatedBy: requestedBy,
      });
    } catch (error) {
      this.dependencies.logger.error(
        {
          projectId: project.id,
          templateId: DEFAULT_TEMPLATE_ID,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to create project document during provisioning'
      );
      throw new DocumentProvisioningError('Failed to create project document record');
    }

    try {
      const sectionsToSeed = seedStrategy === 'empty' ? [] : template.sections;
      const rootSections = await this.createSectionsFromTemplate({
        documentId: document.id,
        sections: sectionsToSeed,
        seedStrategy,
      });

      if (rootSections.length === 0) {
        throw new DocumentProvisioningError('Template did not yield any primary sections');
      }

      const sortedSections = [...rootSections].sort((a, b) => a.orderIndex - b.orderIndex);
      const firstSection = sortedSections[0];
      if (!firstSection) {
        throw new DocumentProvisioningError('Primary section lookup failed during provisioning');
      }

      this.dependencies.logger.info(
        {
          projectId: project.id,
          documentId: document.id,
          templateId: templateRecord.metadata.id,
          seedStrategy,
          sectionCount: rootSections.length,
          requestedBy,
        },
        'Provisioned primary project document'
      );

      return {
        status: 'created',
        projectId: project.id,
        documentId: document.id,
        firstSectionId: firstSection.id,
        lifecycleStatus: 'draft',
        title: document.title,
        lastModifiedAt: document.updatedAt.toISOString(),
        template: {
          templateId: templateRecord.metadata.id,
          templateVersion: template.version,
          templateSchemaHash: template.schemaHash,
        },
      };
    } catch (error) {
      await this.rollbackProvisionedDocument(document.id, requestedBy);
      throw error;
    }
  }

  private async buildExistingDocumentResponse(
    projectId: string,
    document: Document
  ): Promise<ProvisionPrimaryDocumentResult> {
    const snapshot = await this.dependencies.documents.fetchProjectDocumentSnapshot(projectId);

    if (!snapshot.document) {
      throw new DocumentProvisioningError('Existing document snapshot unavailable');
    }

    return {
      status: 'already_exists',
      projectId,
      documentId: snapshot.document.documentId,
      firstSectionId: snapshot.document.firstSectionId,
      lifecycleStatus: snapshot.document.lifecycleStatus,
      title: snapshot.document.title,
      lastModifiedAt: snapshot.document.lastModifiedAt,
      template: snapshot.document.template
        ? {
            templateId: snapshot.document.template.templateId,
            templateVersion: snapshot.document.template.templateVersion,
            templateSchemaHash: snapshot.document.template.templateSchemaHash,
          }
        : {
            templateId: document.templateId,
            templateVersion: document.templateVersion,
            templateSchemaHash: document.templateSchemaHash,
          },
    };
  }

  private async ensureTemplateAvailability(input: {
    requestedBy: string;
    templateRecord: TemplateRecord;
  }): Promise<ResolvedTemplateVersion> {
    const { requestedBy, templateRecord } = input;
    const templateId = templateRecord.metadata.id;
    const templateVersion = templateRecord.metadata.version;
    const templatesRepo = this.dependencies.templates;
    const versionsRepo = this.dependencies.templateVersions;

    const templateMetadata = await templatesRepo.upsertMetadata({
      id: templateId,
      name: templateRecord.metadata.name,
      description:
        templateRecord.metadata.description ??
        'Architecture reference template generated during provisioning.',
      documentType: templateRecord.metadata.documentType,
      createdBy: requestedBy,
      updatedBy: requestedBy,
    });

    let version = await versionsRepo.findByTemplateAndVersion(templateId, templateVersion);

    if (!version) {
      version = await versionsRepo.create({
        templateId,
        version: templateVersion,
        status: TemplateVersionStatus.DRAFT,
        changelog: templateRecord.metadata.changelog ?? null,
        schemaHash: templateRecord.schemaHash,
        schemaJson: templateRecord.schemaJson,
        sectionsJson: templateRecord.sections,
        sourcePath: templateRecord.sourcePath,
        createdBy: requestedBy,
        updatedBy: requestedBy,
      });
    } else {
      const serializedSections = JSON.stringify(templateRecord.sections);
      const existingSections = JSON.stringify(version.sectionsJson);
      const needsSchemaUpdate =
        version.schemaHash !== templateRecord.schemaHash || existingSections !== serializedSections;

      if (needsSchemaUpdate) {
        await versionsRepo.update(version.id, {
          schemaHash: templateRecord.schemaHash,
          schemaJson: templateRecord.schemaJson,
          sectionsJson: templateRecord.sections,
          updatedBy: requestedBy,
        });
        version = (await versionsRepo.findById(version.id)) ?? version;
      }
    }

    if (version.status !== TemplateVersionStatus.ACTIVE) {
      await versionsRepo.markActive({ versionId: version.id, activatedBy: requestedBy });
      version = (await versionsRepo.findById(version.id)) ?? version;
    }

    if (templateMetadata.activeVersionId !== version.id) {
      await templatesRepo.setActiveVersion({
        templateId,
        versionId: version.id,
        updatedBy: requestedBy,
      });
    }

    return {
      id: version.id,
      version: version.version,
      schemaHash: version.schemaHash,
      sections: templateRecord.sections,
      schemaJson: templateRecord.schemaJson,
    };
  }

  private async loadTemplateDefinition(input?: {
    templateId?: string | null;
    templateVersion?: string | null;
  }): Promise<TemplateRecord> {
    const templateId =
      input?.templateId?.trim() && input.templateId.trim().length > 0
        ? input.templateId.trim()
        : DEFAULT_TEMPLATE_ID;
    const requestedVersion =
      input?.templateVersion?.trim() && input.templateVersion.trim().length > 0
        ? input.templateVersion.trim()
        : undefined;
    const cacheKey = requestedVersion ? `${templateId}:${requestedVersion}` : templateId;
    const cachedRecord = requestedVersion
      ? this.templateCache.get(cacheKey)
      : this.templateCache.get(templateId);

    if (cachedRecord) {
      return cachedRecord;
    }

    const templatePath = this.templateLocator.resolveFile(templateId);

    try {
      const record = await this.templateEngine.loadTemplateFromFile(templatePath);
      const normalizedHash = createHash('sha256')
        .update(JSON.stringify(record.schemaJson))
        .digest('hex');
      const schemaHashMatches = record.schemaHash === normalizedHash;

      if (!schemaHashMatches) {
        this.dependencies.logger.warn(
          {
            templateId: record.metadata.id,
            expectedHash: normalizedHash,
            compiledHash: record.schemaHash,
          },
          'Template schema hash mismatch detected; using compiled hash'
        );
        record.schemaHash = normalizedHash;
      }

      if (requestedVersion && record.metadata.version !== requestedVersion) {
        throw new TemplateProvisioningError(
          `Template ${templateId} does not provide requested version ${requestedVersion}`
        );
      }

      const resolvedCacheKey = `${templateId}:${record.metadata.version}`;
      this.templateCache.set(resolvedCacheKey, record);
      if (!requestedVersion) {
        this.templateCache.set(templateId, record);
      } else {
        this.templateCache.set(cacheKey, record);
      }

      return record;
    } catch (error) {
      this.dependencies.logger.error(
        {
          templatePath,
          templateId,
          requestedVersion: requestedVersion ?? null,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to load provisioning template definition'
      );
      if (error instanceof TemplateProvisioningError) {
        throw error;
      }
      throw new TemplateProvisioningError('Unable to load architecture template definition');
    }
  }

  private resolveDocumentTitle(projectName: string, override?: string | null): string {
    if (override && override.trim().length > 0) {
      return override.trim();
    }
    return `${projectName} Architecture Document`;
  }

  private resolveSeedStrategy(strategy?: SeedStrategy | null): SeedStrategy {
    if (!strategy) {
      return 'authoritative';
    }
    return strategy;
  }

  private async createSectionsFromTemplate(input: {
    documentId: string;
    sections: NormalizedTemplateSection[];
    seedStrategy: SeedStrategy;
  }) {
    const roots: SectionView[] = [];
    const db = this.dependencies.sections.getConnection();
    const insertSectionStatement = db.prepare(
      `INSERT INTO sections (
          id,
          doc_id,
          parent_section_id,
          key,
          title,
          depth,
          order_index,
          content_markdown,
          placeholder_text,
          has_content,
          view_state,
          editing_user,
          last_modified,
          status,
          assumptions_resolved,
          quality_gate_status,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @docId,
          @parentSectionId,
          @key,
          @title,
          @depth,
          @orderIndex,
          @contentMarkdown,
          @placeholderText,
          @hasContent,
          @viewState,
          @editingUser,
          @lastModified,
          @status,
          @assumptionsResolved,
          @qualityGateStatus,
          @createdAt,
          @updatedAt
        )`
    );

    const createRecursive = async (
      sections: NormalizedTemplateSection[],
      parentSectionId: string | null,
      depth: number
    ) => {
      const sorted = [...sections].sort((a, b) => {
        const aOrder = typeof a.orderIndex === 'number' ? a.orderIndex : 0;
        const bOrder = typeof b.orderIndex === 'number' ? b.orderIndex : 0;
        return aOrder - bOrder;
      });

      for (const [index, section] of sorted.entries()) {
        const timestamp = new Date();
        const seededContent = this.resolveSeedContent(section, input.seedStrategy);
        const createInput = validateCreateSectionView({
          docId: input.documentId,
          parentSectionId,
          key: section.id,
          title: section.title,
          depth,
          orderIndex: typeof section.orderIndex === 'number' ? section.orderIndex : index,
          contentMarkdown: seededContent,
          placeholderText: resolvePlaceholder(section),
          hasContent: seededContent.length > 0,
          viewState: 'read_mode',
          editingUser: null,
          lastModified: timestamp,
          status: 'drafting',
          assumptionsResolved: false,
          qualityGateStatus: 'pending',
        });

        const sectionId = randomUUID();
        insertSectionStatement.run({
          id: sectionId,
          docId: createInput.docId,
          parentSectionId: createInput.parentSectionId,
          key: createInput.key,
          title: createInput.title,
          depth: createInput.depth,
          orderIndex: createInput.orderIndex,
          contentMarkdown: createInput.contentMarkdown,
          placeholderText: createInput.placeholderText,
          hasContent: createInput.hasContent ? 1 : 0,
          viewState: createInput.viewState,
          editingUser: createInput.editingUser,
          lastModified: createInput.lastModified.toISOString(),
          status: createInput.status,
          assumptionsResolved: createInput.assumptionsResolved ? 1 : 0,
          qualityGateStatus: createInput.qualityGateStatus ?? 'pending',
          createdAt: timestamp.toISOString(),
          updatedAt: timestamp.toISOString(),
        });
        const created = await this.dependencies.sections.findById(sectionId);
        if (!created) {
          throw new DocumentProvisioningError(
            'Failed to create section record during provisioning'
          );
        }

        if (depth === 0) {
          roots.push(created);
        }

        if (section.children && section.children.length > 0) {
          await createRecursive(section.children, created.id, depth + 1);
        }
      }
    };

    if (input.sections.length === 0) {
      const timestamp = new Date();
      const fallbackInput = validateCreateSectionView({
        docId: input.documentId,
        parentSectionId: null,
        key: `section-${randomUUID()}`,
        title: 'Getting Started',
        depth: 0,
        orderIndex: 0,
        contentMarkdown: '',
        placeholderText: 'Document outline will be generated after the first save.',
        hasContent: false,
        viewState: 'read_mode',
        editingUser: null,
        lastModified: timestamp,
        status: 'drafting',
        assumptionsResolved: false,
        qualityGateStatus: 'pending',
      });
      const sectionId = randomUUID();
      insertSectionStatement.run({
        id: sectionId,
        docId: fallbackInput.docId,
        parentSectionId: fallbackInput.parentSectionId,
        key: fallbackInput.key,
        title: fallbackInput.title,
        depth: fallbackInput.depth,
        orderIndex: fallbackInput.orderIndex,
        contentMarkdown: fallbackInput.contentMarkdown,
        placeholderText: fallbackInput.placeholderText,
        hasContent: fallbackInput.hasContent ? 1 : 0,
        viewState: fallbackInput.viewState,
        editingUser: fallbackInput.editingUser,
        lastModified: fallbackInput.lastModified.toISOString(),
        status: fallbackInput.status,
        assumptionsResolved: fallbackInput.assumptionsResolved ? 1 : 0,
        qualityGateStatus: fallbackInput.qualityGateStatus ?? 'pending',
        createdAt: timestamp.toISOString(),
        updatedAt: timestamp.toISOString(),
      });
      const fallbackSection = await this.dependencies.sections.findById(sectionId);
      if (!fallbackSection) {
        throw new DocumentProvisioningError('Failed to seed fallback section during provisioning');
      }
      roots.push(fallbackSection);
      return roots;
    }

    await createRecursive(input.sections, null, 0);
    return roots;
  }

  private resolveSeedContent(
    section: NormalizedTemplateSection,
    seedStrategy: SeedStrategy
  ): string {
    if (seedStrategy !== 'fixture') {
      return '';
    }
    if (section.guidance && section.guidance.trim().length > 0) {
      return `## ${section.title}\n\n${section.guidance.trim()}`;
    }
    return `## ${section.title}\n\nProvide initial content for ${section.title}.`;
  }

  private async rollbackProvisionedDocument(documentId: string, deletedBy: string): Promise<void> {
    try {
      await this.dependencies.sections.deleteByDocumentId(documentId);
    } catch (error) {
      this.dependencies.logger.warn(
        {
          documentId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to delete sections during provisioning rollback'
      );
    }

    try {
      await this.dependencies.documents.delete(documentId, deletedBy);
    } catch (error) {
      this.dependencies.logger.warn(
        {
          documentId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to delete document during provisioning rollback'
      );
    }
  }
}
