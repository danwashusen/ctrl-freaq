import { Command } from 'commander';

import { createTemplatePublisher } from '../publishers/template-publisher.js';

export function registerPublishCommand(program: Command): Command {
  return program
    .command('publish')
    .description('Publish a new template version')
    .requiredOption('--file <path>', 'Path to template YAML file')
    .requiredOption('--version <version>', 'Semantic version to publish')
    .option('--changelog <notes>', 'Markdown changelog summary')
    .option('--activate', 'Activate the version after publish', false)
    .action(async options => {
      const publisher = createTemplatePublisher();
      await publisher.publishFromFile({
        file: options.file,
        version: options.version,
        changelog: options.changelog ?? null,
        activate: Boolean(options.activate),
      });
    });
}
