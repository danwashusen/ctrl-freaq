/**
 * YAML and template parsers
 */

import * as YAML from 'yaml';
import { z } from 'zod';

/**
 * YAML parsing utilities
 */
export class YAMLParser {
  /**
   * Parse YAML with error handling
   */
  static parse<T = unknown>(content: string): T {
    try {
      return YAML.parse(content);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`YAML parsing failed: ${error.message}`);
      }
      throw new Error('YAML parsing failed with unknown error');
    }
  }

  /**
   * Stringify object to YAML
   */
  static stringify(obj: unknown, options?: YAML.ToStringOptions): string {
    try {
      return YAML.stringify(obj, options);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`YAML stringification failed: ${error.message}`);
      }
      throw new Error('YAML stringification failed with unknown error');
    }
  }

  /**
   * Validate YAML against schema
   */
  static validate<T>(
    content: string,
    schema: z.ZodSchema<T>
  ): { valid: boolean; data?: T; errors?: string[] } {
    try {
      const parsed = this.parse(content);
      const data = schema.parse(parsed);
      return { valid: true, data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        };
      }
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error'],
      };
    }
  }
}

/**
 * Template variable parser
 */
export class VariableParser {
  private static readonly VARIABLE_PATTERN = /\{\{[\s]*([^}]+)[\s]*\}\}/g;
  private static readonly FUNCTION_PATTERN =
    /\{\{[\s]*([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*?)\)[\s]*\}\}/g;

  /**
   * Extract all variables from template content
   */
  static extractVariables(content: string): string[] {
    const variables = new Set<string>();
    const matches = content.matchAll(this.VARIABLE_PATTERN);

    for (const match of matches) {
      const variable = match[1]?.trim();
      if (!variable) continue;

      // Skip functions and partials
      if (!variable.includes('(') && !variable.startsWith('>')) {
        // Handle dot notation (e.g., user.name)
        const baseVariable = variable.split('.')[0];
        if (baseVariable) {
          variables.add(baseVariable);
        }
      }
    }

    return Array.from(variables);
  }

  /**
   * Extract function calls from template content
   */
  static extractFunctions(content: string): Array<{ name: string; args: string[] }> {
    const functions: Array<{ name: string; args: string[] }> = [];
    const matches = content.matchAll(this.FUNCTION_PATTERN);

    for (const match of matches) {
      const name = match[1]?.trim();
      const argsStr = match[2]?.trim();
      if (!name) continue;

      const args = argsStr ? argsStr.split(',').map(arg => arg.trim()) : [];
      functions.push({ name, args });
    }

    return functions;
  }

  /**
   * Replace variables in content
   */
  static replaceVariables(content: string, variables: Record<string, unknown>): string {
    // Precompute a path map of variables to avoid dynamic object injection patterns
    const buildPathMap = (obj: unknown, prefix = ''): Map<string, unknown> => {
      const map = new Map<string, unknown>();
      if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          const safeKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : '';
          if (!safeKey) continue;
          const path = prefix ? `${prefix}.${safeKey}` : safeKey;
          map.set(path, v);
          const child = buildPathMap(v, path);
          for (const [ck, cv] of child.entries()) map.set(ck, cv);
        }
      }
      return map;
    };

    const pathMap = buildPathMap(variables);

    return content.replace(this.VARIABLE_PATTERN, (match, variable) => {
      const trimmedVar = variable.trim();
      const val = pathMap.get(trimmedVar);
      return val != null ? String(val) : match;
    });
  }
}

/**
 * Front matter parser for templates with metadata
 */
export class FrontMatterParser {
  private static readonly FRONT_MATTER_PATTERN = /^---\s*\n(.*?)\n---\s*\n(.*)$/s;

  /**
   * Parse front matter from content
   */
  static parse(content: string): { metadata: Record<string, unknown>; content: string } {
    const match = content.match(this.FRONT_MATTER_PATTERN);

    if (match) {
      const [, frontMatter, bodyContent] = match;
      if (frontMatter && bodyContent !== undefined) {
        const metadata = YAMLParser.parse(frontMatter);
        // Ensure metadata is an object
        if (typeof metadata === 'object' && metadata !== null) {
          return { metadata: metadata as Record<string, unknown>, content: bodyContent.trim() };
        }
        return { metadata: {}, content: bodyContent.trim() };
      }
    }

    return { metadata: {}, content };
  }

  /**
   * Add front matter to content
   */
  static stringify(metadata: Record<string, unknown>, content: string): string {
    if (Object.keys(metadata).length === 0) {
      return content;
    }

    const frontMatter = YAMLParser.stringify(metadata);
    return `---\n${frontMatter}---\n\n${content}`;
  }
}
