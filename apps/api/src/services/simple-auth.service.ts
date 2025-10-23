import * as fs from 'node:fs/promises';

import { load } from 'js-yaml';
import { ZodError, z } from 'zod';

export interface SimpleAuthServiceOptions {
  userFilePath: string;
}

export class SimpleAuthServiceError extends Error {
  public override readonly cause?: unknown;
  public readonly details?: unknown;

  constructor(message: string, options?: { cause?: unknown; details?: unknown }) {
    super(message);
    this.name = 'SimpleAuthServiceError';
    this.cause = options?.cause;
    this.details = options?.details;
  }
}

const simpleAuthUserSchema = z.object({
  id: z.string().min(1, 'Simple auth user `id` must be provided'),
  email: z.string().email('Simple auth user `email` must be a valid email address'),
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  image_url: z.string().min(1).optional(),
  org_role: z.string().min(1).optional(),
  org_permissions: z.array(z.string().min(1)).optional(),
});

const simpleAuthConfigSchema = z
  .object({
    users: z.array(simpleAuthUserSchema).min(1, 'At least one simple auth user must be defined'),
  })
  .strict();

export type SimpleAuthUser = z.infer<typeof simpleAuthUserSchema>;

export class SimpleAuthService {
  private cache: SimpleAuthUser[] | null = null;
  private inflight: Promise<SimpleAuthUser[]> | null = null;

  constructor(private readonly options: SimpleAuthServiceOptions) {
    if (!options.userFilePath) {
      throw new SimpleAuthServiceError('Simple auth user file path is required');
    }
  }

  async listUsers(): Promise<SimpleAuthUser[]> {
    if (this.cache) {
      return this.cache;
    }

    if (!this.inflight) {
      this.inflight = this.loadUsersFromDisk();
    }

    try {
      const users = await this.inflight;
      this.cache = users;
      return users;
    } finally {
      this.inflight = null;
    }
  }

  async getUserById(userId: string): Promise<SimpleAuthUser | undefined> {
    const users = await this.listUsers();
    return users.find(user => user.id === userId);
  }

  async refresh(): Promise<void> {
    this.cache = null;
    this.inflight = null;
    this.cache = await this.loadUsersFromDisk();
  }

  private async loadUsersFromDisk(): Promise<SimpleAuthUser[]> {
    const { userFilePath } = this.options;

    let raw: string;
    try {
      raw = await fs.readFile(userFilePath, 'utf8');
    } catch (error) {
      throw new SimpleAuthServiceError(`Failed to load simple auth users from ${userFilePath}`, {
        cause: error,
      });
    }

    let parsed: unknown;
    try {
      parsed = load(raw);
    } catch (error) {
      throw new SimpleAuthServiceError(`Failed to parse simple auth YAML at ${userFilePath}`, {
        cause: error,
      });
    }

    try {
      const result = simpleAuthConfigSchema.parse(parsed);
      const seenIds = new Set<string>();
      const seenEmails = new Set<string>();

      const users = result.users.map(user => {
        if (seenIds.has(user.id)) {
          throw new SimpleAuthServiceError(
            `Duplicate simple auth user id "${user.id}" detected in ${userFilePath}`
          );
        }
        seenIds.add(user.id);

        const normalizedEmail = user.email.toLowerCase();
        if (seenEmails.has(normalizedEmail)) {
          throw new SimpleAuthServiceError(
            `Duplicate simple auth user email "${user.email}" detected in ${userFilePath}`
          );
        }
        seenEmails.add(normalizedEmail);

        return {
          ...user,
          org_permissions: user.org_permissions ?? [],
        };
      });

      return users;
    } catch (error) {
      if (error instanceof SimpleAuthServiceError) {
        throw error;
      }
      if (error instanceof ZodError) {
        throw new SimpleAuthServiceError('Simple auth user file failed validation', {
          cause: error,
          details: error.flatten(),
        });
      }

      throw new SimpleAuthServiceError('Unexpected error while validating simple auth users', {
        cause: error,
      });
    }
  }
}
