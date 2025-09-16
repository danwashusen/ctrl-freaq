import type Database from 'better-sqlite3';
import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';

import {
  ProjectRepositoryImpl,
  ConfigurationRepositoryImpl,
  ActivityLogRepositoryImpl,
  DocumentTemplateRepositoryImpl,
  TemplateVersionRepositoryImpl,
  DocumentTemplateMigrationRepositoryImpl,
} from '@ctrl-freaq/shared-data';
import { TemplateCatalogService } from './template-catalog.service.js';

/**
 * Registers repository factories into the per-request service container.
 * Routes can then resolve via `req.services.get('<name>')` instead of `new`.
 */
export function createRepositoryRegistrationMiddleware() {
  return (req: Request, _res: Response, next: NextFunction) => {
    const container = req.services;
    if (!container) return next();

    // Database is provided by core service-locator
    const getDb = () => container.get<Database.Database>('database');

    // Register repositories as factories to ensure fresh instances per request
    container.register('projectRepository', () => new ProjectRepositoryImpl(getDb()));
    container.register('configurationRepository', () => new ConfigurationRepositoryImpl(getDb()));
    container.register('activityLogRepository', () => new ActivityLogRepositoryImpl(getDb()));
    container.register(
      'documentTemplateRepository',
      () => new DocumentTemplateRepositoryImpl(getDb())
    );
    container.register(
      'templateVersionRepository',
      () => new TemplateVersionRepositoryImpl(getDb())
    );
    container.register(
      'documentTemplateMigrationRepository',
      () => new DocumentTemplateMigrationRepositoryImpl(getDb())
    );

    container.register('templateCatalogService', currentContainer => {
      const templateRepo = currentContainer.get(
        'documentTemplateRepository'
      ) as DocumentTemplateRepositoryImpl;
      const versionRepo = currentContainer.get(
        'templateVersionRepository'
      ) as TemplateVersionRepositoryImpl;
      const logger = currentContainer.get('logger') as Logger;
      return new TemplateCatalogService(templateRepo, versionRepo, logger);
    });

    next();
  };
}
