import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ValidationError } from './errors';

describe('ValidationError', () => {
  it('maps Zod issues to validation error details and context', () => {
    const schema = z.object({
      name: z.string().min(1, 'Name is required'),
    });

    const result = schema.safeParse({ name: '' });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected schema.safeParse to fail');
    }

    const validationError = ValidationError.fromZodError(result.error);

    expect(validationError.message).toBe('Request validation failed');
    expect(validationError.validationErrors).toEqual([
      {
        field: 'name',
        message: 'Name is required',
      },
    ]);

    expect(validationError.context).toMatchObject({
      zodIssues: result.error.issues,
    });
  });
});
