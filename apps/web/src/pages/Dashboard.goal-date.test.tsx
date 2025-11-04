import { describe, expect, it, vi, afterEach } from 'vitest';

describe('formatGoalTargetDate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('normalizes goal target dates to avoid timezone drift', async () => {
    const realDateTimeFormat = Intl.DateTimeFormat;
    const shiftMs = 12 * 60 * 60 * 1000;

    const dateTimeFormatStub = vi.fn(function dateTimeFormatStub(
      locale?: string | string[],
      options?: Intl.DateTimeFormatOptions
    ) {
      const actual = new realDateTimeFormat(locale, options);
      return {
        format(value: Parameters<Intl.DateTimeFormat['format']>[0]) {
          let date: Date;
          if (value instanceof Date) {
            date = value;
          } else if (value === undefined) {
            date = new Date();
          } else {
            date = new Date(value);
          }
          if (!options || !options.timeZone) {
            const shifted = new Date(date.getTime() - shiftMs);
            return actual.format(shifted);
          }
          return actual.format(date);
        },
        resolvedOptions: actual.resolvedOptions.bind(actual),
      } as Intl.DateTimeFormat;
    });

    vi.stubGlobal('Intl', {
      ...Intl,
      DateTimeFormat: dateTimeFormatStub,
    });

    vi.resetModules();
    const { formatGoalTargetDate } = await import('./Dashboard');

    const expectedDisplay = new realDateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(new Date('2025-10-30T00:00:00.000Z'));

    expect(formatGoalTargetDate('2025-10-30')).toBe(expectedDisplay);
  });
});
