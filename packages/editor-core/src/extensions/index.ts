// Placeholder exports for editor extensions
export const extensions = ['basic', 'formatting', 'lists', 'links', 'images', 'tables'] as const;
export type Extension = (typeof extensions)[number];
