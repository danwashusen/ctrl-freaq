/**
 * @ctrl-freaq/exporter - Document export library
 * 
 * This package provides document export capabilities for CTRL FreaQ
 * supporting multiple formats including PDF, HTML, DOCX, Markdown,
 * and EPUB with customizable templates.
 */

// Core export functionality exports
export * from './formats/index.js';
export * from './exporters/index.js';

// CLI export
export { cli } from './cli.js';

// Core types and interfaces
export interface ExportFormat {
  name: string;
  extension: string;
  mimeType: string;
  description: string;
}

export interface ExportTemplate {
  name: string;
  format: string;
  description: string;
  path: string;
  variables?: Record<string, any>;
}

export interface ExportOptions {
  format: string;
  template?: string;
  output?: string;
  variables?: Record<string, any>;
  includeMetadata?: boolean;
  compress?: boolean;
}

export interface ExportResult {
  success: boolean;
  outputPath: string;
  format: string;
  size: number;
  pageCount?: number;
  warnings: string[];
  errors: string[];
}

export interface DocumentContent {
  title: string;
  content: string;
  metadata?: Record<string, any>;
  assets?: Asset[];
}

export interface Asset {
  type: 'image' | 'font' | 'stylesheet' | 'script';
  path: string;
  data?: Buffer;
  mimeType?: string;
}

// Placeholder implementation classes
export class DocumentExporter {
  private formats: Map<string, ExportFormat> = new Map();
  private templates: Map<string, ExportTemplate> = new Map();

  registerFormat(format: ExportFormat): void {
    this.formats.set(format.name, format);
  }

  registerTemplate(template: ExportTemplate): void {
    this.templates.set(`${template.format}:${template.name}`, template);
  }

  async export(_content: DocumentContent, options: ExportOptions): Promise<ExportResult> {
    // Placeholder implementation
    return {
      success: true,
      outputPath: options.output || `export.${options.format}`,
      format: options.format,
      size: 0,
      pageCount: 1,
      warnings: ['Export functionality not yet implemented'],
      errors: []
    };
  }

  getSupportedFormats(): string[] {
    return Array.from(this.formats.keys());
  }

  getTemplatesForFormat(format: string): ExportTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.format === format);
  }
}

export class FormatRegistry {
  private static formats = new Map<string, ExportFormat>();

  static register(format: ExportFormat): void {
    this.formats.set(format.name, format);
  }

  static get(name: string): ExportFormat | undefined {
    return this.formats.get(name);
  }

  static list(): ExportFormat[] {
    return Array.from(this.formats.values());
  }
}

export class TemplateRegistry {
  private static templates = new Map<string, ExportTemplate>();

  static register(template: ExportTemplate): void {
    this.templates.set(`${template.format}:${template.name}`, template);
  }

  static get(format: string, name: string): ExportTemplate | undefined {
    return this.templates.get(`${format}:${name}`);
  }

  static listForFormat(format: string): ExportTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.format === format);
  }
}

// Package metadata
export const packageInfo = {
  name: '@ctrl-freaq/exporter',
  version: '0.1.0',
  description: 'Document export library for CTRL FreaQ supporting multiple formats'
};
