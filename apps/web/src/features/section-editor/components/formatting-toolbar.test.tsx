import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { FormattingToolbar } from './formatting-toolbar';

describe('FormattingToolbar', () => {
  const baseProps = {
    onToggleHeading: vi.fn(),
    onToggleBold: vi.fn(),
    onToggleItalic: vi.fn(),
    onToggleOrderedList: vi.fn(),
    onToggleBulletList: vi.fn(),
    onInsertTable: vi.fn(),
    onInsertLink: vi.fn(),
    onToggleCode: vi.fn(),
    onToggleQuote: vi.fn(),
  };

  it('invokes callbacks for each control', () => {
    render(<FormattingToolbar {...baseProps} />);

    fireEvent.click(screen.getByTestId('toolbar-heading'));
    fireEvent.click(screen.getByTestId('toolbar-bold'));
    fireEvent.click(screen.getByTestId('toolbar-italic'));
    fireEvent.click(screen.getByTestId('toolbar-list-ordered'));
    fireEvent.click(screen.getByTestId('toolbar-list-unordered'));
    fireEvent.click(screen.getByTestId('toolbar-table'));
    fireEvent.click(screen.getByTestId('toolbar-link'));
    fireEvent.click(screen.getByTestId('toolbar-code'));
    fireEvent.click(screen.getByTestId('toolbar-quote'));

    expect(baseProps.onToggleHeading).toHaveBeenCalled();
    expect(baseProps.onToggleBold).toHaveBeenCalled();
    expect(baseProps.onToggleItalic).toHaveBeenCalled();
    expect(baseProps.onToggleOrderedList).toHaveBeenCalled();
    expect(baseProps.onToggleBulletList).toHaveBeenCalled();
    expect(baseProps.onInsertTable).toHaveBeenCalled();
    expect(baseProps.onInsertLink).toHaveBeenCalled();
    expect(baseProps.onToggleCode).toHaveBeenCalled();
    expect(baseProps.onToggleQuote).toHaveBeenCalled();
  });

  it('reflects active formatting state via aria-pressed', () => {
    render(
      <FormattingToolbar
        {...baseProps}
        activeMarks={{ bold: true, italic: true, orderedList: true, quote: false }}
      />
    );

    expect(screen.getByTestId('toolbar-bold')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('toolbar-italic')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('toolbar-list-ordered')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('toolbar-quote')).toHaveAttribute('aria-pressed', 'false');
  });

  it('disables controls when requested', () => {
    render(<FormattingToolbar {...baseProps} disabledControls={{ bold: true, link: true }} />);

    expect(screen.getByTestId('toolbar-bold')).toBeDisabled();
    expect(screen.getByTestId('toolbar-link')).toBeDisabled();
    expect(screen.getByTestId('toolbar-italic')).not.toBeDisabled();
  });
});
