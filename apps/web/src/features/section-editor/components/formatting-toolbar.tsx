import type { FC } from 'react';

import {
  Bold,
  Code,
  Heading,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Table,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type FormattingControlId =
  | 'heading'
  | 'bold'
  | 'italic'
  | 'orderedList'
  | 'bulletList'
  | 'table'
  | 'link'
  | 'code'
  | 'quote';

export interface ActiveMarksState {
  heading?: boolean;
  bold?: boolean;
  italic?: boolean;
  orderedList?: boolean;
  bulletList?: boolean;
  code?: boolean;
  quote?: boolean;
  link?: boolean;
}

export interface FormattingToolbarProps {
  onToggleHeading: () => void;
  onToggleBold: () => void;
  onToggleItalic: () => void;
  onToggleOrderedList: () => void;
  onToggleBulletList: () => void;
  onInsertTable: () => void;
  onInsertLink: () => void;
  onToggleCode: () => void;
  onToggleQuote: () => void;
  activeMarks?: ActiveMarksState;
  disabled?: boolean;
  disabledControls?: Partial<Record<FormattingControlId, boolean>>;
  className?: string;
}

const controlButtonClasses = 'h-9 w-9';

const resolvePressed = (value?: boolean) => (value ? 'true' : 'false');

const isControlDisabled = (
  control: FormattingControlId,
  disabled?: boolean,
  disabledControls?: Partial<Record<FormattingControlId, boolean>>
) => Boolean(disabled || disabledControls?.[control]);

export const FormattingToolbar: FC<FormattingToolbarProps> = ({
  onToggleHeading,
  onToggleBold,
  onToggleItalic,
  onToggleOrderedList,
  onToggleBulletList,
  onInsertTable,
  onInsertLink,
  onToggleCode,
  onToggleQuote,
  activeMarks,
  disabled = false,
  disabledControls,
  className,
}) => {
  return (
    <div
      className={cn(
        'shadow-xs flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2',
        className
      )}
      role="toolbar"
      aria-label="Formatting options"
      data-testid="formatting-toolbar"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Toggle heading"
        aria-pressed={resolvePressed(activeMarks?.heading)}
        disabled={isControlDisabled('heading', disabled, disabledControls)}
        data-testid="toolbar-heading"
        className={cn(controlButtonClasses, activeMarks?.heading && 'bg-slate-200')}
        onClick={onToggleHeading}
      >
        <Heading className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Toggle bold"
        aria-pressed={resolvePressed(activeMarks?.bold)}
        disabled={isControlDisabled('bold', disabled, disabledControls)}
        data-testid="toolbar-bold"
        className={cn(controlButtonClasses, activeMarks?.bold && 'bg-slate-200')}
        onClick={onToggleBold}
      >
        <Bold className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Toggle italic"
        aria-pressed={resolvePressed(activeMarks?.italic)}
        disabled={isControlDisabled('italic', disabled, disabledControls)}
        data-testid="toolbar-italic"
        className={cn(controlButtonClasses, activeMarks?.italic && 'bg-slate-200')}
        onClick={onToggleItalic}
      >
        <Italic className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Toggle ordered list"
        aria-pressed={resolvePressed(activeMarks?.orderedList)}
        disabled={isControlDisabled('orderedList', disabled, disabledControls)}
        data-testid="toolbar-list-ordered"
        className={cn(controlButtonClasses, activeMarks?.orderedList && 'bg-slate-200')}
        onClick={onToggleOrderedList}
      >
        <ListOrdered className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Toggle unordered list"
        aria-pressed={resolvePressed(activeMarks?.bulletList)}
        disabled={isControlDisabled('bulletList', disabled, disabledControls)}
        data-testid="toolbar-list-unordered"
        className={cn(controlButtonClasses, activeMarks?.bulletList && 'bg-slate-200')}
        onClick={onToggleBulletList}
      >
        <List className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Insert table"
        disabled={isControlDisabled('table', disabled, disabledControls)}
        data-testid="toolbar-table"
        className={controlButtonClasses}
        onClick={onInsertTable}
      >
        <Table className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Insert link"
        aria-pressed={resolvePressed(activeMarks?.link)}
        disabled={isControlDisabled('link', disabled, disabledControls)}
        data-testid="toolbar-link"
        className={cn(controlButtonClasses, activeMarks?.link && 'bg-slate-200')}
        onClick={onInsertLink}
      >
        <LinkIcon className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Toggle code block"
        aria-pressed={resolvePressed(activeMarks?.code)}
        disabled={isControlDisabled('code', disabled, disabledControls)}
        data-testid="toolbar-code"
        className={cn(controlButtonClasses, activeMarks?.code && 'bg-slate-200')}
        onClick={onToggleCode}
      >
        <Code className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Toggle blockquote"
        aria-pressed={resolvePressed(activeMarks?.quote)}
        disabled={isControlDisabled('quote', disabled, disabledControls)}
        data-testid="toolbar-quote"
        className={cn(controlButtonClasses, activeMarks?.quote && 'bg-slate-200')}
        onClick={onToggleQuote}
      >
        <Quote className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
};

export default FormattingToolbar;
