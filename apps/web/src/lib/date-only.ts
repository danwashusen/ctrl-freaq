const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const monthDayFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
  timeZone: 'UTC',
});

const toUtcDateFromIso = (value: string): Date | null => {
  if (!ISO_DATE_ONLY.test(value)) {
    return null;
  }

  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

export const formatIsoDateMonthDay = (value?: string | null, fallback = 'No goal date'): string => {
  if (!value) {
    return fallback;
  }

  const date = toUtcDateFromIso(value);
  if (!date) {
    return fallback;
  }

  return monthDayFormatter.format(date);
};

export const formatIsoDateFull = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const date = toUtcDateFromIso(value);
  if (!date) {
    return null;
  }

  return fullDateFormatter.format(date);
};
