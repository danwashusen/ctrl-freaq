import { describe, expect, it } from 'vitest';

import {
  evaluateTemplateUpgrade,
  type DocumentTemplateBinding,
  type TemplateVersionSummary,
} from './auto-upgrade.js';

const binding: DocumentTemplateBinding = {
  templateId: 'architecture',
  version: '1.0.0',
  schemaHash: 'hash-v1',
};

const summaries: TemplateVersionSummary[] = [
  { templateId: 'architecture', version: '1.0.0', schemaHash: 'hash-v1', status: 'active' },
  { templateId: 'architecture', version: '0.9.0', schemaHash: 'hash-legacy', status: 'deprecated' },
];

describe('evaluateTemplateUpgrade', () => {
  it('returns noop when the binding matches the active version and schema hash', () => {
    const result = evaluateTemplateUpgrade({
      binding,
      availableVersions: summaries,
      activeVersion: summaries[0],
    });

    expect(result).toEqual({
      action: 'noop',
      reason: 'up_to_date',
      currentVersion: summaries[0],
    });
  });

  it('requests auto-upgrade when active version differs', () => {
    const active: TemplateVersionSummary = {
      templateId: 'architecture',
      version: '1.1.0',
      schemaHash: 'hash-v2',
      status: 'active',
    };

    const result = evaluateTemplateUpgrade({
      binding,
      availableVersions: [summaries[0], active, ...summaries.slice(1)],
      activeVersion: active,
    });

    expect(result).toEqual({
      action: 'upgrade',
      reason: 'out_of_date',
      currentVersion: summaries[0],
      targetVersion: active,
    });
  });

  it('blocks editing when the bound version was removed', () => {
    const result = evaluateTemplateUpgrade({
      binding: { ...binding, version: '9.9.9' },
      availableVersions: summaries,
      activeVersion: summaries[0],
    });

    expect(result).toEqual({
      action: 'blocked',
      reason: 'removed_version',
      requestedVersion: { ...binding, version: '9.9.9' },
    });
  });

  it('requests upgrade when schema hash differs even if version matches', () => {
    const result = evaluateTemplateUpgrade({
      binding: { ...binding, schemaHash: 'old-hash' },
      availableVersions: summaries,
      activeVersion: summaries[0],
    });

    expect(result).toEqual({
      action: 'upgrade',
      reason: 'schema_mismatch',
      currentVersion: summaries[0],
      targetVersion: summaries[0],
    });
  });
});
