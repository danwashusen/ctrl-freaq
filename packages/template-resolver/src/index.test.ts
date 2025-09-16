import { describe, expect, it, vi } from 'vitest';

import {
  createTemplateResolver,
  type TemplateResolverHooks,
  type TemplateVersionRecord,
} from './index.js';

function createRecord(overrides: Partial<TemplateVersionRecord> = {}): TemplateVersionRecord {
  return {
    templateId: 'architecture',
    version: '1.0.0',
    schemaHash: 'hash-v1',
    sections: [{ id: 'introduction' }],
    schema: { type: 'object' },
    validator: {
      parse: vi.fn(),
      safeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
    },
    ...overrides,
  } satisfies TemplateVersionRecord;
}

describe('TemplateResolver', () => {
  it('uses schema-aware cache before hitting the loader again', async () => {
    const loadVersion = vi.fn().mockResolvedValue(createRecord());
    const resolver = createTemplateResolver({
      dependencies: {
        loadVersion: async () => loadVersion(),
      },
    });

    const first = await resolver.resolve({
      templateId: 'architecture',
      version: '1.0.0',
      schemaHash: 'hash-v1',
    });

    const second = await resolver.resolve({
      templateId: 'architecture',
      version: '1.0.0',
      schemaHash: 'hash-v1',
    });

    expect(first?.cacheHit).toBe(false);
    expect(second?.cacheHit).toBe(true);
    expect(loadVersion).toHaveBeenCalledTimes(1);
  });

  it('expires cache entries when schema hash changes', async () => {
    const loadVersion = vi
      .fn<[], Promise<TemplateVersionRecord | null>>()
      .mockImplementation(async () => {
        return loadVersion.mock.calls.length === 1
          ? createRecord({ version: '1.0.0', schemaHash: 'hash-v1' })
          : createRecord({ version: '1.1.0', schemaHash: 'hash-v2' });
      });

    const resolver = createTemplateResolver({
      dependencies: {
        loadVersion: async () => loadVersion(),
      },
    });

    await resolver.resolve({ templateId: 'architecture', version: '1.0.0', schemaHash: 'hash-v1' });
    await resolver.resolve({ templateId: 'architecture', version: '1.1.0', schemaHash: 'hash-v2' });

    expect(loadVersion).toHaveBeenCalledTimes(2);
  });

  it('invokes hooks for cache hits and misses', async () => {
    const hooks: TemplateResolverHooks = {
      onCacheHit: vi.fn(),
      onCacheMiss: vi.fn(),
      onResolved: vi.fn(),
    };

    const resolver = createTemplateResolver({
      dependencies: {
        loadVersion: async () => createRecord(),
      },
      hooks,
    });

    await resolver.resolve({ templateId: 'architecture', version: '1.0.0', schemaHash: 'hash-v1' });
    await resolver.resolve({ templateId: 'architecture', version: '1.0.0', schemaHash: 'hash-v1' });

    expect(hooks.onCacheMiss).toHaveBeenCalledTimes(1);
    expect(hooks.onCacheHit).toHaveBeenCalledTimes(1);
    expect(hooks.onResolved).toHaveBeenCalledTimes(2);
  });

  it('returns null when loader cannot resolve a template version', async () => {
    const resolver = createTemplateResolver({
      dependencies: {
        loadVersion: async () => null,
      },
    });

    const result = await resolver.resolve({
      templateId: 'missing',
      version: '1.0.0',
      schemaHash: 'hash-none',
    });

    expect(result).toBeNull();
  });
});
