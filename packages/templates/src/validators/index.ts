/**
 * Template validation utilities
 */

import { z } from 'zod';
import { TemplateMetadataSchema } from '../templates/index.js';

/**
 * Template structure validator
 */
export class TemplateValidator {
  /**
   * Validate complete template structure
   */
  static validateTemplate(template: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required top-level properties
    if (!template.metadata) {
      errors.push('Template must have a metadata section');
    }

    if (!template.content) {
      errors.push('Template must have a content section');
    }

    // Validate metadata structure
    if (template.metadata) {
      try {
        TemplateMetadataSchema.parse(template.metadata);
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push(...error.errors.map(e => `Metadata ${e.path.join('.')}: ${e.message}`));
        }
      }
    }

    // Validate content is string
    if (template.content && typeof template.content !== 'string') {
      errors.push('Template content must be a string');
    }

    // Validate variables section if present
    if (template.variables && typeof template.variables !== 'object') {
      errors.push('Template variables must be an object');
    }

    // Validate sections if present
    if (template.sections) {
      if (typeof template.sections !== 'object') {
        errors.push('Template sections must be an object');
      } else {
        for (const [key, value] of Object.entries(template.sections)) {
          if (typeof value !== 'string') {
            errors.push(`Section '${key}' must be a string`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate variable definitions
   */
  static validateVariables(variables: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [name, definition] of Object.entries(variables)) {
      // Variable name validation
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        errors.push(`Variable name '${name}' is invalid. Must start with letter or underscore and contain only alphanumeric characters and underscores.`);
      }

      // Variable definition validation
      if (typeof definition === 'object' && definition !== null) {
        if (definition.type && !['string', 'number', 'boolean', 'array', 'object'].includes(definition.type)) {
          errors.push(`Variable '${name}' has invalid type '${definition.type}'`);
        }

        if (definition.required !== undefined && typeof definition.required !== 'boolean') {
          errors.push(`Variable '${name}' required field must be a boolean`);
        }

        if (definition.default !== undefined && definition.type) {
          const defaultType = Array.isArray(definition.default) ? 'array' :
                             definition.default === null ? 'null' :
                             typeof definition.default;

          if (definition.type !== defaultType && !(definition.type === 'object' && defaultType === 'null')) {
            errors.push(`Variable '${name}' default value type '${defaultType}' doesn't match declared type '${definition.type}'`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate template inheritance
   */
  static validateInheritance(template: any, parentTemplate?: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!template.metadata?.extends) {
      return { valid: true, errors };
    }

    if (!parentTemplate) {
      errors.push(`Parent template '${template.metadata.extends}' not found`);
      return { valid: false, errors };
    }

    // Check version compatibility if specified
    if (template.metadata.parentVersion && parentTemplate.metadata.version) {
      if (template.metadata.parentVersion !== parentTemplate.metadata.version) {
        errors.push(`Parent template version mismatch. Expected '${template.metadata.parentVersion}', found '${parentTemplate.metadata.version}'`);
      }
    }

    // Validate that child template doesn't override required parent variables
    if (parentTemplate.variables && template.variables) {
      for (const [varName, parentVar] of Object.entries(parentTemplate.variables)) {
        if (typeof parentVar === 'object' && parentVar !== null &&
            'required' in parentVar && 'final' in parentVar &&
            parentVar.required && parentVar.final) {
          if (varName in template.variables) {
            errors.push(`Cannot override final variable '${varName}' from parent template`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate template rendering context
   */
  static validateRenderContext(
    template: any,
    context: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!template.variables) {
      return { valid: true, errors };
    }

    // Check required variables
    for (const [varName, varDef] of Object.entries(template.variables)) {
      if (typeof varDef === 'object' && varDef !== null && 'required' in varDef && varDef.required) {
        if (!(varName in context)) {
          errors.push(`Required variable '${varName}' is missing from render context`);
        }
      }
    }

    // Check variable types
    for (const [varName, value] of Object.entries(context)) {
      const varDef = template.variables[varName];

      if (typeof varDef === 'object' && varDef?.type) {
        const actualType = Array.isArray(value) ? 'array' :
                          value === null ? 'null' :
                          typeof value;

        if (varDef.type !== actualType && !(varDef.type === 'object' && actualType === 'null')) {
          errors.push(`Variable '${varName}' expected type '${varDef.type}' but got '${actualType}'`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

/**
 * Schema definitions for template validation
 */
export const VariableDefinitionSchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']).optional(),
  required: z.boolean().optional(),
  default: z.any().optional(),
  description: z.string().optional(),
  final: z.boolean().optional(), // Cannot be overridden by child templates
  validation: z.object({
    pattern: z.string().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    enum: z.array(z.any()).optional()
  }).optional()
});

export const TemplateSchema = z.object({
  metadata: TemplateMetadataSchema,
  content: z.string(),
  variables: z.record(z.union([
    z.any(), // Simple default value
    VariableDefinitionSchema // Complex variable definition
  ])).optional(),
  sections: z.record(z.string()).optional()
});

export type VariableDefinition = z.infer<typeof VariableDefinitionSchema>;
export type TemplateSchema = z.infer<typeof TemplateSchema>;