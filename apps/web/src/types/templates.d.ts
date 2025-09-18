declare module '@ctrl-freaq/templates/validators' {
  import type { z } from 'zod';

  interface CreateTemplateValidatorInput {
    templateId: string;
    version: string;
    schemaJson: unknown;
  }

  export function createTemplateValidator(input: CreateTemplateValidatorInput): z.ZodTypeAny;
}

declare module '@ctrl-freaq/templates/validators/template-validator.js' {
  import type { z } from 'zod';

  interface CreateTemplateValidatorInput {
    templateId: string;
    version: string;
    schemaJson: unknown;
  }

  export function createTemplateValidator(input: CreateTemplateValidatorInput): z.ZodTypeAny;
}
