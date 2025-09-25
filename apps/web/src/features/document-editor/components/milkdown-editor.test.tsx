import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { MilkdownEditor } from './milkdown-editor';
import type { FormattingAnnotation } from '@/features/section-editor/hooks/use-section-draft';

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

describe('MilkdownEditor', () => {
  it('emits formatting annotations when unsupported marks are detected', () => {
    const onFormattingAnnotationsChange = vi.fn();

    render(
      <MilkdownEditor
        value="Initial content"
        onFormattingAnnotationsChange={onFormattingAnnotationsChange}
      />
    );

    const editor = screen.getByRole('textbox', { name: 'Document content editor' });

    fireEvent.change(editor, {
      target: { value: 'Paragraph with <font color="red">unsupported</font> styling.' },
    });

    const calls = onFormattingAnnotationsChange.mock.calls;
    const annotations = (calls[calls.length - 1]?.[0] ?? []) as FormattingAnnotation[];
    expect(Array.isArray(annotations)).toBe(true);
    expect(
      annotations.some(
        (annotation: FormattingAnnotation) => annotation.markType === 'unsupported-color'
      )
    ).toBe(true);
  });

  it('invokes diff request shortcut on mod+shift+d', () => {
    const onRequestDiff = vi.fn();

    render(<MilkdownEditor value="Diff shortcut test" onRequestDiff={onRequestDiff} />);

    const editor = screen.getByRole('textbox', { name: 'Document content editor' });

    fireEvent.keyDown(editor, { key: 'd', ctrlKey: true, shiftKey: true });

    expect(onRequestDiff).toHaveBeenCalledTimes(1);
  });
});
