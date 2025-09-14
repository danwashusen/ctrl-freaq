// Placeholder exports for template resolvers
export const resolvers = ['yaml-resolver', 'json-resolver', 'file-resolver', 'variable-resolver'] as const;
export type Resolver = typeof resolvers[number];