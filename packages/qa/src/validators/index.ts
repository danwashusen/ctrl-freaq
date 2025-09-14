// Placeholder exports for QA validators
export const validators = ['schema', 'content', 'structure', 'accessibility'] as const;
export type Validator = typeof validators[number];