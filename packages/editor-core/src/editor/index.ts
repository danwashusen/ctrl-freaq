// Placeholder exports for editor core
export const editorComponents = ['editor', 'state-manager', 'command-manager', 'plugin-manager'] as const;
export type EditorComponent = typeof editorComponents[number];