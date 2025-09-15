#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

/**
 * Main CLI function for the Exporter package
 */
export function cli(argv?: string[]): void {
  program
    .name('@ctrl-freaq/exporter')
    .description('Document export library for CTRL FreaQ supporting multiple formats')
    .version('0.1.0');

  program
    .command('export')
    .description('Export documentation to various formats')
    .option('-i, --input <input>', 'Input file or directory')
    .option('-o, --output <output>', 'Output file or directory')
    .option('-f, --format <format>', 'Export format (pdf, html, docx, md)', 'pdf')
    .option('-t, --template <template>', 'Template to use for export')
    .option('--json', 'Output in JSON format', false)
    .action(options => {
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              status: 'success',
              message: 'Document export functionality not yet implemented',
              input: options.input,
              output: options.output,
              format: options.format,
              template: options.template,
              exportResult: {
                success: true,
                outputPath: options.output || `export.${options.format}`,
                pageCount: 0,
                warnings: [],
              },
            },
            null,
            2
          )
        );
      } else {
        console.log(`Document Export`);
        console.log(`Input: ${options.input || 'No input specified'}`);
        console.log(`Output: ${options.output || 'Auto-generated'}`);
        console.log(`Format: ${options.format}`);
        console.log(`Template: ${options.template || 'Default template'}`);
        console.log('\nExport functionality not yet implemented.');
      }
    });

  program
    .command('formats')
    .description('List supported export formats')
    .option('--json', 'Output in JSON format', false)
    .action(options => {
      const formats = [
        { name: 'pdf', description: 'Portable Document Format', extension: '.pdf' },
        { name: 'html', description: 'HTML document', extension: '.html' },
        { name: 'docx', description: 'Microsoft Word document', extension: '.docx' },
        { name: 'md', description: 'Markdown document', extension: '.md' },
        { name: 'epub', description: 'Electronic Publication', extension: '.epub' },
      ];

      if (options.json) {
        console.log(JSON.stringify({ formats }, null, 2));
      } else {
        console.log('Supported Export Formats:');
        formats.forEach(format => {
          console.log(`  ${format.name.padEnd(6)} - ${format.description} (${format.extension})`);
        });
      }
    });

  program
    .command('templates')
    .description('List available export templates')
    .option('-f, --format <format>', 'Filter templates by format')
    .option('--json', 'Output in JSON format', false)
    .action(options => {
      const allTemplates = [
        { name: 'default', format: 'pdf', description: 'Default PDF template' },
        { name: 'corporate', format: 'pdf', description: 'Corporate branding template' },
        { name: 'minimal', format: 'html', description: 'Minimal HTML template' },
        { name: 'documentation', format: 'html', description: 'Documentation site template' },
      ];

      const templates = options.format
        ? allTemplates.filter(t => t.format === options.format)
        : allTemplates;

      if (options.json) {
        console.log(JSON.stringify({ templates }, null, 2));
      } else {
        console.log(`Available Templates${options.format ? ` (${options.format})` : ''}:`);
        templates.forEach(template => {
          console.log(
            `  ${template.name.padEnd(12)} [${template.format}] - ${template.description}`
          );
        });
      }
    });

  program.parse(argv);
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cli();
}
