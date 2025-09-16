#!/usr/bin/env node

/**
 * @ctrl-freaq/templates CLI
 *
 * Command-line interface for template operations including:
 * - Template validation and processing
 * - YAML template rendering
 * - Template watching and hot reload
 * - Template conversion and optimization
 *
 * Constitutional Compliance:
 * - CLI Interface Standard: Text-based I/O, JSON and human-readable output
 * - Library-First Architecture: Standalone template processing functionality
 */

import { Command } from 'commander';
import { TemplateEngine } from './templates/index.js';
import { YAMLParser, VariableParser } from './parsers/index.js';
import { TemplateValidator } from './validators/index.js';
import {
  TemplateWatcher,
  TemplateCache,
  TemplatePathUtils,
  TemplatePerformanceUtils,
} from './utils/index.js';
import { PACKAGE_INFO } from './index.js';

/**
 * CLI utility class for template operations
 */
class TemplatesCLI {
  private program: Command;
  private templateEngine: TemplateEngine;
  private cache: TemplateCache;

  constructor() {
    this.program = new Command();
    this.templateEngine = new TemplateEngine();
    this.cache = new TemplateCache();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('ctrl-freaq-templates')
      .description(PACKAGE_INFO.description)
      .version(PACKAGE_INFO.version);

    // Template processing commands
    const processCmd = this.program.command('process').description('Process and render templates');

    processCmd
      .command('render <template>')
      .description('Render template with variables')
      .option('-v, --variables <json>', 'Variables as JSON string')
      .option('-f, --variables-file <path>', 'Variables from JSON file')
      .option('-o, --output <path>', 'Output file path')
      .option('--pretty', 'Pretty print output')
      .action(async (template, options) => {
        await this.renderTemplate(template, options);
      });

    processCmd
      .command('validate <template>')
      .description('Validate template structure and syntax')
      .option('--json', 'Output in JSON format')
      .option('--strict', 'Enable strict validation')
      .action(async (template, options) => {
        await this.validateTemplate(template, options);
      });

    processCmd
      .command('compile <template>')
      .description('Compile template for faster rendering')
      .option('-o, --output <path>', 'Output compiled template')
      .action(async (template, options) => {
        await this.compileTemplate(template, options);
      });

    // Template management commands
    const manageCmd = this.program.command('manage').description('Template management operations');

    manageCmd
      .command('list [directory]')
      .description('List available templates')
      .option('--json', 'Output in JSON format')
      .option('-r, --recursive', 'Search recursively')
      .action(async (directory, options) => {
        await this.listTemplates(directory || '.', options);
      });

    manageCmd
      .command('info <template>')
      .description('Show template information and metadata')
      .option('--json', 'Output in JSON format')
      .action(async (template, options) => {
        await this.showTemplateInfo(template, options);
      });

    manageCmd
      .command('variables <template>')
      .description('Extract and list template variables')
      .option('--json', 'Output in JSON format')
      .option('--required-only', 'Show only required variables')
      .action(async (template, options) => {
        await this.showTemplateVariables(template, options);
      });

    // Development commands
    const devCmd = this.program.command('dev').description('Development utilities');

    devCmd
      .command('watch <directory>')
      .description('Watch templates for changes and auto-render')
      .option('-o, --output <directory>', 'Output directory for rendered templates')
      .option('-v, --variables <json>', 'Variables for rendering')
      .option('--verbose', 'Verbose output')
      .action(async (directory, options) => {
        await this.watchTemplates(directory, options);
      });

    devCmd
      .command('serve <directory>')
      .description('Start template development server')
      .option('-p, --port <number>', 'Server port', '3000')
      .option('--hot-reload', 'Enable hot reload')
      .action(async (directory, options) => {
        await this.serveTemplates(directory, options);
      });

    // Utility commands
    const utilCmd = this.program.command('util').description('Template utilities');

    utilCmd
      .command('convert <input> <output>')
      .description('Convert template between formats')
      .option('--from <format>', 'Source format (handlebars|mustache)', 'mustache')
      .option('--to <format>', 'Target format (handlebars|mustache)', 'mustache')
      .action(async (input, output, options) => {
        await this.convertTemplate(input, output, options);
      });

    utilCmd
      .command('minify <template>')
      .description('Minify template content')
      .option('-o, --output <path>', 'Output file path')
      .action(async (template, options) => {
        await this.minifyTemplate(template, options);
      });

    utilCmd
      .command('prettify <template>')
      .description('Prettify template content')
      .option('-o, --output <path>', 'Output file path')
      .option('--indent <size>', 'Indentation size', '2')
      .action(async (template, options) => {
        await this.prettifyTemplate(template, options);
      });

    // Performance commands
    const perfCmd = this.program.command('perf').description('Performance analysis');

    perfCmd
      .command('benchmark <template>')
      .description('Benchmark template rendering performance')
      .option('-n, --iterations <number>', 'Number of iterations', '1000')
      .option('-v, --variables <json>', 'Variables for rendering')
      .option('--json', 'Output in JSON format')
      .action(async (template, options) => {
        await this.benchmarkTemplate(template, options);
      });

    perfCmd
      .command('stats')
      .description('Show template performance statistics')
      .option('--json', 'Output in JSON format')
      .option('--clear', 'Clear statistics after showing')
      .action(async options => {
        await this.showPerformanceStats(options);
      });

    // Cache commands
    const cacheCmd = this.program.command('cache').description('Template cache management');

    cacheCmd
      .command('clear [template]')
      .description('Clear template cache')
      .action(template => {
        this.clearCache(template);
      });

    cacheCmd
      .command('stats')
      .description('Show cache statistics')
      .option('--json', 'Output in JSON format')
      .action(options => {
        this.showCacheStats(options);
      });
  }

  /**
   * Render template with variables
   */
  private async renderTemplate(
    templatePath: string,
    options: Record<string, unknown>
  ): Promise<void> {
    try {
      const fs = await import('fs');

      // Load template
      const template = await this.templateEngine.loadTemplateFromFile(templatePath);

      // Load variables
      let variables: Record<string, unknown> = {};
      if ('variables' in options && typeof options.variables === 'string') {
        variables = JSON.parse(options.variables);
      } else if ('variablesFile' in options && typeof options.variablesFile === 'string') {
        const variablesContent = fs.readFileSync(options.variablesFile, 'utf-8');
        variables = JSON.parse(variablesContent);
      }

      // Render template
      const start = Date.now();
      const rendered = this.templateEngine.render(template.metadata.name, { variables });
      const duration = Date.now() - start;

      // Track performance
      TemplatePerformanceUtils.trackRenderTime(template.metadata.name, duration);

      // Output result
      if ('output' in options && typeof options.output === 'string') {
        fs.writeFileSync(options.output, rendered);
        console.log(`Template rendered to ${options.output} (${duration}ms)`);
      } else {
        if ('pretty' in options && options.pretty) {
          console.log('Rendered Template:');
          console.log('=================');
        }
        console.log(rendered);
      }
    } catch (error) {
      console.error('Template rendering failed:', error);
      process.exit(1);
    }
  }

  /**
   * Validate template
   */
  private async validateTemplate(
    templatePath: string,
    options: Record<string, unknown>
  ): Promise<void> {
    try {
      const fs = await import('fs');
      const content = fs.readFileSync(templatePath, 'utf-8');
      const parsed = YAMLParser.parse(content);

      // Validate template structure
      const structureResult = TemplateValidator.validateTemplate(parsed);

      // Validate variables if present
      let variablesResult: { valid: boolean; errors: string[] } = { valid: true, errors: [] };
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'variables' in parsed &&
        parsed.variables
      ) {
        variablesResult = TemplateValidator.validateVariables(
          parsed.variables as Record<string, unknown>
        );
      }

      // Extract template variables from content
      const parsedObj = parsed as Record<string, unknown>;
      const templateContent = (parsedObj.content as string) || '';
      const extractedVars = VariableParser.extractVariables(templateContent);
      const extractedFunctions = VariableParser.extractFunctions(templateContent);

      const result = {
        valid: structureResult.valid && variablesResult.valid,
        template: templatePath,
        structure: structureResult,
        variables: variablesResult,
        analysis: {
          extractedVariables: extractedVars,
          extractedFunctions,
          hasPartials:
            parsedObj.sections &&
            typeof parsedObj.sections === 'object' &&
            parsedObj.sections !== null &&
            Object.keys(parsedObj.sections as Record<string, unknown>).length > 0,
        },
      };

      if ('json' in options && options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('Template Validation Results');
        console.log('===========================');
        console.log(`Template: ${templatePath}`);
        console.log(`Status: ${result.valid ? '✓ Valid' : '✗ Invalid'}`);

        if (result.structure.errors.length > 0) {
          console.log('\nStructure Errors:');
          result.structure.errors.forEach(error => console.log(`  ❌ ${error}`));
        }

        if (result.variables.errors.length > 0) {
          console.log('\nVariable Errors:');
          result.variables.errors.forEach(error => console.log(`  ❌ ${error}`));
        }

        if (result.analysis.extractedVariables.length > 0) {
          console.log(`\nExtracted Variables: ${result.analysis.extractedVariables.join(', ')}`);
        }

        if (result.analysis.extractedFunctions.length > 0) {
          console.log('\nExtracted Functions:');
          result.analysis.extractedFunctions.forEach(fn => {
            console.log(`  📋 ${fn.name}(${fn.args.join(', ')})`);
          });
        }
      }

      if (!result.valid) {
        process.exit(1);
      }
    } catch (error) {
      console.error('Template validation failed:', error);
      process.exit(1);
    }
  }

  /**
   * List templates in directory
   */
  private async listTemplates(directory: string, options: Record<string, unknown>): Promise<void> {
    try {
      const templates = TemplatePathUtils.listTemplates(directory);

      if ('json' in options && options.json) {
        const templateInfo = [];
        for (const templatePath of templates) {
          try {
            const template = await this.templateEngine.loadTemplateFromFile(templatePath);
            templateInfo.push({
              path: templatePath,
              name: template.metadata.name,
              version: template.metadata.version,
              description: template.metadata.description,
            });
          } catch {
            templateInfo.push({
              path: templatePath,
              name: TemplatePathUtils.getTemplateName(templatePath),
              error: 'Failed to load template',
            });
          }
        }
        console.log(JSON.stringify(templateInfo, null, 2));
      } else {
        console.log('Available Templates');
        console.log('==================');

        if (templates.length === 0) {
          console.log('No templates found in directory');
          return;
        }

        for (const templatePath of templates) {
          try {
            const template = await this.templateEngine.loadTemplateFromFile(templatePath);
            console.log(
              `${template.metadata.name} (v${template.metadata.version}) - ${templatePath}`
            );
            if (template.metadata.description) {
              console.log(`  ${template.metadata.description}`);
            }
          } catch {
            console.log(
              `${TemplatePathUtils.getTemplateName(templatePath)} - ${templatePath} [Error loading]`
            );
          }
        }
      }
    } catch (error) {
      console.error('Failed to list templates:', error);
      process.exit(1);
    }
  }

  /**
   * Show template information
   */
  private async showTemplateInfo(
    templatePath: string,
    options: Record<string, unknown>
  ): Promise<void> {
    try {
      const template = await this.templateEngine.loadTemplateFromFile(templatePath);

      if ('json' in options && options.json) {
        console.log(JSON.stringify(template, null, 2));
      } else {
        console.log('Template Information');
        console.log('===================');
        console.log(`Name: ${template.metadata.name}`);
        console.log(`Version: ${template.metadata.version}`);
        console.log(`Description: ${template.metadata.description || 'No description'}`);
        console.log(`Author: ${template.metadata.author || 'Unknown'}`);

        if (template.metadata.extends) {
          console.log(`Extends: ${template.metadata.extends}`);
        }

        if (template.metadata.tags && template.metadata.tags.length > 0) {
          console.log(`Tags: ${template.metadata.tags.join(', ')}`);
        }

        console.log(`Variables: ${Object.keys(template.variables).length}`);
        console.log(`Sections: ${Object.keys(template.sections).length}`);
      }
    } catch (error) {
      console.error('Failed to load template info:', error);
      process.exit(1);
    }
  }

  /**
   * Show template variables
   */
  private async showTemplateVariables(
    templatePath: string,
    options: Record<string, unknown>
  ): Promise<void> {
    try {
      const template = await this.templateEngine.loadTemplateFromFile(templatePath);
      let variables = Object.entries(template.variables);

      if ('requiredOnly' in options && options.requiredOnly) {
        variables = variables.filter(([, def]) => {
          return (
            typeof def === 'object' &&
            def !== null &&
            'required' in def &&
            (def as Record<string, unknown>).required
          );
        });
      }

      if ('json' in options && options.json) {
        console.log(JSON.stringify(Object.fromEntries(variables), null, 2));
      } else {
        console.log('Template Variables');
        console.log('==================');

        if (variables.length === 0) {
          console.log('No variables defined');
          return;
        }

        for (const [name, definition] of variables) {
          if (typeof definition === 'object' && definition !== null) {
            const defObj = definition as Record<string, unknown>;
            const required = 'required' in defObj && defObj.required ? ' (required)' : '';
            const type = 'type' in defObj && defObj.type ? ` [${defObj.type}]` : '';
            console.log(`${name}${type}${required}`);

            if ('description' in defObj && defObj.description) {
              console.log(`  ${defObj.description}`);
            }

            if ('default' in defObj && defObj.default !== undefined) {
              console.log(`  Default: ${JSON.stringify(defObj.default)}`);
            }
          } else {
            console.log(`${name}`);
            console.log(`  Default: ${JSON.stringify(definition)}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to analyze template variables:', error);
      process.exit(1);
    }
  }

  /**
   * Watch templates for changes
   */
  private async watchTemplates(directory: string, options: Record<string, unknown>): Promise<void> {
    console.log(`Watching templates in ${directory}...`);

    const watcher = new TemplateWatcher();

    watcher.on('change', async path => {
      console.log(`Template changed: ${path}`);

      if ('output' in options && typeof options.output === 'string') {
        try {
          await this.renderTemplate(path, {
            ...options,
            output: path.replace(directory, options.output),
          });
        } catch (error) {
          console.error(`Failed to render ${path}:`, error);
        }
      }
    });

    watcher.on('add', path => {
      console.log(`Template added: ${path}`);
    });

    watcher.on('remove', path => {
      console.log(`Template removed: ${path}`);
    });

    watcher.on('error', error => {
      console.error('Watcher error:', error);
    });

    watcher.watch(directory + '/**/*.{yaml,yml,template}');

    // Keep process alive
    process.on('SIGINT', () => {
      console.log('\nStopping template watcher...');
      watcher.stop();
      process.exit(0);
    });
  }

  /**
   * Benchmark template rendering
   */
  private async benchmarkTemplate(
    templatePath: string,
    options: Record<string, unknown>
  ): Promise<void> {
    try {
      const iterations =
        'iterations' in options && typeof options.iterations === 'string'
          ? parseInt(options.iterations, 10)
          : 10;
      let variables: Record<string, unknown> = {};

      if ('variables' in options && typeof options.variables === 'string') {
        variables = JSON.parse(options.variables);
      }

      const template = await this.templateEngine.loadTemplateFromFile(templatePath);
      const times: number[] = [];

      console.log(`Benchmarking template rendering (${iterations} iterations)...`);

      for (let i = 0; i < iterations; i++) {
        const start = process.hrtime.bigint();
        this.templateEngine.render(template.metadata.name, { variables });
        const end = process.hrtime.bigint();
        times.push(Number(end - start) / 1000000); // Convert to milliseconds
      }

      const total = times.reduce((sum, time) => sum + time, 0);
      const average = total / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);

      const result = {
        template: templatePath,
        iterations,
        times: {
          total: Math.round(total * 100) / 100,
          average: Math.round(average * 100) / 100,
          min: Math.round(min * 100) / 100,
          max: Math.round(max * 100) / 100,
        },
      };

      if ('json' in options && options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('Benchmark Results');
        console.log('================');
        console.log(`Template: ${templatePath}`);
        console.log(`Iterations: ${iterations}`);
        console.log(`Total time: ${result.times.total}ms`);
        console.log(`Average: ${result.times.average}ms`);
        console.log(`Min: ${result.times.min}ms`);
        console.log(`Max: ${result.times.max}ms`);
        console.log(`Renders per second: ${Math.round(1000 / result.times.average)}`);
      }
    } catch (error) {
      console.error('Benchmark failed:', error);
      process.exit(1);
    }
  }

  /**
   * Additional CLI methods would be implemented here...
   */
  private async compileTemplate(
    _template: string,
    _options: Record<string, unknown>
  ): Promise<void> {
    console.log('Template compilation not implemented yet');
  }

  private async serveTemplates(
    _directory: string,
    _options: Record<string, unknown>
  ): Promise<void> {
    console.log('Template development server not implemented yet');
  }

  private async convertTemplate(
    _input: string,
    _output: string,
    _options: Record<string, unknown>
  ): Promise<void> {
    console.log('Template conversion not implemented yet');
  }

  private async minifyTemplate(
    _template: string,
    _options: Record<string, unknown>
  ): Promise<void> {
    console.log('Template minification not implemented yet');
  }

  private async prettifyTemplate(
    _template: string,
    _options: Record<string, unknown>
  ): Promise<void> {
    console.log('Template prettification not implemented yet');
  }

  private async showPerformanceStats(options: Record<string, unknown>): Promise<void> {
    const stats = TemplatePerformanceUtils.getAllRenderStats();

    if ('json' in options && options.json) {
      console.log(JSON.stringify(stats, null, 2));
    } else {
      console.log('Performance Statistics');
      console.log('=====================');

      if (Object.keys(stats).length === 0) {
        console.log('No performance data available');
        return;
      }

      for (const [template, data] of Object.entries(stats)) {
        if (data) {
          console.log(`${template}:`);
          console.log(`  Renders: ${data.count}`);
          console.log(`  Average: ${Math.round(data.average * 100) / 100}ms`);
          console.log(`  Min: ${Math.round(data.min * 100) / 100}ms`);
          console.log(`  Max: ${Math.round(data.max * 100) / 100}ms`);
        }
      }
    }

    if ('clear' in options && options.clear) {
      TemplatePerformanceUtils.clearStats();
      console.log('Performance statistics cleared');
    }
  }

  private clearCache(template?: string): void {
    if (template) {
      this.cache.delete(template);
      console.log(`Cache cleared for template: ${template}`);
    } else {
      this.cache.clear();
      console.log('All template cache cleared');
    }
  }

  private showCacheStats(options: Record<string, unknown>): void {
    const stats = this.cache.getStats();

    if ('json' in options && options.json) {
      console.log(JSON.stringify(stats, null, 2));
    } else {
      console.log('Cache Statistics');
      console.log('================');
      console.log(`Size: ${stats.size}/${stats.maxSize}`);
      console.log(`Keys: ${stats.keys.join(', ')}`);
    }
  }

  /**
   * Run the CLI
   */
  run(): void {
    this.program.parse();
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new TemplatesCLI();
  cli.run();
}
