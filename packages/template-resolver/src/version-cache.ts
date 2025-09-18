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

const MAX_ENTRIES_PER_TEMPLATE = 10;

function entryKey(version: string, schemaHash: string): string {
  return `${version}::${schemaHash}`;
}

export class VersionedTemplateCache {
  private readonly entries = new Map<string, Map<string, VersionedTemplateCacheEntry>>();
  private hits = 0;
  private misses = 0;

  set(entry: VersionedTemplateCacheEntry): void {
    const key = entryKey(entry.version, entry.schemaHash);
    const templateEntries = this.entries.get(entry.templateId) ?? new Map();

    if (templateEntries.has(key)) {
      templateEntries.delete(key);
    }

    templateEntries.set(key, entry);

    if (templateEntries.size > MAX_ENTRIES_PER_TEMPLATE) {
      const oldestKey = templateEntries.keys().next().value;
      if (oldestKey) {
        templateEntries.delete(oldestKey);
      }
    }

    this.entries.set(entry.templateId, templateEntries);
  }

  get(key: VersionedTemplateCacheKey): VersionedTemplateCacheEntry | null {
    const templateEntries = this.entries.get(key.templateId);
    if (!templateEntries) {
      this.misses += 1;
      return null;
    }

    const lookupKey = entryKey(key.version, key.schemaHash);
    const existing = templateEntries.get(lookupKey);
    if (!existing) {
      this.misses += 1;
      return null;
    }

    templateEntries.delete(lookupKey);
    templateEntries.set(lookupKey, existing);
    this.hits += 1;
    return existing;
  }

  stats(): VersionedTemplateCacheStats {
    let totalEntries = 0;
    for (const templateEntries of this.entries.values()) {
      totalEntries += templateEntries.size;
    }

    return {
      hits: this.hits,
      misses: this.misses,
      entries: totalEntries,
    };
  }

  clear(): void {
    this.entries.clear();
    this.hits = 0;
    this.misses = 0;
  }
}
