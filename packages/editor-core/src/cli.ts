#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

/**
 * Main CLI function for the Editor Core package
 */
export function cli(argv?: string[]): void {
  program
    .name('@ctrl-freaq/editor-core')
    .description('WYSIWYG editor core library for CTRL FreaQ documentation editing')
    .version('0.1.0');

  program
    .command('create')
    .description('Create a new editor instance configuration')
    .option('-c, --config <config>', 'Configuration file path')
    .option('-e, --extensions <extensions>', 'Comma-separated list of extensions')
    .option('--json', 'Output in JSON format', false)
    .action((options) => {
      const extensions = options.extensions ? options.extensions.split(',') : ['document', 'paragraph', 'text', 'bold', 'italic'];
      
      if (options.json) {
        console.log(JSON.stringify({
          status: 'success',
          message: 'Editor instance creation functionality not yet implemented',
          config: options.config,
          extensions,
          editorConfig: {
            extensions,
            content: '',
            editable: true,
            autofocus: false
          }
        }, null, 2));
      } else {
        console.log(`Editor Instance Configuration`);
        console.log(`Config: ${options.config || 'Default configuration'}`);
        console.log(`Extensions: ${extensions.join(', ')}`);
        console.log('\nEditor creation functionality not yet implemented.');
      }
    });

  program
    .command('extensions')
    .description('List available editor extensions')
    .option('-t, --type <type>', 'Filter by extension type (core, formatting, layout)')
    .option('--json', 'Output in JSON format', false)
    .action((options) => {
      const allExtensions = [
        { name: 'document', type: 'core', description: 'Base document structure' },
        { name: 'paragraph', type: 'core', description: 'Paragraph support' },
        { name: 'text', type: 'core', description: 'Text content support' },
        { name: 'bold', type: 'formatting', description: 'Bold text formatting' },
        { name: 'italic', type: 'formatting', description: 'Italic text formatting' },
        { name: 'underline', type: 'formatting', description: 'Underline text formatting' },
        { name: 'heading', type: 'layout', description: 'Heading levels (H1-H6)' },
        { name: 'bullet-list', type: 'layout', description: 'Bullet point lists' },
        { name: 'ordered-list', type: 'layout', description: 'Numbered lists' },
        { name: 'link', type: 'formatting', description: 'Hyperlink support' },
        { name: 'image', type: 'layout', description: 'Image embedding' }
      ];
      
      const extensions = options.type 
        ? allExtensions.filter(ext => ext.type === options.type)
        : allExtensions;
      
      if (options.json) {
        console.log(JSON.stringify({ extensions }, null, 2));
      } else {
        console.log(`Available Extensions${options.type ? ` (${options.type})` : ''}:`);
        extensions.forEach(ext => {
          console.log(`  ${ext.name.padEnd(15)} [${ext.type}] - ${ext.description}`);
        });
      }
    });

  program
    .command('validate')
    .description('Validate editor content or configuration')
    .option('-c, --content <content>', 'Content to validate')
    .option('-s, --schema <schema>', 'Schema to validate against')
    .option('--json', 'Output in JSON format', false)
    .action((options) => {
      if (options.json) {
        console.log(JSON.stringify({
          status: 'success',
          message: 'Content validation functionality not yet implemented',
          content: options.content,
          schema: options.schema,
          validation: {
            valid: true,
            errors: [],
            warnings: []
          }
        }, null, 2));
      } else {
        console.log(`Content Validation`);
        console.log(`Content: ${options.content || 'No content specified'}`);
        console.log(`Schema: ${options.schema || 'Default schema'}`);
        console.log('\nValidation functionality not yet implemented.');
      }
    });

  program.parse(argv);
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cli();
}
