import { describe, expect, it } from 'vitest';

import { TemplateValidator } from './index';

describe('TemplateValidator.validateTemplate', () => {
  it('returns metadata validation issues as human-readable strings', () => {
    const result = TemplateValidator.validateTemplate({
      metadata: {
        id: '',
        name: '',
        version: '',
        documentType: '',
      },
      content: 'Example content',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Metadata id: Template id is required'),
        expect.stringContaining('Metadata name: Template name is required'),
        expect.stringContaining('Metadata version: Template version is required'),
        expect.stringContaining('Metadata documentType: Document type is required'),
      ])
    );
  });
});
