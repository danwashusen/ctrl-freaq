import { Command } from 'commander';

import { createTemplatePublisher } from '../publishers/template-publisher.js';

export function registerMigrateCommand(program: Command): Command {
  return program
    .command('migrate')
    .description('Migrate a document to a new template version')
    .requiredOption('--document <id>', 'Document identifier to migrate')
    .requiredOption('--template <id>', 'Template identifier')
    .requiredOption('--to-version <version>', 'Target semantic version')
    .option('--dry-run', 'Run without persisting changes', false)
    .action(async options => {
      const publisher = createTemplatePublisher();
      await publisher.migrateDocument({
        documentId: options.document,
        templateId: options.template,
        targetVersion: options.toVersion,
        dryRun: Boolean(options.dryRun),
      });
    });
}
