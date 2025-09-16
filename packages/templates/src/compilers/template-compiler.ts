import { createHash } from 'crypto';
import { readFile } from 'node:fs/promises';

import { parse } from 'yaml';

export interface CompiledTemplateCatalog {
  id: string;
  name: string;
  description?: string | null;
  documentType: string;
}

export interface NormalizedTemplateField {
  id: string;
  label: string;
  description: string | null;
  dataType: 'markdown' | 'string' | 'enum' | 'number' | 'url' | 'boolean';
  required: boolean;
  defaultValue: string | number | boolean | null;
  allowedValues: string[] | null;
  minLength: number | null;
  maxLength: number | null;
  pattern: string | null;
}

export interface NormalizedTemplateSection {
  id: string;
  title: string;
  orderIndex: number;
  required: boolean;
  type: string;
  guidance: string | null;
  fields: NormalizedTemplateField[];
  children: NormalizedTemplateSection[];
}

export interface CompiledTemplateVersion {
  id: string;
  templateId: string;
  version: string;
  status: string;
  changelog?: string | null;
  schemaHash: string;
  schemaJson: unknown;
  sections: NormalizedTemplateSection[];
  sourcePath: string;
}

export interface TemplateCompilationResult {
  catalog: CompiledTemplateCatalog;
  version: CompiledTemplateVersion;
}

export class TemplateCompilationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateCompilationError';
  }
}

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/u;

interface RawTemplate {
  id?: string;
  name?: string;
  version?: string;
  description?: string;
  documentType?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  sections?: unknown;
}

interface RawSection {
  id?: string;
  title?: string;
  order?: number | string;
  required?: boolean;
  type?: string;
  guidance?: string;
  fields?: unknown;
  children?: unknown;
}

interface RawField {
  id?: string;
  label?: string;
  description?: string;
  dataType?: string;
  required?: boolean;
  defaultValue?: string | number | boolean;
  allowedValues?: unknown;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export async function compileTemplateFile(filePath: string): Promise<TemplateCompilationResult> {
  const source = await readFile(filePath, 'utf-8');
  return compileTemplateSource({ source, sourcePath: filePath });
}

export interface CompileTemplateSourceInput {
  source: string;
  sourcePath?: string;
}

export async function compileTemplateSource(
  input: CompileTemplateSourceInput
): Promise<TemplateCompilationResult> {
  let rawTemplate: RawTemplate | null;
  try {
    rawTemplate = parse(input.source) as RawTemplate | null;
  } catch (error) {
    throw new TemplateCompilationError(
      `Failed to parse template YAML: ${(error as Error).message}`
    );
  }

  if (!rawTemplate || typeof rawTemplate !== 'object') {
    throw new TemplateCompilationError('Template YAML must be an object');
  }

  return compileRawTemplate(rawTemplate, input.sourcePath ?? '<inline>');
}

function compileRawTemplate(
  rawTemplate: RawTemplate,
  sourcePath: string
): TemplateCompilationResult {
  const templateId = rawTemplate.id;
  const templateName = rawTemplate.name;
  const templateVersion = rawTemplate.version;

  if (!templateId) {
    throw new TemplateCompilationError('Template id is required');
  }
  if (!templateName) {
    throw new TemplateCompilationError(`Template '${templateId}' is missing a name`);
  }
  if (!templateVersion) {
    throw new TemplateCompilationError(`Template '${templateId}' is missing a version`);
  }

  if (!SEMVER_REGEX.test(templateVersion)) {
    throw new TemplateCompilationError(
      `Template '${templateId}' version '${templateVersion}' is not a valid semantic version`
    );
  }

  const sections = normalizeSections(rawTemplate.sections);

  if (sections.length === 0) {
    throw new TemplateCompilationError(`Template '${templateId}' must define at least one section`);
  }

  const schemaJson = buildTemplateSchema(sections);
  const schemaHash = createHash('sha256').update(JSON.stringify(schemaJson)).digest('hex');

  const catalog: CompiledTemplateCatalog = {
    id: templateId,
    name: templateName,
    description: rawTemplate.description ?? null,
    documentType: rawTemplate.documentType ?? 'document',
  };

  const version: CompiledTemplateVersion = {
    id: `${templateId}@${templateVersion}`,
    templateId,
    version: templateVersion,
    status: rawTemplate.status ?? 'draft',
    changelog:
      typeof rawTemplate.metadata?.changelog === 'string' ? rawTemplate.metadata?.changelog : null,
    schemaHash,
    schemaJson,
    sections,
    sourcePath,
  };

  return { catalog, version } satisfies TemplateCompilationResult;
}

function normalizeSections(input: unknown): NormalizedTemplateSection[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map(section => normalizeSection(section as RawSection))
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

function normalizeSection(raw: RawSection): NormalizedTemplateSection {
  const id = raw.id;
  const title = raw.title;
  if (!id) {
    throw new TemplateCompilationError('Section is missing an id');
  }
  if (!title) {
    throw new TemplateCompilationError(`Section '${id}' is missing a title`);
  }

  const orderValue = raw.order ?? 0;
  const orderIndex =
    typeof orderValue === 'number' ? orderValue : Number.parseInt(String(orderValue), 10) || 0;
  const required = Boolean(raw.required);
  const type = raw.type ?? 'markdown';
  const guidance = raw.guidance ?? null;

  const fields = normalizeFields(raw.fields, type);
  const children = normalizeSections(raw.children);

  return {
    id,
    title,
    orderIndex,
    required,
    type,
    guidance,
    fields,
    children,
  } satisfies NormalizedTemplateSection;
}

function normalizeFields(input: unknown, sectionType: string): NormalizedTemplateField[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return (input as RawField[]).map(field => {
    const id = field.id;
    if (!id) {
      throw new TemplateCompilationError('Template field is missing an id');
    }

    if (!field.label) {
      throw new TemplateCompilationError(`Field '${id}' is missing label metadata`);
    }

    const dataType = (field.dataType ?? 'markdown') as NormalizedTemplateField['dataType'];
    if (!['markdown', 'string', 'enum', 'number', 'url', 'boolean'].includes(dataType)) {
      throw new TemplateCompilationError(`Field '${id}' has unsupported data type '${dataType}'`);
    }

    let allowedValues: string[] | null = null;
    if (field.allowedValues !== undefined) {
      if (!Array.isArray(field.allowedValues)) {
        throw new TemplateCompilationError(
          `Field '${id}' allowedValues must be an array when provided`
        );
      }
      allowedValues = field.allowedValues.map(value => String(value));
    }

    if (dataType === 'enum' && (!allowedValues || allowedValues.length === 0)) {
      throw new TemplateCompilationError(
        `Field '${id}' must provide allowedValues for enum data type`
      );
    }

    const shouldUseLabelAsDescription =
      field.description === undefined && shouldInheritLabel(sectionType);

    return {
      id,
      label: field.label,
      description: shouldUseLabelAsDescription ? field.label : (field.description ?? null),
      dataType,
      required: Boolean(field.required),
      defaultValue:
        field.defaultValue === undefined ? null : (field.defaultValue as string | number | boolean),
      allowedValues,
      minLength: field.minLength ?? null,
      maxLength: field.maxLength ?? null,
      pattern: field.pattern ?? null,
    } satisfies NormalizedTemplateField;
  });
}

function shouldInheritLabel(sectionType: string): boolean {
  return sectionType !== 'decision-log' && sectionType !== 'list';
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
  additionalProperties?: boolean;
}

function buildTemplateSchema(sections: NormalizedTemplateSection[]): JsonSchemaNode {
  const propertiesEntries = sections.map(
    section => [section.id, buildSectionSchema(section)] as const
  );
  const properties = Object.fromEntries(propertiesEntries);
  const required = sections.filter(section => section.required).map(section => section.id);

  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required,
  } satisfies JsonSchemaNode & { additionalProperties: boolean };
}

function buildSectionSchema(section: NormalizedTemplateSection): JsonSchemaNode {
  const hasChildren = section.children.length > 0;
  const hasFields = section.fields.length > 0;

  if (!hasChildren && !hasFields) {
    return { type: 'string' };
  }

  if (section.type === 'decision-log' && hasChildren) {
    const itemsSchema = buildDecisionLogItemSchema(section.children[0]);
    return { type: 'array', items: itemsSchema };
  }

  const propertiesEntries: Array<[string, JsonSchemaNode]> = [];
  const required: string[] = [];

  if (hasFields) {
    for (const field of section.fields) {
      propertiesEntries.push([field.id, buildFieldSchema(field)]);
      if (field.required) {
        required.push(field.id);
      }
    }
  }

  if (hasChildren) {
    for (const child of section.children) {
      propertiesEntries.push([child.id, buildSectionSchema(child)]);
      if (child.required) {
        required.push(child.id);
      }
    }
  }

  const properties = Object.fromEntries(propertiesEntries);

  const schema: JsonSchemaNode = { type: 'object', properties };
  if (required.length > 0) {
    schema.required = Array.from(new Set(required));
  }
  return schema;
}

function buildDecisionLogItemSchema(
  section: NormalizedTemplateSection | undefined
): JsonSchemaNode {
  if (!section) {
    return { type: 'object' };
  }
  const itemSchema = buildSectionSchema(section);
  if (itemSchema.type !== 'object') {
    return { type: 'object' };
  }
  return itemSchema;
}

function buildFieldSchema(field: NormalizedTemplateField): JsonSchemaNode {
  switch (field.dataType) {
    case 'markdown':
    case 'string': {
      return addStringConstraints({ type: 'string' }, field);
    }
    case 'url': {
      return addStringConstraints({ type: 'string', format: 'uri' }, field);
    }
    case 'enum': {
      return {
        type: 'string',
        enum: field.allowedValues ?? [],
      };
    }
    case 'number':
      return { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    default:
      return { type: 'string' };
  }
}

function addStringConstraints(
  base: JsonSchemaNode,
  field: NormalizedTemplateField
): JsonSchemaNode {
  const schema: JsonSchemaNode = { ...base };
  if (field.minLength != null) {
    schema.minLength = field.minLength;
  }
  if (field.maxLength != null) {
    schema.maxLength = field.maxLength;
  }
  if (field.pattern) {
    schema.pattern = field.pattern;
  }
  if (field.allowedValues && field.allowedValues.length > 0) {
    schema.enum = field.allowedValues;
  }
  return schema;
}
