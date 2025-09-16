import { Command } from 'commander';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const publishFromFile = vi.fn();

vi.mock('../publishers/template-publisher', () => ({
  createTemplatePublisher: () => ({
    publishFromFile,
    activateVersion: vi.fn(),
    migrateDocument: vi.fn(),
  }),
}));

const { registerPublishCommand } = await import('./publish-command');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturePath = resolve(__dirname, '../../tests/fixtures/architecture.valid.yaml');

describe('templates CLI publish command', () => {
  beforeEach(() => {
    publishFromFile.mockReset();
  });

  it('invokes publisher with file, version, changelog, and activate flag', async () => {
    const program = new Command();
    program.exitOverride();
    registerPublishCommand(program);

    await program.parseAsync([
      'node',
      'templates',
      'publish',
      '--file',
      fixturePath,
      '--version',
      '1.0.0',
      '--changelog',
      'Initial release',
      '--activate',
    ]);

    expect(publishFromFile).toHaveBeenCalledWith({
      file: fixturePath,
      version: '1.0.0',
      changelog: 'Initial release',
      activate: true,
    });
  });

  it('requires both file and version options', async () => {
    const program = new Command();
    program.exitOverride();
    registerPublishCommand(program);

    await expect(
      program.parseAsync(['node', 'templates', 'publish', '--file', fixturePath])
    ).rejects.toThrow(/version/i);
  });
});
