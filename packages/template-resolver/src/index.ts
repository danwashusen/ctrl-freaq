/**
 * @ctrl-freaq/template-resolver - Template resolution utilities with
 * version-aware caching and upgrade helpers.
 */

import {
  VersionedTemplateCache,
  type VersionedTemplateCacheEntry,
  type VersionedTemplateCacheStats,
} from './version-cache.js';

export interface TemplateValidator {
  parse(input: unknown): unknown;
  safeParse?(input: unknown): { success: boolean; data?: unknown; error?: unknown };
}

export interface TemplateVersionRecord {
  templateId: string;
  version: string;
  schemaHash: string;
  sections: unknown;
  schema?: unknown;
  validator?: TemplateValidator;
  metadata?: Record<string, unknown>;
}

export interface TemplateResolverDependencies {
  loadVersion(templateId: string, version: string): Promise<TemplateVersionRecord | null>;
  loadActiveVersion?(templateId: string): Promise<TemplateVersionRecord | null>;
}

export interface TemplateResolverEvent {
  templateId: string;
  version: string;
  schemaHash?: string;
}

export type TemplateResolutionSource = 'cache' | 'loader' | 'active';

export interface TemplateResolvedEvent extends TemplateResolverEvent {
  source: TemplateResolutionSource;
  template: TemplateVersionRecord;
}

export interface TemplateResolverErrorEvent extends TemplateResolverEvent {
  error: unknown;
}

export interface TemplateResolverHooks {
  onCacheHit?(event: TemplateResolverEvent): void;
  onCacheMiss?(event: TemplateResolverEvent): void;
  onResolved?(event: TemplateResolvedEvent): void;
  onError?(event: TemplateResolverErrorEvent): void;
}

export interface ResolveTemplateOptions {
  templateId: string;
  version: string;
  schemaHash?: string;
  bypassCache?: boolean;
}

export interface TemplateResolverResult {
  cacheHit: boolean;
  template: TemplateVersionRecord;
}

export interface TemplateResolverConfig {
  dependencies: TemplateResolverDependencies;
  cache?: VersionedTemplateCache;
  hooks?: TemplateResolverHooks;
}

export interface TemplateResolver {
  resolve(options: ResolveTemplateOptions): Promise<TemplateResolverResult | null>;
  resolveActiveVersion(templateId: string): Promise<TemplateResolverResult | null>;
  clearCache(): void;
  getCacheStats(): VersionedTemplateCacheStats;
}

interface CachedTemplateVersion {
  cacheEntry: VersionedTemplateCacheEntry;
  record: TemplateVersionRecord;
}

class DefaultTemplateResolver implements TemplateResolver {
  private readonly dependencies: TemplateResolverDependencies;
  private readonly hooks: TemplateResolverHooks;
  private cache: VersionedTemplateCache;
  private readonly mirror = new Map<string, CachedTemplateVersion>();

  constructor({ dependencies, cache, hooks }: TemplateResolverConfig) {
    this.dependencies = dependencies;
    this.cache = cache ?? new VersionedTemplateCache();
    this.hooks = hooks ?? {};
  }

  async resolve(options: ResolveTemplateOptions): Promise<TemplateResolverResult | null> {
    const { templateId, version, schemaHash, bypassCache } = options;
    const cached = this.mirror.get(templateId);
    const expectedHash = schemaHash ?? cached?.cacheEntry.schemaHash;

    if (!bypassCache && cached) {
      const hit = this.cache.get({
        templateId,
        version,
        schemaHash: expectedHash ?? cached.cacheEntry.schemaHash,
      });

      if (hit) {
        this.emitCacheHit(hit);
        this.emitResolved('cache', cached.record);
        return { cacheHit: true, template: cached.record };
      }
    }

    this.emitCacheMiss({ templateId, version, schemaHash: expectedHash });

    let loaded: TemplateVersionRecord | null;
    try {
      loaded = await this.dependencies.loadVersion(templateId, version);
    } catch (error) {
      this.emitError({ templateId, version, schemaHash: expectedHash, error });
      throw error;
    }

    if (!loaded) {
      this.mirror.delete(templateId);
      return null;
    }

    if (loaded.templateId !== templateId) {
      const error = new Error(
        `Resolved template id mismatch: expected ${templateId}, received ${loaded.templateId}`
      );
      this.emitError({ templateId, version, schemaHash: loaded.schemaHash, error });
      throw error;
    }

    this.track(loaded);
    this.emitResolved('loader', loaded);
    return { cacheHit: false, template: loaded };
  }

  async resolveActiveVersion(templateId: string): Promise<TemplateResolverResult | null> {
    if (!this.dependencies.loadActiveVersion) {
      throw new Error('Template resolver is not configured with loadActiveVersion');
    }

    let active: TemplateVersionRecord | null;
    try {
      active = await this.dependencies.loadActiveVersion(templateId);
    } catch (error) {
      this.emitError({ templateId, version: 'active', error });
      throw error;
    }

    if (!active) {
      this.mirror.delete(templateId);
      return null;
    }

    const cached = this.mirror.get(templateId);
    if (cached) {
      const hit = this.cache.get({
        templateId,
        version: active.version,
        schemaHash: active.schemaHash,
      });
      if (hit) {
        this.emitCacheHit(hit);
        this.emitResolved('cache', cached.record);
        return { cacheHit: true, template: cached.record };
      }
    }

    this.emitCacheMiss({
      templateId,
      version: active.version,
      schemaHash: active.schemaHash,
    });

    this.track(active);
    this.emitResolved('active', active);
    return { cacheHit: false, template: active };
  }

  clearCache(): void {
    this.cache.clear();
    this.mirror.clear();
  }

  getCacheStats(): VersionedTemplateCacheStats {
    return this.cache.stats();
  }

  private track(record: TemplateVersionRecord): void {
    const cacheEntry: VersionedTemplateCacheEntry = {
      templateId: record.templateId,
      version: record.version,
      schemaHash: record.schemaHash,
      sections: record.sections,
    };
    this.cache.set(cacheEntry);
    this.mirror.set(record.templateId, { cacheEntry, record });
  }

  private emitCacheHit(entry: VersionedTemplateCacheEntry): void {
    this.hooks.onCacheHit?.({
      templateId: entry.templateId,
      version: entry.version,
      schemaHash: entry.schemaHash,
    });
  }

  private emitCacheMiss(event: TemplateResolverEvent): void {
    this.hooks.onCacheMiss?.(event);
  }

  private emitResolved(source: TemplateResolutionSource, record: TemplateVersionRecord): void {
    this.hooks.onResolved?.({
      templateId: record.templateId,
      version: record.version,
      schemaHash: record.schemaHash,
      source,
      template: record,
    });
  }

  private emitError(event: TemplateResolverErrorEvent): void {
    this.hooks.onError?.(event);
  }
}

export function createTemplateResolver(config: TemplateResolverConfig): TemplateResolver {
  return new DefaultTemplateResolver(config);
}

export { VersionedTemplateCache };
export type { VersionedTemplateCacheStats } from './version-cache.js';
export * from './auto-upgrade.js';

export const packageInfo = {
  name: '@ctrl-freaq/template-resolver',
  version: '0.1.0',
  description: 'Template resolution and dependency management library for CTRL FreaQ',
};
