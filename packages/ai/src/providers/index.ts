// Placeholder exports for AI providers
export const providers = ['openai', 'anthropic', 'azure'] as const;
export type Provider = (typeof providers)[number];
