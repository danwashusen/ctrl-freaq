/**
 * Template engine core functionality
 */

import * as YAML from 'yaml';
import Mustache from 'mustache';
import { z } from 'zod';

/**
 * Template metadata schema
 */
export const TemplateMetadataSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  extends: z.string().optional(),
  variables: z.record(z.unknown()).optional(),
  sections: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>;

/**
 * Template definition
 */
export interface Template {
  metadata: TemplateMetadata;
  content: string;
  variables: Record<string, unknown>;
  sections: Record<string, string>;
}

/**
 * Template rendering context
 */
export interface RenderContext {
  variables: Record<string, unknown>;
  partials?: Record<string, string>;
  functions?: Record<string, (...args: unknown[]) => unknown>;
}

/**
 * Main template engine class
 */
export class TemplateEngine {
  private templates = new Map<string, Template>();
  private partials = new Map<string, string>();

  /**
   * Load template from YAML content
   */
  loadTemplate(content: string, templateName?: string): Template {
    try {
      const parsed = YAML.parse(content);

      if (!parsed.metadata || !parsed.content) {
        throw new Error('Template must have metadata and content sections');
      }

      // Validate metadata
      const metadata = TemplateMetadataSchema.parse(parsed.metadata);

      const template: Template = {
        metadata,
        content: parsed.content,
        variables: parsed.variables || {},
        sections: parsed.sections || {},
      };

      // Register template if name provided
      if (templateName || metadata.name) {
        this.templates.set(templateName || metadata.name, template);
      }

      return template;
    } catch (error) {
      throw new Error(`Failed to load template: ${error}`);
    }
  }

  /**
   * Load template from file
   */
  async loadTemplateFromFile(filePath: string): Promise<Template> {
    const fs = await import('fs');
    const path = await import('path');

    const content = fs.readFileSync(filePath, 'utf-8');
    const templateName = path.basename(filePath, path.extname(filePath));

    return this.loadTemplate(content, templateName);
  }

  /**
   * Register partial template
   */
  registerPartial(name: string, content: string): void {
    this.partials.set(name, content);
  }

  /**
   * Get registered template
   */
  getTemplate(name: string): Template | undefined {
    return this.templates.get(name);
  }

  /**
   * Render template with context
   */
  render(templateNameOrContent: string, context: RenderContext = { variables: {} }): string {
    let template: Template;

    // Check if it's a template name or direct content
    if (this.templates.has(templateNameOrContent)) {
      const foundTemplate = this.templates.get(templateNameOrContent);
      if (!foundTemplate) {
        throw new Error(`Template '${templateNameOrContent}' not found`);
      }
      template = foundTemplate;
    } else {
      // Treat as direct YAML content
      template = this.loadTemplate(templateNameOrContent);
    }

    // Merge template variables with context variables
    const mergedVariables = {
      ...template.variables,
      ...context.variables,
    };

    // Prepare partials for Mustache
    const partials = {
      ...Object.fromEntries(this.partials.entries()),
      ...template.sections,
      ...context.partials,
    };

    // Add helper functions to variables
    const renderContext = {
      ...mergedVariables,
      ...context.functions,
    };

    try {
      // Render main content
      const rendered = Mustache.render(template.content, renderContext, partials);

      return rendered;
    } catch (error) {
      throw new Error(`Template rendering failed: ${error}`);
    }
  }

  /**
   * Validate template variables against schema
   */
  validateContext(
    templateName: string,
    context: Record<string, unknown>
  ): { valid: boolean; errors: string[] } {
    const template = this.getTemplate(templateName);
    if (!template) {
      return { valid: false, errors: [`Template '${templateName}' not found`] };
    }

    const errors: string[] = [];

    // Basic validation - would be enhanced with proper schema validation
    for (const [key, value] of Object.entries(template.variables)) {
      if (
        typeof value === 'object' &&
        value !== null &&
        'required' in value &&
        (value as Record<string, unknown>).required &&
        !(key in context)
      ) {
        errors.push(`Required variable '${key}' is missing`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * List all registered templates
   */
  listTemplates(): TemplateMetadata[] {
    return Array.from(this.templates.values()).map(t => t.metadata);
  }

  /**
   * Clear all templates and partials
   */
  clear(): void {
    this.templates.clear();
    this.partials.clear();
  }
}

/**
 * Default template engine instance
 */
export const templateEngine = new TemplateEngine();
