#!/usr/bin/env node

import { Command } from 'commander';
import { createLocalStorageManager } from './local-storage.js';
import { promises as fs } from 'fs';

const program = new Command();

/**
 * Main CLI function for the Editor Persistence package
 */
export function cli(argv?: string[]): void {
  program
    .name('@ctrl-freaq/editor-persistence')
    .description('Client-side persistence library for CTRL FreaQ editor state management')
    .version('0.1.0');

  program
    .command('storage')
    .description('Manage client-side storage operations')
    .option('-a, --action <action>', 'Storage action (save, load, clear, stats)', 'stats')
    .option('-k, --key <key>', 'Storage key')
    .option('-d, --data <data>', 'Data to store (JSON string)')
    .option('--json', 'Output in JSON format', false)
    .action(async options => {
      try {
        const storageManager = createLocalStorageManager();
        await storageManager.initialize();

        switch (options.action) {
          case 'stats': {
            const stats = await storageManager.getStats();
            if (options.json) {
              console.log(JSON.stringify(stats, null, 2));
            } else {
              console.log('Storage Statistics:');
              console.log(`  Total Size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
              console.log(`  Pending Changes: ${stats.itemCounts.pendingChanges}`);
              console.log(`  Editor Sessions: ${stats.itemCounts.editorSessions}`);
              console.log(`  Backups: ${stats.itemCounts.backups}`);
              console.log(`  Preferences: ${stats.itemCounts.preferences}`);
              console.log(`  Last Cleanup: ${new Date(stats.lastCleanup).toLocaleString()}`);
            }
            break;
          }

          case 'clear': {
            await storageManager.clear();
            console.log(
              options.json
                ? JSON.stringify({ status: 'success', message: 'Storage cleared' })
                : 'Storage cleared successfully'
            );
            break;
          }

          default:
            console.error(`Unknown action: ${options.action}`);
            process.exit(1);
        }
      } catch (error) {
        console.error(
          'Storage operation failed:',
          error instanceof Error ? error.message : 'Unknown error'
        );
        process.exit(1);
      }
    });

  program
    .command('sync')
    .description('Manage state synchronization')
    .option('-m, --mode <mode>', 'Sync mode (auto, manual, offline)', 'auto')
    .option('-i, --interval <interval>', 'Sync interval in seconds', '30')
    .option('--json', 'Output in JSON format', false)
    .action(options => {
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              status: 'success',
              message: 'Synchronization functionality not yet implemented',
              mode: options.mode,
              interval: parseInt(options.interval),
              syncStatus: {
                enabled: true,
                lastSync: null,
                pendingChanges: 0,
                conflicts: 0,
              },
            },
            null,
            2
          )
        );
      } else {
        console.log(`State Synchronization`);
        console.log(`Mode: ${options.mode}`);
        console.log(`Interval: ${options.interval} seconds`);
        console.log('\nSynchronization functionality not yet implemented.');
      }
    });

  program
    .command('backup')
    .description('Manage editor state backups')
    .option('-a, --action <action>', 'Backup action (create, restore, list)', 'list')
    .option('-i, --id <id>', 'Backup ID for restore operations')
    .option('-t, --type <type>', 'Backup type (pendingChanges, editorSession, full)', 'full')
    .option('-f, --file <file>', 'File to read data from for backup creation')
    .option('--output <file>', 'Output file for restore operations')
    .option('--json', 'Output in JSON format', false)
    .action(async options => {
      try {
        const storageManager = createLocalStorageManager();
        await storageManager.initialize();

        switch (options.action) {
          case 'list': {
            const stats = await storageManager.getStats();
            if (options.json) {
              console.log(
                JSON.stringify(
                  {
                    backupCount: stats.itemCounts.backups,
                    totalSize: stats.totalSize,
                  },
                  null,
                  2
                )
              );
            } else {
              console.log('Backup Status:');
              console.log(`  Count: ${stats.itemCounts.backups}`);
              console.log(`  Total Size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
            }
            break;
          }

          case 'create': {
            if (!options.file) {
              console.error('--file option required for backup creation');
              process.exit(1);
            }

            const data = JSON.parse(await fs.readFile(options.file, 'utf-8'));
            const backupId = await storageManager.createBackup(options.type, data);

            if (options.json) {
              console.log(JSON.stringify({ backupId, type: options.type }, null, 2));
            } else {
              console.log(`Backup created: ${backupId}`);
              console.log(`Type: ${options.type}`);
            }
            break;
          }

          case 'restore': {
            if (!options.id) {
              console.error('--id option required for backup restoration');
              process.exit(1);
            }

            const backup = await storageManager.restoreBackup(options.id);
            if (!backup) {
              console.error(`Backup not found: ${options.id}`);
              process.exit(1);
            }

            if (options.output) {
              await fs.writeFile(options.output, JSON.stringify(backup, null, 2));
              console.log(`Backup restored to: ${options.output}`);
            } else if (options.json) {
              console.log(JSON.stringify(backup, null, 2));
            } else {
              console.log('Backup Details:');
              console.log(`  ID: ${backup.id}`);
              console.log(`  Type: ${backup.type}`);
              console.log(`  Timestamp: ${new Date(backup.timestamp).toLocaleString()}`);
              console.log(`  Size: ${(backup.size / 1024).toFixed(2)} KB`);
              console.log(`  Compressed: ${backup.compressed}`);
            }
            break;
          }

          default:
            console.error(`Unknown action: ${options.action}`);
            process.exit(1);
        }
      } catch (error) {
        console.error(
          'Backup operation failed:',
          error instanceof Error ? error.message : 'Unknown error'
        );
        process.exit(1);
      }
    });

  program
    .command('status')
    .description('Show storage and sync status')
    .option('--json', 'Output in JSON format', false)
    .action(async options => {
      try {
        const storageManager = createLocalStorageManager();
        await storageManager.initialize();

        const stats = await storageManager.getStats();

        const status = {
          storage: {
            type: 'IndexedDB',
            available: true,
            used: `${(stats.totalSize / 1024).toFixed(2)} KB`,
            quota: 'Browser dependent',
          },
          sync: {
            enabled: false,
            mode: 'manual',
            lastSync: null,
            pendingChanges: stats.itemCounts.pendingChanges,
          },
          backups: {
            count: stats.itemCounts.backups,
            totalSize: `${(stats.totalSize / 1024).toFixed(2)} KB`,
            oldestBackup: null,
          },
          items: {
            pendingChanges: stats.itemCounts.pendingChanges,
            editorSessions: stats.itemCounts.editorSessions,
            preferences: stats.itemCounts.preferences,
          },
        };

        if (options.json) {
          console.log(JSON.stringify({ status }, null, 2));
        } else {
          console.log('Editor Persistence Status:');
          console.log(`\nStorage:`);
          console.log(`  Type: ${status.storage.type}`);
          console.log(`  Available: ${status.storage.available}`);
          console.log(`  Used: ${status.storage.used}`);
          console.log(`  Quota: ${status.storage.quota}`);
          console.log(`\nItems:`);
          console.log(`  Pending Changes: ${status.items.pendingChanges}`);
          console.log(`  Editor Sessions: ${status.items.editorSessions}`);
          console.log(`  Preferences: ${status.items.preferences}`);
          console.log(`\nSynchronization:`);
          console.log(`  Enabled: ${status.sync.enabled}`);
          console.log(`  Mode: ${status.sync.mode}`);
          console.log(`  Last Sync: ${status.sync.lastSync || 'Never'}`);
          console.log(`  Pending Changes: ${status.sync.pendingChanges}`);
          console.log(`\nBackups:`);
          console.log(`  Count: ${status.backups.count}`);
          console.log(`  Total Size: ${status.backups.totalSize}`);
        }
      } catch (error) {
        console.error(
          'Failed to get status:',
          error instanceof Error ? error.message : 'Unknown error'
        );
        process.exit(1);
      }
    });

  // Add pending changes management commands
  program
    .command('changes')
    .description('Manage pending changes')
    .option('-a, --action <action>', 'Action (list, load, save, remove)', 'list')
    .option('-d, --document <docId>', 'Document ID')
    .option('-s, --section <sectionId>', 'Section ID')
    .option('-f, --file <file>', 'File containing change data')
    .option('--json', 'Output in JSON format', false)
    .action(async options => {
      try {
        const storageManager = createLocalStorageManager();
        await storageManager.initialize();

        switch (options.action) {
          case 'list': {
            if (!options.document) {
              console.error('--document option required for listing changes');
              process.exit(1);
            }

            const changes = await storageManager.loadPendingChanges(
              options.document,
              options.section
            );

            if (options.json) {
              console.log(JSON.stringify(changes, null, 2));
            } else {
              console.log(`Pending Changes for Document ${options.document}:`);
              if (changes.length === 0) {
                console.log('  No pending changes found');
              } else {
                changes.forEach((change, index) => {
                  console.log(`  ${index + 1}. ${change.id}`);
                  console.log(`     Section: ${change.sectionId}`);
                  console.log(`     Status: ${change.status}`);
                  console.log(`     Patches: ${change.patches.length}`);
                  console.log(`     Created: ${new Date(change.createdAt).toLocaleString()}`);
                });
              }
            }
            break;
          }

          case 'save': {
            if (!options.file) {
              console.error('--file option required for saving changes');
              process.exit(1);
            }

            const changeData = JSON.parse(await fs.readFile(options.file, 'utf-8'));
            await storageManager.savePendingChange(changeData);

            console.log(
              options.json
                ? JSON.stringify({ status: 'success', changeId: changeData.id })
                : `Pending change saved: ${changeData.id}`
            );
            break;
          }

          case 'remove':
            if (!options.document || !options.section) {
              console.error('--document and --section options required for removing changes');
              process.exit(1);
            }

            // This would need a change ID, but for simplicity, we'll just show the concept
            console.log(
              options.json
                ? JSON.stringify({ status: 'info', message: 'Remove requires specific change ID' })
                : 'Remove operation requires specific change ID'
            );
            break;

          default:
            console.error(`Unknown action: ${options.action}`);
            process.exit(1);
        }
      } catch (error) {
        console.error(
          'Changes operation failed:',
          error instanceof Error ? error.message : 'Unknown error'
        );
        process.exit(1);
      }
    });

  // Add editor session management commands
  program
    .command('sessions')
    .description('Manage editor sessions')
    .option('-a, --action <action>', 'Action (list, load, save)', 'list')
    .option('-d, --document <docId>', 'Document ID')
    .option('-s, --session <sessionId>', 'Session ID')
    .option('-f, --file <file>', 'File containing session data')
    .option('--json', 'Output in JSON format', false)
    .action(async options => {
      try {
        const storageManager = createLocalStorageManager();
        await storageManager.initialize();

        switch (options.action) {
          case 'list': {
            if (!options.document) {
              console.error('--document option required for listing sessions');
              process.exit(1);
            }

            const sessions = await storageManager.listEditorSessions(options.document);

            if (options.json) {
              console.log(JSON.stringify(sessions, null, 2));
            } else {
              console.log(`Editor Sessions for Document ${options.document}:`);
              if (sessions.length === 0) {
                console.log('  No sessions found');
              } else {
                sessions.forEach((session, index) => {
                  console.log(`  ${index + 1}. ${session.sessionId}`);
                  console.log(`     User: ${session.userId}`);
                  console.log(`     Mode: ${session.editorMode}`);
                  console.log(`     Active Section: ${session.activeSectionId || 'None'}`);
                  console.log(`     Pending Changes: ${session.pendingChangeCount}`);
                  console.log(`     Last Save: ${new Date(session.lastSaveTime).toLocaleString()}`);
                });
              }
            }
            break;
          }

          case 'load': {
            if (!options.document || !options.session) {
              console.error('--document and --session options required for loading session');
              process.exit(1);
            }

            const session = await storageManager.loadEditorSession(
              options.document,
              options.session
            );

            if (!session) {
              console.error(`Session not found: ${options.session}`);
              process.exit(1);
            }

            if (options.json) {
              console.log(JSON.stringify(session, null, 2));
            } else {
              console.log('Editor Session Details:');
              console.log(`  Session ID: ${session.sessionId}`);
              console.log(`  User: ${session.userId}`);
              console.log(`  Document: ${session.documentId}`);
              console.log(`  Editor Mode: ${session.editorMode}`);
              console.log(`  Active Section: ${session.activeSectionId || 'None'}`);
              console.log(`  Auto-save: ${session.autoSaveEnabled ? 'Enabled' : 'Disabled'}`);
              console.log(`  Pending Changes: ${session.pendingChangeCount}`);
            }
            break;
          }

          case 'save': {
            if (!options.file) {
              console.error('--file option required for saving session');
              process.exit(1);
            }

            const sessionData = JSON.parse(await fs.readFile(options.file, 'utf-8'));
            await storageManager.saveEditorSession(sessionData);

            console.log(
              options.json
                ? JSON.stringify({ status: 'success', sessionId: sessionData.sessionId })
                : `Editor session saved: ${sessionData.sessionId}`
            );
            break;
          }

          default:
            console.error(`Unknown action: ${options.action}`);
            process.exit(1);
        }
      } catch (error) {
        console.error(
          'Sessions operation failed:',
          error instanceof Error ? error.message : 'Unknown error'
        );
        process.exit(1);
      }
    });

  program.parse(argv);
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cli();
}
