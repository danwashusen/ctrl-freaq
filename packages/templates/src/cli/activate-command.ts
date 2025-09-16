import { Command } from 'commander';

import { createTemplatePublisher, type TemplatePublisher } from '../publishers/template-publisher.js';

export function registerActivateCommand(
  program: Command,
  factory: () => TemplatePublisher = createTemplatePublisher
): Command {
  return program
    .command('activate')
    .description('Activate a template version')
    .requiredOption('--template <id>', 'Template identifier')
    .requiredOption('--version <version>', 'Template version to activate')
    .action(async options => {
      const publisher = factory();
      await publisher.activateVersion({
        templateId: options.template,
        version: options.version,
      });
    });
}
