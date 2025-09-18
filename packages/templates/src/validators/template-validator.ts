import { z } from 'zod';

export interface CreateTemplateValidatorInput {
  templateId: string;
  version: string;
  schemaJson: unknown;
}

interface JsonSchemaNode {
  type?: string;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  enum?: string[];
  format?: string;
  items?: JsonSchemaNode;
  minLength?: number | null;
  maxLength?: number | null;
  pattern?: string | null;
}

export function createTemplateValidator(input: CreateTemplateValidatorInput): z.ZodTypeAny {
  const { schemaJson } = input;
  if (!schemaJson || typeof schemaJson !== 'object') {
    throw new Error(`Invalid schemaJson for template ${input.templateId}@${input.version}`);
  }

  return buildZodSchema(schemaJson as JsonSchemaNode);
}

function buildZodSchema(node: JsonSchemaNode): z.ZodTypeAny {
  switch (node.type) {
    case 'object':
      return buildZodObjectSchema(node);
    case 'array': {
      const itemSchema = node.items ? buildZodSchema(node.items) : z.any();
      return z.array(itemSchema);
    }
    case 'number':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'string':
    default:
      return buildZodStringSchema(node);
  }
}

function buildZodObjectSchema(node: JsonSchemaNode): z.ZodTypeAny {
  const properties = node.properties ?? {};
  const required = new Set(node.required ?? []);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, schema] of Object.entries(properties)) {
    const child = buildZodSchema(schema);
    // Property keys originate from trusted schema generation; dynamic assignment is intentional.
    // eslint-disable-next-line security/detect-object-injection
    shape[key] = required.has(key) ? child : child.optional();
  }

  return z.object(shape).strict();
}

function buildZodStringSchema(node: JsonSchemaNode): z.ZodTypeAny {
  let schema: z.ZodTypeAny = z.string();

  if (node.enum && node.enum.length > 0) {
    const values = node.enum as [string, ...string[]];
    schema = z.enum(values);
    return schema;
  }

  if (node.format === 'uri') {
    schema = (schema as z.ZodString).url();
  }

  if (typeof node.minLength === 'number') {
    schema = (schema as z.ZodString).min(node.minLength);
  }

  if (typeof node.maxLength === 'number') {
    schema = (schema as z.ZodString).max(node.maxLength);
  }

  if (node.pattern) {
    schema = (schema as z.ZodString).regex(new RegExp(node.pattern));
  }

  return schema;
}
