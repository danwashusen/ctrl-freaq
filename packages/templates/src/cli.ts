#!/usr/bin/env node

import { Command } from 'commander';

import Database from 'better-sqlite3';
import pino from 'pino';

import {
  DocumentTemplateRepositoryImpl,
  TemplateVersionRepositoryImpl,
  resolveWorkspaceDatabasePath,
} from '@ctrl-freaq/shared-data';

import { registerActivateCommand } from './cli/activate-command.js';
import { registerMigrateCommand } from './cli/migrate-command.js';
import { registerPublishCommand } from './cli/publish-command.js';
import { createTemplatePublisher } from './publishers/template-publisher.js';

interface RootOptions {
  database?: string;
  user?: string;
  logLevel?: string;
}

interface ListCommandOptions {
  template?: string;
  json?: boolean;
}

const program = new Command();

program
  .name('ctrl-freaq-templates')
  .description('Template management CLI for CTRL FreaQ')
  .option('--database <path>', 'Path to SQLite database')
  .option('--user <id>', 'Template manager user id for audit fields', () => {
    return process.env.TEMPLATE_MANAGER_USER_ID || 'cli_template_manager';
  })
  .option(
    '--log-level <level>',
    'Log level for structured logging',
    process.env.TEMPLATE_CLI_LOG_LEVEL || 'info'
  );

let loggerInstance: pino.Logger | undefined;

function getLogger(): pino.Logger {
  if (!loggerInstance) {
    const opts = program.opts<RootOptions>();
    loggerInstance = pino({ level: opts.logLevel || 'info' });
  }
  return loggerInstance;
}

function createPublisherFactory() {
  return () => {
    const opts = program.opts<RootOptions>();
    const databasePath = resolveWorkspaceDatabasePath({ databasePath: opts.database ?? null });
    const logger = getLogger();
    const proxy = {
      info: (bindings?: unknown, message?: string) => {
        if (typeof bindings === 'string' && message === undefined) {
          logger.info(bindings);
        } else if (bindings && typeof bindings === 'object') {
          logger.info(bindings as Record<string, unknown>, message);
        } else if (message) {
          logger.info(message);
        }
      },
      warn: (bindings?: unknown, message?: string) => {
        if (typeof bindings === 'string' && message === undefined) {
          logger.warn(bindings);
        } else if (bindings && typeof bindings === 'object') {
          logger.warn(bindings as Record<string, unknown>, message);
        } else if (message) {
          logger.warn(message);
        }
      },
      error: (bindings?: unknown, message?: string) => {
        if (typeof bindings === 'string' && message === undefined) {
          logger.error(bindings);
        } else if (bindings && typeof bindings === 'object') {
          logger.error(bindings as Record<string, unknown>, message);
        } else if (message) {
          logger.error(message);
        }
      },
    } satisfies Pick<Console, 'info' | 'warn' | 'error'>;

    return createTemplatePublisher({
      databasePath,
      userId: opts.user,
      logger: proxy,
    });
  };
}

registerPublishCommand(program, createPublisherFactory());
registerActivateCommand(program, createPublisherFactory());
registerMigrateCommand(program, createPublisherFactory());

program
  .command('list')
  .description('List templates and versions in the catalog')
  .option('--template <id>', 'Template identifier to inspect')
  .option('--json', 'Output raw JSON summary', false)
  .action(async (options: ListCommandOptions) => {
    const opts = program.opts<RootOptions>();
    const logger = getLogger();
    const databasePath = resolveWorkspaceDatabasePath({ databasePath: opts.database ?? null });
    const db = new Database(databasePath);
    const templates = new DocumentTemplateRepositoryImpl(db);
    const versions = new TemplateVersionRepositoryImpl(db);

    if (options.template) {
      const template = await templates.findById(options.template);
      if (!template) {
        logger.error({ templateId: options.template }, 'Template not found');
        process.exitCode = 1;
        return;
      }

      const templateVersions = await versions.listByTemplate(template.id);
      const payload = {
        template: {
          id: template.id,
          name: template.name,
          status: template.status,
          activeVersionId: template.activeVersionId,
        },
        versions: templateVersions.map(version => ({
          id: version.id,
          version: version.version,
          status: version.status,
          schemaHash: version.schemaHash,
          publishedAt: version.publishedAt?.toISOString() ?? null,
        })),
      };

      logger.info(
        {
          event: 'template_details',
          templateId: template.id,
          versionCount: templateVersions.length,
        },
        'Template details loaded'
      );

      if (options.json) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      } else {
        process.stdout.write(`Template: ${template.name} (${template.id})\n`);
        process.stdout.write(
          `Status: ${template.status}  Active Version: ${template.activeVersionId ?? 'none'}\n`
        );
        process.stdout.write('Versions:\n');
        for (const version of payload.versions) {
          process.stdout.write(
            `  - ${version.version} [${version.status}] hash=${version.schemaHash}\n`
          );
        }
      }
      db.close();
      return;
    }

    const allTemplates = await templates.listAll();
    const summary = await Promise.all(
      allTemplates.map(async template => {
        const activeVersion = template.activeVersionId
          ? await versions.findById(template.activeVersionId)
          : null;
        return {
          id: template.id,
          name: template.name,
          status: template.status,
          activeVersion: activeVersion?.version ?? null,
          schemaHash: activeVersion?.schemaHash ?? null,
        };
      })
    );

    logger.info(
      { event: 'template_catalog_list', count: summary.length },
      'Template catalog listed'
    );

    if (options.json) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    } else {
      process.stdout.write('Templates:\n');
      for (const entry of summary) {
        process.stdout.write(
          `  - ${entry.id} (${entry.name}) status=${entry.status} active=${entry.activeVersion ?? 'none'}\n`
        );
      }
    }
    db.close();
  });

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    const logger = getLogger();
    if (error instanceof Error) {
      logger.error({ err: error }, 'Command failed');
    } else {
      logger.error({ err: error }, 'Unknown CLI failure');
    }
    process.exitCode = 1;
  }
}

process.on('unhandledRejection', reason => {
  const logger = getLogger();
  logger.error({ reason }, 'Unhandled rejection in templates CLI');
  process.exit(1);
});

void main();
