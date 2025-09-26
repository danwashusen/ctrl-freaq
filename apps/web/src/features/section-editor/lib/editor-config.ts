// Simplified editor config for MVP - will be properly integrated with Milkdown later

export interface EditorConfig {
  theme: 'nord' | 'material';
  placeholder?: string;
  editable?: boolean;
  spellcheck?: boolean;
  autofocus?: boolean;
  tabSize?: number;
}

export interface EditorCallbacks {
  onUpdate?: (markdown: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onReady?: () => void;
  onDestroy?: () => void;
  onError?: (error: Error) => void;
}

export interface EditorFeatures {
  history: boolean;
  autoSave: boolean;
  spellCheck: boolean;
  wordWrap: boolean;
  lineNumbers: boolean;
}

// Default configuration
export const defaultEditorConfig: EditorConfig = {
  theme: 'nord',
  placeholder: 'Start typing...',
  editable: true,
  spellcheck: true,
  autofocus: false,
  tabSize: 2,
};

export const defaultEditorFeatures: EditorFeatures = {
  history: true,
  autoSave: true,
  spellCheck: true,
  wordWrap: true,
  lineNumbers: false,
};

// Simplified editor factory for MVP
export function createEditor(
  config: Partial<EditorConfig> = {},
  _features: Partial<EditorFeatures> = {},
  callbacks: EditorCallbacks = {}
): HTMLTextAreaElement {
  const finalConfig = { ...defaultEditorConfig, ...config };

  const textarea = document.createElement('textarea');
  textarea.className = 'milkdown-editor section-editor';
  textarea.placeholder = finalConfig.placeholder || '';

  // Add event listeners
  textarea.addEventListener('input', () => {
    callbacks.onUpdate?.(textarea.value);
  });

  textarea.addEventListener('focus', () => {
    callbacks.onFocus?.();
  });

  textarea.addEventListener('blur', () => {
    callbacks.onBlur?.();
  });

  setTimeout(() => {
    callbacks.onReady?.();
  }, 0);

  return textarea;
}

// Editor command helpers
export interface EditorCommands {
  setContent: (content: string) => Promise<void>;
  getContent: () => string;
  focus: () => void;
  blur: () => void;
  undo: () => void;
  redo: () => void;
  insertText: (text: string, position?: number) => void;
  replaceSelection: (text: string) => void;
  selectAll: () => void;
  insertAtCursor: (text: string) => void;
}

export function createEditorCommands(editor: HTMLTextAreaElement): EditorCommands {
  return {
    setContent: async (content: string): Promise<void> => {
      editor.value = content;
    },

    getContent: (): string => editor.value,

    focus: (): void => {
      editor.focus();
    },

    blur: (): void => {
      editor.blur();
    },

    undo: (): void => {
      document.execCommand('undo');
    },

    redo: (): void => {
      document.execCommand('redo');
    },

    insertText: (text: string, position?: number): void => {
      const pos = position ?? editor.selectionStart;
      const value = editor.value;
      editor.value = value.substring(0, pos) + text + value.substring(pos);
      editor.selectionStart = editor.selectionEnd = pos + text.length;
    },

    replaceSelection: (text: string): void => {
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const value = editor.value;
      editor.value = value.substring(0, start) + text + value.substring(end);
      editor.selectionStart = editor.selectionEnd = start + text.length;
    },

    selectAll: (): void => {
      editor.select();
    },

    insertAtCursor: (text: string): void => {
      const pos = editor.selectionStart;
      const value = editor.value;
      editor.value = value.substring(0, pos) + text + value.substring(pos);
      editor.selectionStart = editor.selectionEnd = pos + text.length;
    },
  };
}

// CSS styles for the editor
export const editorStyles = `
  .milkdown-editor.section-editor {
    min-height: 200px;
    max-height: 600px;
    overflow-y: auto;
    padding: 16px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background-color: #ffffff;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    line-height: 1.6;
  }

  .milkdown-editor.section-editor:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .milkdown-editor.section-editor[data-placeholder]:empty::before {
    content: attr(data-placeholder);
    color: #9ca3af;
    pointer-events: none;
    position: absolute;
  }

  .milkdown-editor.section-editor.word-wrap {
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .milkdown-editor.section-editor.line-numbers {
    padding-left: 48px;
    position: relative;
  }

  .milkdown-editor.section-editor.line-numbers::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 40px;
    background-color: #f8fafc;
    border-right: 1px solid #e2e8f0;
  }

  /* Markdown styling */
  .milkdown-editor.section-editor h1,
  .milkdown-editor.section-editor h2,
  .milkdown-editor.section-editor h3,
  .milkdown-editor.section-editor h4,
  .milkdown-editor.section-editor h5,
  .milkdown-editor.section-editor h6 {
    font-weight: 600;
    margin-top: 24px;
    margin-bottom: 12px;
  }

  .milkdown-editor.section-editor h1 { font-size: 28px; }
  .milkdown-editor.section-editor h2 { font-size: 24px; }
  .milkdown-editor.section-editor h3 { font-size: 20px; }
  .milkdown-editor.section-editor h4 { font-size: 18px; }
  .milkdown-editor.section-editor h5 { font-size: 16px; }
  .milkdown-editor.section-editor h6 { font-size: 14px; }

  .milkdown-editor.section-editor p {
    margin-bottom: 12px;
  }

  .milkdown-editor.section-editor ul,
  .milkdown-editor.section-editor ol {
    margin-bottom: 12px;
    padding-left: 24px;
  }

  .milkdown-editor.section-editor li {
    margin-bottom: 4px;
  }

  .milkdown-editor.section-editor blockquote {
    border-left: 4px solid #e2e8f0;
    padding-left: 16px;
    margin: 16px 0;
    color: #6b7280;
    font-style: italic;
  }

  .milkdown-editor.section-editor code {
    background-color: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
    font-size: 13px;
  }

  .milkdown-editor.section-editor pre {
    background-color: #f8fafc;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 16px 0;
  }

  .milkdown-editor.section-editor pre code {
    background-color: transparent;
    padding: 0;
  }

  .milkdown-editor.section-editor a {
    color: #3b82f6;
    text-decoration: none;
  }

  .milkdown-editor.section-editor a:hover {
    text-decoration: underline;
  }

  .milkdown-editor.section-editor strong {
    font-weight: 600;
  }

  .milkdown-editor.section-editor em {
    font-style: italic;
  }
`;

// Utility function to inject styles
export function injectEditorStyles(): void {
  if (typeof document === 'undefined') return;

  const styleId = 'section-editor-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = editorStyles;
  document.head.appendChild(style);
}
