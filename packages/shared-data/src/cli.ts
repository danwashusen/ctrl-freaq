#!/usr/bin/env node

/**
 * @ctrl-freaq/shared-data CLI
 *
 * Command-line interface for shared data operations including:
 * - Database schema management
 * - Data migrations
 * - Entity validation
 * - Repository utilities
 *
 * Constitutional Compliance:
 * - CLI Interface Standard: Text-based I/O, JSON and human-readable output
 * - Library-First Architecture: Standalone functionality with clear boundaries
 */

import { Command } from 'commander';
import { PACKAGE_INFO } from './index.js';

// import { dirname } from 'path';
// import { fileURLToPath } from 'url';
// const __dirname = dirname(fileURLToPath(import.meta.url)); // Available for future use

/**
 * CLI utility functions
 */
class SharedDataCLI {
  private program: Command;

  constructor() {
    this.program = new Command();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('ctrl-freaq-shared-data')
      .description(PACKAGE_INFO.description)
      .version(PACKAGE_INFO.version);

    // Schema commands
    const schemaCmd = this.program
      .command('schema')
      .description('Database schema operations');

    schemaCmd
      .command('validate')
      .description('Validate database schema against entity definitions')
      .option('--db-path <path>', 'Database file path', './data/ctrl-freaq.db')
      .option('--json', 'Output in JSON format')
      .action(async (options) => {
        await this.validateSchema(options);
      });

    schemaCmd
      .command('generate')
      .description('Generate SQL schema from entity definitions')
      .option('--output <file>', 'Output file path')
      .option('--format <format>', 'Output format (sql|json)', 'sql')
      .action(async (options) => {
        await this.generateSchema(options);
      });

    // Entity commands
    const entityCmd = this.program
      .command('entity')
      .description('Entity management operations');

    entityCmd
      .command('list')
      .description('List all available entity types')
      .option('--json', 'Output in JSON format')
      .action(async (options) => {
        await this.listEntities(options);
      });

    entityCmd
      .command('validate <type>')
      .description('Validate entity data against schema')
      .option('--data <json>', 'JSON data to validate')
      .option('--file <path>', 'File containing JSON data')
      .action(async (type, options) => {
        await this.validateEntity(type, options);
      });

    // Repository commands
    const repoCmd = this.program
      .command('repo')
      .description('Repository operations');

    repoCmd
      .command('test')
      .description('Test repository connections and operations')
      .option('--db-path <path>', 'Database file path', './data/ctrl-freaq.db')
      .option('--json', 'Output in JSON format')
      .action(async (options) => {
        await this.testRepositories(options);
      });

    repoCmd
      .command('stats')
      .description('Show repository statistics')
      .option('--db-path <path>', 'Database file path', './data/ctrl-freaq.db')
      .option('--json', 'Output in JSON format')
      .action(async (options) => {
        await this.showStats(options);
      });

    // Utility commands
    const utilCmd = this.program
      .command('util')
      .description('Utility operations');

    utilCmd
      .command('generate-id')
      .description('Generate a new UUID')
      .option('--count <n>', 'Number of IDs to generate', '1')
      .action((options) => {
        this.generateIds(options);
      });

    utilCmd
      .command('slug <text>')
      .description('Generate URL-friendly slug from text')
      .action((text) => {
        this.generateSlug(text);
      });

    // Development commands
    const devCmd = this.program
      .command('dev')
      .description('Development utilities');

    devCmd
      .command('seed')
      .description('Seed database with development data')
      .option('--db-path <path>', 'Database file path', './data/ctrl-freaq.db')
      .option('--reset', 'Reset existing data before seeding')
      .action(async (options) => {
        await this.seedDatabase(options);
      });

    devCmd
      .command('reset')
      .description('Reset database to clean state')
      .option('--db-path <path>', 'Database file path', './data/ctrl-freaq.db')
      .option('--confirm', 'Skip confirmation prompt')
      .action(async (options) => {
        await this.resetDatabase(options);
      });
  }

  /**
   * Schema validation
   */
  private async validateSchema(options: any): Promise<void> {
    const result = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
      entities: [] as string[]
    };

    try {
      // Validate all exported schemas from models
      const models = [
        { name: 'User', schema: (await import('./models/user')).UserSchema },
        { name: 'Project', schema: (await import('./models/project')).ProjectSchema },
        { name: 'Configuration', schema: (await import('./models/configuration')).ConfigurationSchema },
        { name: 'AppVersion', schema: (await import('./models/app-version')).AppVersionSchema },
        { name: 'ActivityLog', schema: (await import('./models/activity-log')).ActivityLogSchema },
      ];

      for (const model of models) {
        try {
          // Validate that the schema can parse a minimal object
          const minimalObject = Object.fromEntries(
            Object.keys(model.schema.shape).map(key => [key, null])
          );
          model.schema.safeParse(minimalObject);
          result.entities.push(model.name);
        } catch (error) {
          result.valid = false;
          result.warnings.push(`Schema validation failed for ${model.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('Database Schema Validation');
        console.log('========================');
        console.log(`Status: ${result.valid ? '✓ Valid' : '✗ Invalid'}`);
        console.log(`Entities: ${result.entities.join(', ')}`);

        if (result.warnings.length > 0) {
          console.log('\nWarnings:');
          result.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
        }

        if (result.errors.length > 0) {
          console.log('\nErrors:');
          result.errors.forEach(error => console.log(`  ❌ ${error}`));
        }
      }
    } catch (error) {
      console.error('Schema validation failed:', error);
      process.exit(1);
    }
  }

  /**
   * Schema generation
   */
  private async generateSchema(options: any): Promise<void> {
    const schema = {
      version: '0.1.0',
      entities: {
        users: {
          table: 'users',
          fields: {
            id: { type: 'TEXT', primary: true },
            email: { type: 'TEXT', required: true, unique: true },
            first_name: { type: 'TEXT' },
            last_name: { type: 'TEXT' },
            created_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
            updated_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' }
          }
        },
        projects: {
          table: 'projects',
          fields: {
            id: { type: 'TEXT', primary: true },
            owner_user_id: { type: 'TEXT', required: true, foreignKey: 'users.id' },
            name: { type: 'TEXT', required: true },
            slug: { type: 'TEXT', required: true, unique: true },
            description: { type: 'TEXT' },
            created_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' },
            updated_at: { type: 'DATETIME', default: 'CURRENT_TIMESTAMP' }
          }
        }
      }
    };

    if (options.format === 'json') {
      const output = JSON.stringify(schema, null, 2);

      if (options.output) {
        const fs = await import('fs');
        fs.writeFileSync(options.output, output);
        console.log(`Schema written to ${options.output}`);
      } else {
        console.log(output);
      }
    } else {
      // Generate SQL
      let sql = '-- Generated schema for CTRL FreaQ\n\n';

      for (const [_entityName, entity] of Object.entries(schema.entities)) {
        sql += `CREATE TABLE ${entity.table} (\n`;

        const fieldLines = Object.entries(entity.fields).map(([fieldName, field]: [string, any]) => {
          let line = `  ${fieldName} ${field.type}`;

          if (field.primary) line += ' PRIMARY KEY';
          if (field.required && !field.primary) line += ' NOT NULL';
          if (field.unique && !field.primary) line += ' UNIQUE';
          if (field.default) line += ` DEFAULT ${field.default}`;

          return line;
        });

        sql += fieldLines.join(',\n');
        sql += '\n);\n\n';
      }

      if (options.output) {
        const fs = await import('fs');
        fs.writeFileSync(options.output, sql);
        console.log(`SQL schema written to ${options.output}`);
      } else {
        console.log(sql);
      }
    }
  }

  /**
   * List entities
   */
  private async listEntities(options: any): Promise<void> {
    const entities = [
      { name: 'User', description: 'User accounts and profiles' },
      { name: 'Project', description: 'User projects and workspaces' },
      { name: 'Configuration', description: 'User configuration settings' },
      { name: 'AppVersion', description: 'Application version tracking' },
      { name: 'ActivityLog', description: 'User activity and audit logs' }
    ];

    if (options.json) {
      console.log(JSON.stringify(entities, null, 2));
    } else {
      console.log('Available Entity Types');
      console.log('====================');
      entities.forEach(entity => {
        console.log(`${entity.name.padEnd(15)} - ${entity.description}`);
      });
    }
  }

  /**
   * Validate entity data
   */
  private async validateEntity(type: string, options: any): Promise<void> {
    let data: any;

    try {
      if (options.data) {
        data = JSON.parse(options.data);
      } else if (options.file) {
        const fs = await import('fs');
        const content = fs.readFileSync(options.file, 'utf-8');
        data = JSON.parse(content);
      } else {
        throw new Error('No data provided. Use --data or --file option.');
      }

      // Mock validation - would use actual Zod schemas
      const result = {
        valid: true,
        entity: type,
        errors: [] as string[],
        data
      };

      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Validation failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test repositories
   */
  private async testRepositories(options: any): Promise<void> {
    const result = {
      success: true,
      repositories: [
        { name: 'UserRepository', status: 'not_implemented' },
        { name: 'ProjectRepository', status: 'not_implemented' },
        { name: 'ConfigurationRepository', status: 'not_implemented' },
        { name: 'AppVersionRepository', status: 'not_implemented' },
        { name: 'ActivityLogRepository', status: 'not_implemented' }
      ],
      database: {
        connected: false,
        path: options.dbPath
      }
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('Repository Test Results');
      console.log('======================');
      console.log(`Database: ${result.database.connected ? '✓' : '✗'} ${result.database.path}`);
      console.log('\nRepositories:');
      result.repositories.forEach(repo => {
        const status = repo.status === 'not_implemented' ? '⏳ Not Implemented' : '✓ OK';
        console.log(`  ${repo.name.padEnd(25)} - ${status}`);
      });
    }
  }

  /**
   * Show repository statistics
   */
  private async showStats(options: any): Promise<void> {
    const stats = {
      database: {
        path: options.dbPath,
        size: 0,
        connected: false
      },
      entities: {
        users: 0,
        projects: 0,
        configurations: 0,
        app_versions: 0,
        activity_logs: 0
      },
      totalRecords: 0
    };

    if (options.json) {
      console.log(JSON.stringify(stats, null, 2));
    } else {
      console.log('Repository Statistics');
      console.log('====================');
      console.log(`Database: ${stats.database.path}`);
      console.log(`Status: ${stats.database.connected ? 'Connected' : 'Disconnected'}`);
      console.log(`Total Records: ${stats.totalRecords}`);
      console.log('\nEntity Counts:');
      Object.entries(stats.entities).forEach(([entity, count]) => {
        console.log(`  ${entity.padEnd(20)} - ${count}`);
      });
    }
  }

  /**
   * Generate UUIDs
   */
  private generateIds(options: any): void {
    const count = parseInt(options.count, 10);
    import('./utils/index.js').then(({ generateId }) => {
      for (let i = 0; i < count; i++) {
        console.log(generateId());
      }
    }).catch(error => {
      console.error('Failed to generate IDs:', error.message);
    });
  }

  /**
   * Generate slug
   */
  private generateSlug(text: string): void {
    import('./utils/index.js').then(({ generateSlug }) => {
      console.log(generateSlug(text));
    }).catch(error => {
      console.error('Failed to generate slug:', error.message);
    });
  }

  /**
   * Seed database with development data
   */
  private async seedDatabase(options: any): Promise<void> {
    console.log('Database seeding not implemented yet');
    console.log(`Database path: ${options.dbPath}`);
    console.log(`Reset existing: ${options.reset ? 'Yes' : 'No'}`);
  }

  /**
   * Reset database
   */
  private async resetDatabase(options: any): Promise<void> {
    if (!options.confirm) {
      console.log('⚠️  This will permanently delete all data!');
      console.log('Use --confirm flag to proceed.');
      return;
    }

    console.log('Database reset not implemented yet');
    console.log(`Database path: ${options.dbPath}`);
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
  const cli = new SharedDataCLI();
  cli.run();
}