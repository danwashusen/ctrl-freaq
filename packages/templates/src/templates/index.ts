import { readFile } from 'node:fs/promises';

import { z } from 'zod';

import {
  compileTemplateSource,
  type TemplateCompilationResult,
} from '../compilers/template-compiler.js';

export const TemplateMetadataSchema = z.object({
  id: z.string().min(1, 'Template id is required'),
  name: z.string().min(1, 'Template name is required'),
  version: z.string().min(1, 'Template version is required'),
  documentType: z.string().min(1, 'Document type is required'),
  description: z.string().nullable().optional(),
  changelog: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  extends: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  variables: z.record(z.unknown()).optional(),
});

export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>;

export interface TemplateRecord {
  metadata: TemplateMetadata;
  schemaHash: string;
  schemaJson: unknown;
  sections: TemplateCompilationResult['version']['sections'];
  sourcePath: string;
  source: string;
}

function createMetadata(compilation: TemplateCompilationResult): TemplateMetadata {
  return TemplateMetadataSchema.parse({
    id: compilation.catalog.id,
    name: compilation.catalog.name,
    version: compilation.version.version,
    documentType: compilation.catalog.documentType,
    description: compilation.catalog.description ?? null,
    changelog: compilation.version.changelog ?? null,
    author: null,
    extends: null,
    tags: [],
    variables: undefined,
  });
}

function cacheKey(templateId: string, version: string): string {
  return `${templateId}@${version}`;
}

export type Template = TemplateRecord;

export class TemplateEngine {
  private readonly cache = new Map<string, TemplateRecord>();

  async loadTemplate(source: string, sourceKey?: string): Promise<TemplateRecord> {
    const compilation = await compileTemplateSource({
      source,
      sourcePath: sourceKey ?? '<inline>',
    });

    const record: TemplateRecord = {
      metadata: createMetadata(compilation),
      schemaHash: compilation.version.schemaHash,
      schemaJson: compilation.version.schemaJson,
      sections: compilation.version.sections,
      sourcePath: compilation.version.sourcePath,
      source,
    };

    this.cache.set(cacheKey(record.metadata.id, record.metadata.version), record);
    return record;
  }

  async loadTemplateFromFile(filePath: string): Promise<TemplateRecord> {
    const source = await readFile(filePath, 'utf-8');
    return this.loadTemplate(source, filePath);
  }

  getTemplate(templateId: string, version: string): TemplateRecord | undefined {
    return this.cache.get(cacheKey(templateId, version));
  }

  listTemplates(): TemplateRecord[] {
    return Array.from(this.cache.values());
  }

  clear(): void {
    this.cache.clear();
  }

  render(): never {
    throw new Error('Template rendering is no longer supported. Use compileTemplateSource instead.');
  }
}

export const templateEngine = new TemplateEngine();
