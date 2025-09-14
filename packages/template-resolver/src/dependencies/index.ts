// Placeholder exports for dependency management
export const dependencyTypes = ['graph-analyzer', 'circular-detector', 'topological-sorter', 'cache-manager'] as const;
export type DependencyType = typeof dependencyTypes[number];