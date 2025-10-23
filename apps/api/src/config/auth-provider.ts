import path from 'node:path';

export type AuthProvider = 'clerk' | 'simple';

export interface AuthProviderConfig {
  provider: AuthProvider;
  simpleAuthUserFile?: string;
}

export interface ResolveAuthProviderOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export class AuthProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthProviderConfigError';
  }
}

const normalizeProvider = (raw: string | undefined): AuthProvider => {
  const normalized = (raw ?? 'clerk').trim().toLowerCase();
  if (normalized === '' || normalized === 'clerk') {
    return 'clerk';
  }
  if (normalized === 'simple') {
    return 'simple';
  }

  throw new AuthProviderConfigError(
    `Unsupported AUTH_PROVIDER value "${raw}". Expected "clerk" or "simple".`
  );
};

export const resolveAuthProviderConfig = (
  options: ResolveAuthProviderOptions = {}
): AuthProviderConfig => {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();

  const provider = normalizeProvider(env.AUTH_PROVIDER);

  if (provider === 'simple') {
    const fileRaw = env.SIMPLE_AUTH_USER_FILE?.trim() ?? '';
    if (!fileRaw) {
      throw new AuthProviderConfigError(
        'SIMPLE_AUTH_USER_FILE is required when AUTH_PROVIDER=simple'
      );
    }

    const absolutePath = path.isAbsolute(fileRaw) ? fileRaw : path.resolve(cwd, fileRaw);

    return {
      provider: 'simple',
      simpleAuthUserFile: absolutePath,
    };
  }

  return { provider: 'clerk' };
};

export const isSimpleAuthProvider = (
  config: AuthProviderConfig
): config is AuthProviderConfig & { provider: 'simple'; simpleAuthUserFile: string } =>
  config.provider === 'simple';

export const requiresClerkCredentials = (config: AuthProviderConfig): boolean =>
  config.provider === 'clerk';
