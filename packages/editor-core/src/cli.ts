#!/usr/bin/env node

import { Command } from 'commander';
import { createPatchEngine, type PatchDiff } from './patch-engine.js';
import { promises as fs } from 'fs';

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
    .action(options => {
      const extensions = options.extensions
        ? options.extensions.split(',')
        : ['document', 'paragraph', 'text', 'bold', 'italic'];

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              status: 'success',
              message: 'Editor instance creation functionality not yet implemented',
              config: options.config,
              extensions,
              editorConfig: {
                extensions,
                content: '',
                editable: true,
                autofocus: false,
              },
            },
            null,
            2
          )
        );
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
    .action(options => {
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
        { name: 'image', type: 'layout', description: 'Image embedding' },
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
    .action(options => {
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              status: 'success',
              message: 'Content validation functionality not yet implemented',
              content: options.content,
              schema: options.schema,
              validation: {
                valid: true,
                errors: [],
                warnings: [],
              },
            },
            null,
            2
          )
        );
      } else {
        console.log(`Content Validation`);
        console.log(`Content: ${options.content || 'No content specified'}`);
        console.log(`Schema: ${options.schema || 'Default schema'}`);
        console.log('\nValidation functionality not yet implemented.');
      }
    });

  // Patch management commands
  program
    .command('patch')
    .description('Patch management operations')
    .addCommand(createPatchSubcommands());

  program.parse(argv);
}

/**
 * Create patch-related subcommands
 */
function createPatchSubcommands(): Command {
  const patchCmd = new Command('patch');

  patchCmd
    .command('create')
    .description('Create a patch between two content versions')
    .requiredOption('-o, --original <file>', 'Original content file')
    .requiredOption('-m, --modified <file>', 'Modified content file')
    .option('--output <file>', 'Output patch file')
    .option('--json', 'Output in JSON format', false)
    .action(async options => {
      try {
        const originalContent = await fs.readFile(options.original, 'utf-8');
        const modifiedContent = await fs.readFile(options.modified, 'utf-8');

        const patchEngine = createPatchEngine();
        const patches = patchEngine.createPatch(originalContent, modifiedContent);

        const result = {
          patches,
          originalFile: options.original,
          modifiedFile: options.modified,
          patchCount: patches.length,
          createdAt: new Date().toISOString(),
        };

        if (options.output) {
          await fs.writeFile(options.output, JSON.stringify(result, null, 2));
          console.log(`Patch written to ${options.output}`);
        } else if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`Created ${patches.length} patches:`);
          patches.forEach((patch, index) => {
            console.log(`  ${index + 1}. ${patch.op} at ${patch.path}`);
            if (patch.oldValue) console.log(`     - ${patch.oldValue.slice(0, 50)}...`);
            if (patch.value) console.log(`     + ${patch.value.slice(0, 50)}...`);
          });
        }
      } catch (error) {
        console.error(
          'Error creating patch:',
          error instanceof Error ? error.message : 'Unknown error'
        );
        process.exit(1);
      }
    });

  patchCmd
    .command('apply')
    .description('Apply a patch to original content')
    .requiredOption('-o, --original <file>', 'Original content file')
    .requiredOption('-p, --patch <file>', 'Patch file to apply')
    .option('--output <file>', 'Output file for patched content')
    .option('--json', 'Output in JSON format', false)
    .action(async options => {
      try {
        const originalContent = await fs.readFile(options.original, 'utf-8');
        const patchData = JSON.parse(await fs.readFile(options.patch, 'utf-8'));

        const patchEngine = createPatchEngine();
        const result = patchEngine.applyPatch(originalContent, patchData.patches);

        if (!result.success) {
          console.error('Failed to apply patch:', result.error);
          if (result.conflicted) {
            console.error('Patch application resulted in conflicts');
          }
          process.exit(1);
        }

        if (options.output && result.content) {
          await fs.writeFile(options.output, result.content);
          console.log(`Patched content written to ${options.output}`);
        } else if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('Patch applied successfully');
          if (result.content) {
            console.log('Patched content:');
            console.log('--- BEGIN CONTENT ---');
            console.log(result.content);
            console.log('--- END CONTENT ---');
          }
        }
      } catch (error) {
        console.error(
          'Error applying patch:',
          error instanceof Error ? error.message : 'Unknown error'
        );
        process.exit(1);
      }
    });

  patchCmd
    .command('preview')
    .description('Preview changes between two content versions')
    .requiredOption('-o, --original <file>', 'Original content file')
    .requiredOption('-m, --modified <file>', 'Modified content file')
    .option('--json', 'Output in JSON format', false)
    .action(async options => {
      try {
        const originalContent = await fs.readFile(options.original, 'utf-8');
        const modifiedContent = await fs.readFile(options.modified, 'utf-8');

        const patchEngine = createPatchEngine();
        const preview = patchEngine.previewPatch(originalContent, modifiedContent);

        if (options.json) {
          console.log(JSON.stringify(preview, null, 2));
        } else {
          console.log(`Changes Preview:`);
          console.log(`  Additions: ${preview.additions}`);
          console.log(`  Deletions: ${preview.deletions}`);
          console.log(`  Total patches: ${preview.patches.length}`);
          console.log('\nDiff preview:');
          console.log('--- BEGIN DIFF ---');
          console.log(preview.preview);
          console.log('--- END DIFF ---');
        }
      } catch (error) {
        console.error(
          'Error generating preview:',
          error instanceof Error ? error.message : 'Unknown error'
        );
        process.exit(1);
      }
    });

  patchCmd
    .command('validate')
    .description('Validate a patch file')
    .requiredOption('-p, --patch <file>', 'Patch file to validate')
    .option('--json', 'Output in JSON format', false)
    .action(async options => {
      try {
        const patchData = JSON.parse(await fs.readFile(options.patch, 'utf-8'));

        const patchEngine = createPatchEngine();

        // Validate patch structure
        const isValidStructure = patchData.patches && Array.isArray(patchData.patches);
        let errors: string[] = [];

        if (!isValidStructure) {
          errors.push('Invalid patch file structure: missing or invalid patches array');
        } else {
          // Use the validation from patch engine
          const validation = patchEngine.validatePatches(patchData.patches);
          if (!validation.valid) {
            errors = validation.errors;
          }
        }

        const result = {
          valid: errors.length === 0,
          errors,
          patchCount: patchData.patches?.length || 0,
          validatedAt: new Date().toISOString(),
        };

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`Patch Validation Results:`);
          console.log(`  Valid: ${result.valid ? 'Yes' : 'No'}`);
          console.log(`  Patch count: ${result.patchCount}`);

          if (errors.length > 0) {
            console.log('\nErrors found:');
            errors.forEach((error, index) => {
              console.log(`  ${index + 1}. ${error}`);
            });
          } else {
            console.log('\nNo validation errors found.');
          }
        }

        if (!result.valid) {
          process.exit(1);
        }
      } catch (error) {
        console.error(
          'Error validating patch:',
          error instanceof Error ? error.message : 'Unknown error'
        );
        process.exit(1);
      }
    });

  patchCmd
    .command('stats')
    .description('Show statistics for a patch file')
    .requiredOption('-p, --patch <file>', 'Patch file to analyze')
    .option('--json', 'Output in JSON format', false)
    .action(async options => {
      try {
        const patchData = JSON.parse(await fs.readFile(options.patch, 'utf-8'));

        if (!patchData.patches || !Array.isArray(patchData.patches)) {
          throw new Error('Invalid patch file structure');
        }

        const stats = {
          totalPatches: patchData.patches.length,
          operations: {
            add: patchData.patches.filter((p: PatchDiff) => p.op === 'add').length,
            remove: patchData.patches.filter((p: PatchDiff) => p.op === 'remove').length,
            replace: patchData.patches.filter((p: PatchDiff) => p.op === 'replace').length,
          },
          createdAt: patchData.createdAt || 'Unknown',
          originalFile: patchData.originalFile || 'Unknown',
          modifiedFile: patchData.modifiedFile || 'Unknown',
        };

        if (options.json) {
          console.log(JSON.stringify(stats, null, 2));
        } else {
          console.log(`Patch Statistics:`);
          console.log(`  Total patches: ${stats.totalPatches}`);
          console.log(`  Operations:`);
          console.log(`    Add: ${stats.operations.add}`);
          console.log(`    Remove: ${stats.operations.remove}`);
          console.log(`    Replace: ${stats.operations.replace}`);
          console.log(`  Created: ${stats.createdAt}`);
          console.log(`  Original file: ${stats.originalFile}`);
          console.log(`  Modified file: ${stats.modifiedFile}`);
        }
      } catch (error) {
        console.error(
          'Error analyzing patch:',
          error instanceof Error ? error.message : 'Unknown error'
        );
        process.exit(1);
      }
    });

  return patchCmd;
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cli();
}
