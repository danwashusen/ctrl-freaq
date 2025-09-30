import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import type { FormattingAnnotation } from '@/features/section-editor/hooks/use-section-draft';
import {
  createUnsupportedFormattingPlugin,
  type UnsupportedFormattingPlugin,
  type UnsupportedFormattingPluginOptions,
} from '@/features/section-editor/lib/unsupported-formatting-plugin';

interface MilkdownEditorProps {
  value: string;
  placeholder?: string;
  onChange?: (markdown: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  readOnly?: boolean;
  className?: string;
  onFormattingAnnotationsChange?: (annotations: FormattingAnnotation[]) => void;
  onRequestDiff?: () => void;
  formattingPluginOptions?: UnsupportedFormattingPluginOptions;
  dataTestId?: string;
}

export const MilkdownEditor = memo<MilkdownEditorProps>(
  ({
    value,
    placeholder = 'Start writing...',
    onChange,
    onBlur,
    onFocus,
    readOnly = false,
    className,
    onFormattingAnnotationsChange,
    onRequestDiff,
    formattingPluginOptions,
    dataTestId,
  }) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const detachPluginRef = useRef<(() => void) | null>(null);
    const pluginRef = useRef<UnsupportedFormattingPlugin | null>(null);

    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
      setLocalValue(value);
      // Keep plugin annotations in sync with controlled updates
      pluginRef.current?.evaluate(value);
    }, [value]);

    const combinedPluginOptions = useMemo<UnsupportedFormattingPluginOptions>(() => {
      return {
        ...formattingPluginOptions,
        onAnnotationsChange: annotations => {
          formattingPluginOptions?.onAnnotationsChange?.(annotations);
          onFormattingAnnotationsChange?.(annotations);
        },
      };
    }, [formattingPluginOptions, onFormattingAnnotationsChange]);

    useEffect(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }

      const plugin = createUnsupportedFormattingPlugin(combinedPluginOptions);
      pluginRef.current = plugin;
      detachPluginRef.current = plugin.attach(textarea);

      return () => {
        detachPluginRef.current?.();
        detachPluginRef.current = null;
        pluginRef.current = null;
      };
    }, [combinedPluginOptions]);

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;
      setLocalValue(newValue);
      onChange?.(newValue);
      pluginRef.current?.evaluate(newValue);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        (event.key === 'd' || event.key === 'D')
      ) {
        event.preventDefault();
        onRequestDiff?.();
      }
    };

    return (
      <div
        className={cn(
          'milkdown-editor-container',
          'relative min-h-[200px] rounded-md border border-gray-200 p-4 dark:border-gray-700',
          'focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500',
          readOnly && 'cursor-default bg-gray-50 dark:bg-gray-900',
          className
        )}
        data-testid="milkdown-editor"
      >
        <textarea
          ref={textareaRef}
          value={localValue}
          onChange={handleChange}
          onBlur={onBlur}
          onFocus={onFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          readOnly={readOnly}
          aria-label="Document content editor"
          className={cn(
            'h-48 w-full resize-none border-none bg-transparent outline-none',
            'prose prose-sm dark:prose-invert max-w-none',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500'
          )}
          data-testid={dataTestId}
        />
      </div>
    );
  }
);

MilkdownEditor.displayName = 'MilkdownEditor';

export default MilkdownEditor;
