import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

const loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock('../../src/lib/logger', () => ({
  logger: loggerMock,
}));

const { TemplateUpgradeBanner } = await import('../../src/components/editor/TemplateUpgradeBanner');

describe('TemplateUpgradeBanner', () => {
  test('renders success banner and logs upgrade metadata', () => {
    render(
      <TemplateUpgradeBanner
        migration={{
          status: 'succeeded',
          fromVersion: '1.0.0',
          toVersion: '1.1.0',
          templateId: 'architecture',
          completedAt: new Date('2025-09-16T12:00:00Z').toISOString(),
        }}
      />
    );

    expect(screen.getByText(/Document upgraded/i)).toBeInTheDocument();
    expect(screen.getByText(/1.1.0/)).toBeInTheDocument();
    expect(loggerMock.info).toHaveBeenCalledWith('document.template.upgraded', {
      templateId: 'architecture',
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      completedAt: '2025-09-16T12:00:00.000Z',
    });
  });

  test('renders blocking banner when a version is removed and logs warning', () => {
    render(
      <TemplateUpgradeBanner
        migration={null}
        removedVersion={{
          templateId: 'architecture',
          version: '2.0.0',
          message: 'Template version unavailable. Contact your template manager.',
        }}
      />
    );

    expect(screen.getByText(/Template version 2.0.0 is no longer available/i)).toBeInTheDocument();
    expect(loggerMock.warn).toHaveBeenCalledWith('document.template.version_removed', {
      templateId: 'architecture',
      missingVersion: '2.0.0',
    });
  });
});
