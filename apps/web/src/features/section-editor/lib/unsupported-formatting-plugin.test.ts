import { describe, expect, it, vi } from 'vitest';

import { createUnsupportedFormattingPlugin } from './unsupported-formatting-plugin';

describe('UnsupportedFormattingPlugin', () => {
  it('detects disallowed HTML formatting and emits annotations', () => {
    const element = document.createElement('textarea');
    element.value = 'Intro <font color="red">with color</font> text';
    document.body.appendChild(element);

    const onAnnotationsChange = vi.fn();
    const plugin = createUnsupportedFormattingPlugin({
      onAnnotationsChange,
      debounceMs: 0,
    });

    const detach = plugin.attach(element);

    element.dispatchEvent(new Event('input'));

    expect(onAnnotationsChange).toHaveBeenCalled();
    const annotations =
      onAnnotationsChange.mock.calls[onAnnotationsChange.mock.calls.length - 1]?.[0] ?? [];
    expect(Array.isArray(annotations)).toBe(true);
    expect(annotations).toHaveLength(1);
    expect(annotations[0]).toMatchObject({
      markType: 'unsupported-color',
      severity: 'warning',
    });

    detach();
    plugin.evaluate('Plain content');

    const finalAnnotations =
      onAnnotationsChange.mock.calls[onAnnotationsChange.mock.calls.length - 1]?.[0] ?? [];
    expect(finalAnnotations).toHaveLength(0);
  });
});
