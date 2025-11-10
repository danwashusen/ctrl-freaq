import { readFile } from 'node:fs/promises';

import type { Logger } from 'pino';

import {
  DocumentTemplateRepositoryImpl,
  TemplateVersionRepositoryImpl,
  TemplateVersionStatus,
  type TemplateVersion,
} from '@ctrl-freaq/shared-data';
import { compileTemplateSource } from '@ctrl-freaq/templates';

import { TemplateCatalogService } from '../template-catalog.service.js';
import { createTemplateLocator } from '../templates/template-path-resolver.js';
import { DEFAULT_ARCHITECTURE_TEMPLATE_ID, SYSTEM_TEMPLATE_BOOTSTRAP_USER } from './constants.js';

export interface BootstrapDefaultTemplateOptions {
  templateRepository: DocumentTemplateRepositoryImpl;
  versionRepository: TemplateVersionRepositoryImpl;
  catalogService: TemplateCatalogService;
  logger: Logger;
  templateFile?: string;
  systemUserId?: string;
}

export async function bootstrapDefaultTemplate({
  templateRepository,
  versionRepository,
  catalogService,
  logger,
  templateFile,
  systemUserId = SYSTEM_TEMPLATE_BOOTSTRAP_USER,
}: BootstrapDefaultTemplateOptions): Promise<void> {
  const templatePath =
    templateFile ??
    createTemplateLocator(import.meta.url).resolveFile(DEFAULT_ARCHITECTURE_TEMPLATE_ID);
  const templateYaml = await readFile(templatePath, 'utf-8');
  const compilation = await compileTemplateSource({
    source: templateYaml,
    sourcePath: templatePath,
  });

  const templateId = compilation.catalog.id;
  const versionId = compilation.version.version;
  const compiledHash = compilation.version.schemaHash;

  const existingVersion = await versionRepository.findByTemplateAndVersion(templateId, versionId);
  if (existingVersion) {
    await ensureVersionConsistency({
      existingVersion,
      compiledHash,
      templateRepository,
      catalogService,
      templateId,
      versionId,
      systemUserId,
      logger,
    });
    return;
  }

  await catalogService.publishVersion({
    templateId,
    requestedVersion: versionId,
    templateYaml,
    changelog: compilation.version.changelog ?? null,
    autoActivate: true,
    userId: systemUserId,
  });

  logger.info(
    {
      action: 'template_bootstrap_published',
      templateId,
      version: versionId,
      schemaHash: compiledHash,
      sourcePath: templatePath,
    },
    'Bootstrapped default template catalog entry'
  );
}

interface EnsureVersionConsistencyOptions {
  existingVersion: TemplateVersion;
  compiledHash: string;
  templateRepository: DocumentTemplateRepositoryImpl;
  catalogService: TemplateCatalogService;
  templateId: string;
  versionId: string;
  systemUserId: string;
  logger: Logger;
}

async function ensureVersionConsistency({
  existingVersion,
  compiledHash,
  templateRepository,
  catalogService,
  templateId,
  versionId,
  systemUserId,
  logger,
}: EnsureVersionConsistencyOptions): Promise<void> {
  if (existingVersion.schemaHash !== compiledHash) {
    logger.error(
      {
        action: 'template_bootstrap_hash_mismatch',
        templateId,
        version: versionId,
        storedHash: existingVersion.schemaHash,
        compiledHash,
      },
      'Default template version is out of sync with source YAML. Bump the version or reset the catalog.'
    );
    throw new Error(
      `Template ${templateId}@${versionId} hash mismatch between YAML and catalog entries`
    );
  }

  const template = await templateRepository.findById(templateId);
  const isActive =
    existingVersion.status === TemplateVersionStatus.ACTIVE &&
    template?.activeVersionId === existingVersion.id;

  if (isActive) {
    logger.debug(
      {
        action: 'template_bootstrap_noop',
        templateId,
        version: versionId,
      },
      'Default template catalog entry already active'
    );
    return;
  }

  await catalogService.activateVersion({
    templateId,
    version: versionId,
    userId: systemUserId,
  });

  logger.info(
    {
      action: 'template_bootstrap_activated',
      templateId,
      version: versionId,
    },
    'Activated default template catalog entry'
  );
}
