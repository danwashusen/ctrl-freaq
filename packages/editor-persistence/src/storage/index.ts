// Placeholder exports for storage providers
export const storageProviders = ['localStorage', 'indexedDB', 'memory', 'remote'] as const;
export type StorageProvider = typeof storageProviders[number];