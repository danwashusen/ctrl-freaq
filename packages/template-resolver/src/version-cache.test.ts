import { describe, expect, it } from 'vitest';

import { VersionedTemplateCache } from './version-cache';

describe('VersionedTemplateCache', () => {
  it('returns cached entries when version and schema hash match', () => {
    const cache = new VersionedTemplateCache();
    cache.set({
      templateId: 'architecture',
      version: '1.0.0',
      schemaHash: 'hash-v1',
      sections: [{ id: 'intro' }],
    });

    const hit = cache.get({
      templateId: 'architecture',
      version: '1.0.0',
      schemaHash: 'hash-v1',
    });

    expect(hit).toEqual({
      templateId: 'architecture',
      version: '1.0.0',
      schemaHash: 'hash-v1',
      sections: [{ id: 'intro' }],
    });
    expect(cache.stats().hits).toBe(1);
    expect(cache.stats().misses).toBe(0);
  });

  it('evicts previous version entries when a new version is cached', () => {
    const cache = new VersionedTemplateCache();
    cache.set({
      templateId: 'architecture',
      version: '1.0.0',
      schemaHash: 'hash-v1',
      sections: [{ id: 'intro' }],
    });

    cache.set({
      templateId: 'architecture',
      version: '1.1.0',
      schemaHash: 'hash-v2',
      sections: [{ id: 'intro' }, { id: 'system_overview' }],
    });

    const old = cache.get({
      templateId: 'architecture',
      version: '1.0.0',
      schemaHash: 'hash-v1',
    });
    const current = cache.get({
      templateId: 'architecture',
      version: '1.1.0',
      schemaHash: 'hash-v2',
    });

    expect(old).toBeNull();
    expect(current?.version).toBe('1.1.0');
    expect(cache.stats().entries).toBe(1);
  });

  it('treats schema hash changes as cache misses even if version matches', () => {
    const cache = new VersionedTemplateCache();
    cache.set({
      templateId: 'architecture',
      version: '1.0.0',
      schemaHash: 'hash-v1',
      sections: [{ id: 'intro' }],
    });

    const stale = cache.get({
      templateId: 'architecture',
      version: '1.0.0',
      schemaHash: 'hash-new',
    });

    expect(stale).toBeNull();
    expect(cache.stats().misses).toBe(1);
  });
});
