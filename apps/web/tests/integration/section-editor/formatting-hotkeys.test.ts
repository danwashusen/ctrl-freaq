import { describe, it, expect, vi } from 'vitest';

import { createShortcutHandlers } from '@/features/section-editor/lib/keyboard-shortcuts';
import type { ShortcutBinding } from '@/features/section-editor/lib/keyboard-shortcuts';

describe('Section Editor formatting keyboard shortcuts', () => {
  it('maps bold, italic, and link commands to Control/Command combos', () => {
    const toggleBold = vi.fn();
    const toggleItalic = vi.fn();
    const insertLink = vi.fn();

    const bindings = createShortcutHandlers({
      commands: {
        toggleBold,
        toggleItalic,
        insertLink,
      },
    });

    const boldBinding = bindings.find(
      (binding): binding is ShortcutBinding => binding.shortcut === 'mod+b'
    );
    const italicBinding = bindings.find(
      (binding): binding is ShortcutBinding => binding.shortcut === 'mod+i'
    );
    const linkBinding = bindings.find(
      (binding): binding is ShortcutBinding => binding.shortcut === 'mod+k'
    );

    expect(boldBinding).toBeDefined();
    expect(italicBinding).toBeDefined();
    expect(linkBinding).toBeDefined();

    boldBinding?.handler(new KeyboardEvent('keydown', { key: 'b', metaKey: true }));
    italicBinding?.handler(new KeyboardEvent('keydown', { key: 'i', ctrlKey: true }));
    linkBinding?.handler(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));

    expect(toggleBold).toHaveBeenCalledTimes(1);
    expect(toggleItalic).toHaveBeenCalledTimes(1);
    expect(insertLink).toHaveBeenCalledTimes(1);
  });

  it('prevents default browser behavior when handling shortcuts', () => {
    const toggleBold = vi.fn();
    const bindings = createShortcutHandlers({
      commands: {
        toggleBold,
        toggleItalic: vi.fn(),
        insertLink: vi.fn(),
      },
    });

    const boldBinding = bindings.find(
      (binding): binding is ShortcutBinding => binding.shortcut === 'mod+b'
    );
    expect(boldBinding).toBeDefined();

    const preventDefault = vi.fn();
    const event = {
      key: 'b',
      metaKey: true,
      preventDefault,
    } as unknown as KeyboardEvent;

    boldBinding?.handler(event);
    expect(preventDefault).toHaveBeenCalled();
  });
});
