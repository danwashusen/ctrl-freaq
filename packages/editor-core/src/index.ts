/**
 * @ctrl-freaq/editor-core - WYSIWYG editor core library
 *
 * This package provides the core WYSIWYG editor functionality for CTRL FreaQ
 * documentation editing, built on TipTap and ProseMirror with extensible
 * architecture for custom content types and behaviors.
 */

// Core editor functionality exports
export * from './editor/index.js';
export * from './extensions/index.js';
export * from './patch-engine.js';
export * from './diff/section-diff.js';
export * from './assumptions/index.js';

// Core types and interfaces
export interface EditorConfig {
  content?: string;
  extensions?: Extension[];
  editable?: boolean;
  autofocus?: boolean;
  injectCSS?: boolean;
  parseOptions?: Record<string, unknown>;
}

export interface Extension {
  name: string;
  type: 'node' | 'mark' | 'extension';
  priority?: number;
  config?: Record<string, unknown>;
}

export interface EditorState {
  doc: DocumentNode;
  selection: Selection;
  storedMarks?: Mark[];
}

export interface DocumentNode {
  type: string;
  content?: DocumentNode[];
  attrs?: Record<string, unknown>;
  text?: string;
}

export interface Selection {
  type: 'text' | 'node' | 'all';
  anchor: number;
  head: number;
}

export interface Mark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface EditorView {
  state: EditorState;
  dom: HTMLElement;
  dispatch: (transaction: Transaction) => void;
  focus: () => void;
  blur: () => void;
}

export interface Transaction {
  doc: DocumentNode;
  selection: Selection;
  steps: TransformStep[];
  time: number;
}

export interface TransformStep {
  type: string;
  from: number;
  to: number;
  slice?: DocumentSlice;
}

export interface DocumentSlice {
  content: DocumentNode[];
  openStart: number;
  openEnd: number;
}

// Placeholder implementation classes
export class Editor {
  private config: EditorConfig;
  private view?: EditorView;
  private extensions: Map<string, Extension> = new Map();

  constructor(config: EditorConfig = {}) {
    this.config = config;
  }

  registerExtension(extension: Extension): void {
    this.extensions.set(extension.name, extension);
  }

  create(element?: HTMLElement): EditorView {
    // Placeholder implementation
    const mockView: EditorView = {
      state: {
        doc: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: this.config.content || '' }],
            },
          ],
        },
        selection: { type: 'text', anchor: 0, head: 0 },
      },
      dom: element || document.createElement('div'),
      dispatch: () => {},
      focus: () => {},
      blur: () => {},
    };

    this.view = mockView;
    return mockView;
  }

  getHTML(): string {
    // Placeholder implementation
    return this.config.content || '<p></p>';
  }

  getJSON(): DocumentNode {
    // Placeholder implementation
    return this.view?.state.doc || { type: 'doc', content: [] };
  }

  setContent(content: string): void {
    this.config.content = content;
  }

  destroy(): void {
    delete this.view;
  }

  getExtensions(): string[] {
    return Array.from(this.extensions.keys());
  }
}

export class ExtensionManager {
  private extensions: Map<string, Extension> = new Map();

  register(extension: Extension): void {
    this.extensions.set(extension.name, extension);
  }

  get(name: string): Extension | undefined {
    return this.extensions.get(name);
  }

  list(): Extension[] {
    return Array.from(this.extensions.values());
  }

  listByType(type: Extension['type']): Extension[] {
    return this.list().filter(ext => ext.type === type);
  }
}

// Package metadata
export const packageInfo = {
  name: '@ctrl-freaq/editor-core',
  version: '0.1.0',
  description: 'WYSIWYG editor core library for CTRL FreaQ documentation editing',
};
