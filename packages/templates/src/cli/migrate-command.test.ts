import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const migrateDocument = vi.fn();

vi.mock('../publishers/template-publisher', () => ({
  createTemplatePublisher: () => ({
    publishFromFile: vi.fn(),
    activateVersion: vi.fn(),
    migrateDocument,
  }),
}));

const { registerMigrateCommand } = await import('./migrate-command');

describe('templates CLI migrate command', () => {
  beforeEach(() => {
    migrateDocument.mockReset();
  });

  it('executes migration with document and version arguments', async () => {
    const program = new Command();
    program.exitOverride();
    registerMigrateCommand(program);

    await program.parseAsync([
      'node',
      'templates',
      'migrate',
      '--document',
      'doc_123',
      '--template',
      'architecture',
      '--to-version',
      '2.0.0',
    ]);

    expect(migrateDocument).toHaveBeenCalledWith({
      documentId: 'doc_123',
      templateId: 'architecture',
      targetVersion: '2.0.0',
      dryRun: false,
    });
  });

  it('uses dry-run flag to avoid persistence', async () => {
    const program = new Command();
    program.exitOverride();
    registerMigrateCommand(program);

    await program.parseAsync([
      'node',
      'templates',
      'migrate',
      '--document',
      'doc_123',
      '--template',
      'architecture',
      '--to-version',
      '2.0.0',
      '--dry-run',
    ]);

    expect(migrateDocument).toHaveBeenCalledWith({
      documentId: 'doc_123',
      templateId: 'architecture',
      targetVersion: '2.0.0',
      dryRun: true,
    });
  });

  it('requires document id and target version', async () => {
    const program = new Command();
    program.exitOverride();
    registerMigrateCommand(program);

    await expect(program.parseAsync(['node', 'templates', 'migrate'])).rejects.toThrow(/document/i);
  });
});
