/**
 * Template validation utilities
 */

import { z } from 'zod';
import { TemplateMetadataSchema } from '../templates/index.js';

export { createTemplateValidator } from './template-validator.js';

/**
 * Template structure validator
 */
export class TemplateValidator {
  /**
   * Validate complete template structure
   */
  static validateTemplate(template: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate template is an object
    if (typeof template !== 'object' || template === null) {
      errors.push('Template must be an object');
      return { valid: false, errors };
    }

    const templateObj = template as Record<string, unknown>;

    // Check required top-level properties
    if (!templateObj.metadata) {
      errors.push('Template must have a metadata section');
    }

    if (!templateObj.content) {
      errors.push('Template must have a content section');
    }

    // Validate metadata structure
    if (templateObj.metadata) {
      try {
        TemplateMetadataSchema.partial().parse(templateObj.metadata);
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push(...error.issues.map(e => `Metadata ${e.path.join('.')}: ${e.message}`));
        }
      }
    }

    // Validate content is string
    if (templateObj.content && typeof templateObj.content !== 'string') {
      errors.push('Template content must be a string');
    }

    // Validate variables section if present
    if (templateObj.variables && typeof templateObj.variables !== 'object') {
      errors.push('Template variables must be an object');
    }

    // Validate sections if present
    if (templateObj.sections) {
      if (typeof templateObj.sections !== 'object') {
        errors.push('Template sections must be an object');
      } else {
        for (const [key, value] of Object.entries(
          templateObj.sections as Record<string, unknown>
        )) {
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
  static validateVariables(variables: Record<string, unknown>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (const [name, definition] of Object.entries(variables)) {
      // Variable name validation
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        errors.push(
          `Variable name '${name}' is invalid. Must start with letter or underscore and contain only alphanumeric characters and underscores.`
        );
      }

      // Variable definition validation
      if (typeof definition === 'object' && definition !== null) {
        const defObj = definition as Record<string, unknown>;

        if (
          'type' in defObj &&
          defObj.type &&
          !['string', 'number', 'boolean', 'array', 'object'].includes(defObj.type as string)
        ) {
          errors.push(`Variable '${name}' has invalid type '${defObj.type}'`);
        }

        if (
          'required' in defObj &&
          defObj.required !== undefined &&
          typeof defObj.required !== 'boolean'
        ) {
          errors.push(`Variable '${name}' required field must be a boolean`);
        }

        if (
          'default' in defObj &&
          defObj.default !== undefined &&
          'type' in defObj &&
          defObj.type
        ) {
          const defaultType = Array.isArray(defObj.default)
            ? 'array'
            : defObj.default === null
              ? 'null'
              : typeof defObj.default;

          if (
            defObj.type !== defaultType &&
            !(defObj.type === 'object' && defaultType === 'null')
          ) {
            errors.push(
              `Variable '${name}' default value type '${defaultType}' doesn't match declared type '${defObj.type}'`
            );
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate template inheritance
   */
  static validateInheritance(
    template: unknown,
    parentTemplate?: unknown
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate templates are objects
    if (typeof template !== 'object' || template === null) {
      errors.push('Template must be an object');
      return { valid: false, errors };
    }

    const templateObj = template as Record<string, unknown>;
    const templateMetadata = templateObj.metadata as Record<string, unknown> | undefined;

    if (!templateMetadata?.extends) {
      return { valid: true, errors };
    }

    if (!parentTemplate) {
      errors.push(`Parent template '${templateMetadata.extends}' not found`);
      return { valid: false, errors };
    }

    if (typeof parentTemplate !== 'object' || parentTemplate === null) {
      errors.push('Parent template must be an object');
      return { valid: false, errors };
    }

    const parentTemplateObj = parentTemplate as Record<string, unknown>;
    const parentMetadata = parentTemplateObj.metadata as Record<string, unknown> | undefined;

    // Check version compatibility if specified
    if (templateMetadata.parentVersion && parentMetadata?.version) {
      if (templateMetadata.parentVersion !== parentMetadata.version) {
        errors.push(
          `Parent template version mismatch. Expected '${templateMetadata.parentVersion}', found '${parentMetadata.version}'`
        );
      }
    }

    // Validate that child template doesn't override required parent variables
    const parentVariables = parentTemplateObj.variables as Record<string, unknown> | undefined;
    const templateVariables = templateObj.variables as Record<string, unknown> | undefined;

    if (parentVariables && templateVariables) {
      for (const [varName, parentVar] of Object.entries(parentVariables)) {
        if (
          typeof parentVar === 'object' &&
          parentVar !== null &&
          'required' in parentVar &&
          'final' in parentVar &&
          (parentVar as Record<string, unknown>).required &&
          (parentVar as Record<string, unknown>).final
        ) {
          if (varName in templateVariables) {
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
    template: unknown,
    context: Record<string, unknown>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate template is an object
    if (typeof template !== 'object' || template === null) {
      errors.push('Template must be an object');
      return { valid: false, errors };
    }

    const templateObj = template as Record<string, unknown>;
    const templateVariables = templateObj.variables as Record<string, unknown> | undefined;

    if (!templateVariables) {
      return { valid: true, errors };
    }

    // Build a lookup map to avoid dynamic object indexing
    const templateVarMap = new Map<string, unknown>(Object.entries(templateVariables));

    // Check required variables
    for (const [varName, varDef] of templateVarMap.entries()) {
      if (
        typeof varDef === 'object' &&
        varDef !== null &&
        'required' in varDef &&
        (varDef as Record<string, unknown>).required
      ) {
        if (!(varName in context)) {
          errors.push(`Required variable '${varName}' is missing from render context`);
        }
      }
    }

    // Check variable types
    for (const [varName, value] of Object.entries(context)) {
      const varDef = templateVarMap.get(varName);

      if (typeof varDef === 'object' && varDef !== null && 'type' in varDef) {
        const varDefObj = varDef as Record<string, unknown>;
        const expectedType = varDefObj.type;

        const actualType = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;

        if (expectedType !== actualType && !(expectedType === 'object' && actualType === 'null')) {
          errors.push(
            `Variable '${varName}' expected type '${expectedType}' but got '${actualType}'`
          );
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
  default: z.unknown().optional(),
  description: z.string().optional(),
  final: z.boolean().optional(), // Cannot be overridden by child templates
  validation: z
    .object({
      pattern: z.string().optional(),
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      enum: z.array(z.unknown()).optional(),
    })
    .optional(),
});

export const TemplateSchema = z.object({
  metadata: TemplateMetadataSchema,
  content: z.string(),
  variables: z
    .record(
      z.union([
        z.unknown(), // Simple default value
        VariableDefinitionSchema, // Complex variable definition
      ])
    )
    .optional(),
  sections: z.record(z.string()).optional(),
});

export type VariableDefinition = z.infer<typeof VariableDefinitionSchema>;
export type TemplateData = z.infer<typeof TemplateSchema>;
