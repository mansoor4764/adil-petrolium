export const PK_TIMEZONE = 'Asia/Karachi';

export const toNumberPK = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
};

export const formatNumberPK = (
  value,
  minimumFractionDigits = 0,
  maximumFractionDigits = 0
) =>
  toNumberPK(value).toLocaleString('en-PK', {
    minimumFractionDigits,
    maximumFractionDigits,
  });

export const formatAmountPK = (value) =>
  Math.floor(toNumberPK(value)).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export const formatAmountRoundPK = (value) =>
  Math.round(toNumberPK(value)).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export const formatAmountCeilPK = (value) =>
  Math.ceil(toNumberPK(value)).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

export const formatCurrencyPK = (value) => formatAmountPK(value);

export const formatCurrencyShortPK = (value) => {
  const num = toNumberPK(value);
  
  if (num >= 1000000) {
    // For millions: show with high precision (5 significant digits)
    return (num / 1000000).toLocaleString('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    }) + 'M';
  } else if (num >= 100000) {
    // For hundreds of thousands: show with K
    return (num / 1000).toLocaleString('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }) + 'K';
  }
  
  // For values < 100K, use normal formatting
  return formatAmountPK(num);
};

export const formatRatePK = (value) =>
  toNumberPK(value).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const formatDatePK = (value) => {
  if (!value) return '—';
  const str = String(value);
  // Date-only strings (YYYY-MM-DD) are parsed as UTC midnight by the spec,
  // which shifts the displayed date back by 1 day in UTC+ timezones like PKT.
  // Appending T00:00:00 forces local-time parsing so the date stays correct.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str)
    ? new Date(`${str}T00:00:00`)
    : new Date(str);
  return date.toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: PK_TIMEZONE,
  });
};

export const formatDateTimePK = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PK_TIMEZONE,
  });
};

export const toInputDatePK = (value = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: PK_TIMEZONE,
  }).format(new Date(value));

export const toInputDateTimePK = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: PK_TIMEZONE,
  }).formatToParts(new Date(value));

  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
};

export const pkInputDateTimeToIso = (value) => {
  if (!value) return new Date().toISOString();

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? new Date().toISOString() : fallback.toISOString();
  }

  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute, 0, 0)).toISOString();
};