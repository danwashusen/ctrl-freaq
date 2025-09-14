#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

/**
 * Main CLI function for the AI package
 */
export function cli(argv?: string[]): void {
  program
    .name('@ctrl-freaq/ai')
    .description('AI and LLM integration library for CTRL FreaQ using Vercel AI SDK')
    .version('0.1.0');

  program
    .command('generate')
    .description('Generate content using AI models')
    .option('-m, --model <model>', 'AI model to use', 'gpt-3.5-turbo')
    .option('-p, --prompt <prompt>', 'Prompt for content generation')
    .option('--json', 'Output in JSON format', false)
    .action((options) => {
      if (options.json) {
        console.log(JSON.stringify({
          status: 'success',
          message: 'AI content generation functionality not yet implemented',
          model: options.model,
          prompt: options.prompt
        }, null, 2));
      } else {
        console.log(`AI Content Generation`);
        console.log(`Model: ${options.model}`);
        console.log(`Prompt: ${options.prompt || 'No prompt provided'}`);
        console.log('\nFunctionality not yet implemented.');
      }
    });

  program
    .command('models')
    .description('List available AI models')
    .option('--json', 'Output in JSON format', false)
    .action((options) => {
      const models = ['gpt-3.5-turbo', 'gpt-4', 'claude-3-sonnet', 'claude-3-opus'];
      
      if (options.json) {
        console.log(JSON.stringify({ models }, null, 2));
      } else {
        console.log('Available AI Models:');
        models.forEach(model => console.log(`  - ${model}`));
      }
    });

  program.parse(argv);
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cli();
}
