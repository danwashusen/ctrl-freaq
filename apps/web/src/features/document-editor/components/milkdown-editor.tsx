import { memo, useState } from 'react';

import { cn } from '../../../lib/utils';

interface MilkdownEditorProps {
  value: string;
  placeholder?: string;
  onChange?: (markdown: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  readOnly?: boolean;
  className?: string;
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
  }) => {
    const [localValue, setLocalValue] = useState(value);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
      onChange?.(newValue);
    };

    return (
      <div
        className={cn(
          'milkdown-editor-container',
          'min-h-[200px] rounded-md border border-gray-200 p-4 dark:border-gray-700',
          'focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500',
          readOnly && 'cursor-default bg-gray-50 dark:bg-gray-900',
          className
        )}
        data-testid="milkdown-editor"
      >
        {/* TODO: Replace with actual Milkdown editor in Phase 3.6 */}
        <textarea
          value={localValue}
          onChange={handleChange}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          readOnly={readOnly}
          aria-label="Document content editor"
          className={cn(
            'h-48 w-full resize-none border-none bg-transparent outline-none',
            'prose prose-sm dark:prose-invert max-w-none',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500'
          )}
        />
      </div>
    );
  }
);

MilkdownEditor.displayName = 'MilkdownEditor';

export default MilkdownEditor;
