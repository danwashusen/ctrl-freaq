import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TemplateDocumentSchema, type TemplateDocument } from './schemas';

export function loadTemplate(kind: 'architecture'|'prd'|'brief', cwd = process.cwd()): TemplateDocument {
  const file = resolve(cwd, 'templates', `${kind}.yaml`);
  const raw = readFileSync(file, 'utf8');
  // NOTE: requires `yaml` dependency at runtime
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const YAML = require('yaml');
  const data = YAML.parse(raw);
  const parsed = TemplateDocumentSchema.parse(data);
  return parsed;
}

