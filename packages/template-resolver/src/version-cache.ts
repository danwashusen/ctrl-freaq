export interface VersionedTemplateCacheEntry {
  templateId: string;
  version: string;
  schemaHash: string;
  sections: unknown;
}

export interface VersionedTemplateCacheKey {
  templateId: string;
  version: string;
  schemaHash: string;
}

export interface VersionedTemplateCacheStats {
  hits: number;
  misses: number;
  entries: number;
}

export class VersionedTemplateCache {
  private readonly entries = new Map<string, VersionedTemplateCacheEntry>();
  private hits = 0;
  private misses = 0;

  set(entry: VersionedTemplateCacheEntry): void {
    this.entries.set(entry.templateId, entry);
  }

  get(key: VersionedTemplateCacheKey): VersionedTemplateCacheEntry | null {
    const existing = this.entries.get(key.templateId);
    if (!existing) {
      this.misses += 1;
      return null;
    }

    if (existing.version === key.version && existing.schemaHash === key.schemaHash) {
      this.hits += 1;
      return existing;
    }

    this.misses += 1;
    return null;
  }

  stats(): VersionedTemplateCacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      entries: this.entries.size,
    };
  }
}
