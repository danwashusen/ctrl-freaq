import type { FormattingAnnotation } from '../hooks/use-section-draft';

interface UnsupportedPattern {
  pattern: RegExp;
  markType: string;
  message: string;
  severity?: 'warning' | 'error';
}

export interface UnsupportedFormattingPluginOptions {
  onAnnotationsChange?: (annotations: FormattingAnnotation[]) => void;
  debounceMs?: number;
  patterns?: UnsupportedPattern[];
}

const DEFAULT_PATTERNS: UnsupportedPattern[] = [
  {
    pattern: /<font\b[^>]*>/gi,
    markType: 'unsupported-color',
    message: 'Custom font tags are not supported. Use semantic headings or emphasis instead.',
  },
  {
    pattern: /style\s*=\s*"[^"]*(color|font-size|font-family)[^"]*"/gi,
    markType: 'unsupported-style-attribute',
    message: 'Inline style attributes are not supported. Move styling to markdown equivalents.',
  },
  {
    pattern: /<(span|div)\b[^>]*>([\s\S]*?)<\/\1>/gi,
    markType: 'unsupported-html-wrapper',
    message: 'HTML wrappers are not supported. Use markdown constructs instead.',
  },
  {
    pattern: /<(u|strike)>/gi,
    markType: 'unsupported-markup',
    message: 'Underline and strike-through markup is not supported in approval content.',
  },
];

const toAnnotation = (
  match: RegExpExecArray,
  pattern: UnsupportedPattern
): FormattingAnnotation => ({
  id: `${pattern.markType}-${match.index}-${match[0].length}`,
  startOffset: match.index,
  endOffset: match.index + match[0].length,
  markType: pattern.markType,
  message: pattern.message,
  severity: pattern.severity ?? 'warning',
});

const dedupeAnnotations = (annotations: FormattingAnnotation[]): FormattingAnnotation[] => {
  const seen = new Map<string, FormattingAnnotation>();
  annotations.forEach(annotation => {
    const key = `${annotation.startOffset}:${annotation.endOffset}:${annotation.markType}`;
    if (!seen.has(key)) {
      seen.set(key, annotation);
    }
  });
  return Array.from(seen.values());
};

const debounce = <T extends (...args: never[]) => void>(fn: T, delay: number): T => {
  if (delay <= 0) {
    return fn;
  }

  let timeout: ReturnType<typeof setTimeout> | null = null;

  const wrapper = ((...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      timeout = null;
      fn(...args);
    }, delay);
  }) as T;

  return wrapper;
};

export class UnsupportedFormattingPlugin {
  private readonly onAnnotationsChange?: (annotations: FormattingAnnotation[]) => void;
  private readonly patterns: UnsupportedPattern[];
  private readonly emit: (value: string) => void;

  constructor(options: UnsupportedFormattingPluginOptions = {}) {
    this.onAnnotationsChange = options.onAnnotationsChange;
    this.patterns = options.patterns ?? DEFAULT_PATTERNS;
    this.emit = debounce(this.evaluate, options.debounceMs ?? 120);
  }

  attach(element: HTMLTextAreaElement): () => void {
    const handler = () => this.emit(element.value);
    element.addEventListener('input', handler);
    // Emit initial annotations for prefilled content
    this.emit(element.value);

    return () => {
      element.removeEventListener('input', handler);
    };
  }

  evaluate = (content: string): void => {
    const annotations = this.detectUnsupportedFormatting(content);
    this.onAnnotationsChange?.(annotations);
  };

  detectUnsupportedFormatting(content: string): FormattingAnnotation[] {
    if (!content || this.patterns.length === 0) {
      return [];
    }

    const annotations: FormattingAnnotation[] = [];

    for (const pattern of this.patterns) {
      const localPattern = new RegExp(pattern.pattern.source, pattern.pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = localPattern.exec(content)) !== null) {
        annotations.push(toAnnotation(match, pattern));

        // Prevent infinite loops for zero-length matches
        if (match.index === localPattern.lastIndex) {
          localPattern.lastIndex += 1;
        }
      }
    }

    return dedupeAnnotations(annotations);
  }
}

export const createUnsupportedFormattingPlugin = (
  options?: UnsupportedFormattingPluginOptions
): UnsupportedFormattingPlugin => new UnsupportedFormattingPlugin(options);
