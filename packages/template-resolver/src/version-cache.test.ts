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

  it('bounds entries per template while retaining the most recent versions', () => {
    const cache = new VersionedTemplateCache();

    for (let index = 0; index < 12; index += 1) {
      const version = `1.${index}.0`;
      cache.set({
        templateId: 'architecture',
        version,
        schemaHash: `hash-${version}`,
        sections: [{ id: 'section', version }],
      });
    }

    const hits = cache.get({
      templateId: 'architecture',
      version: '1.11.0',
      schemaHash: 'hash-1.11.0',
    });

    const pruned = cache.get({
      templateId: 'architecture',
      version: '1.0.0',
      schemaHash: 'hash-1.0.0',
    });

    expect(hits).not.toBeNull();
    expect(pruned).toBeNull();
    expect(cache.stats().entries).toBeLessThanOrEqual(10);
  });

  it('returns cache hits when alternating between versions of the same template', () => {
    const cache = new VersionedTemplateCache();

    cache.set({
      templateId: 'architecture',
      version: '1.0.0',
      schemaHash: 'hash-v1',
      sections: [{ id: 'intro' }],
    });

    expect(
      cache.get({ templateId: 'architecture', version: '1.0.0', schemaHash: 'hash-v1' })
    ).not.toBeNull();

    cache.set({
      templateId: 'architecture',
      version: '1.1.0',
      schemaHash: 'hash-v2',
      sections: [{ id: 'intro' }, { id: 'overview' }],
    });

    expect(
      cache.get({ templateId: 'architecture', version: '1.1.0', schemaHash: 'hash-v2' })
    ).not.toBeNull();

    const previous = cache.get({
      templateId: 'architecture',
      version: '1.0.0',
      schemaHash: 'hash-v1',
    });

    expect(previous).not.toBeNull();
    expect(cache.stats().hits).toBeGreaterThanOrEqual(2);
    expect(cache.stats().entries).toBeGreaterThanOrEqual(2);
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
