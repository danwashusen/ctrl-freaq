import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const activateVersion = vi.fn();

vi.mock('../publishers/template-publisher', () => ({
  createTemplatePublisher: () => ({
    publishFromFile: vi.fn(),
    activateVersion,
    migrateDocument: vi.fn(),
  }),
}));

const { registerActivateCommand } = await import('./activate-command');

describe('templates CLI activate command', () => {
  beforeEach(() => {
    activateVersion.mockReset();
  });

  it('activates template version with required args', async () => {
    const program = new Command();
    program.exitOverride();
    registerActivateCommand(program);

    await program.parseAsync([
      'node',
      'templates',
      'activate',
      '--template',
      'architecture',
      '--version',
      '1.2.0',
    ]);

    expect(activateVersion).toHaveBeenCalledWith({
      templateId: 'architecture',
      version: '1.2.0',
    });
  });

  it('requires template and version flags', async () => {
    const program = new Command();
    program.exitOverride();
    registerActivateCommand(program);

    await expect(program.parseAsync(['node', 'templates', 'activate'])).rejects.toThrow(
      /template/i
    );
  });
});
