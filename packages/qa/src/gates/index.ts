// Placeholder exports for quality gates
export const gates = ['basic', 'strict', 'accessibility', 'seo'] as const;
export type Gate = typeof gates[number];