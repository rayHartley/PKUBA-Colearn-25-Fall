export function normalizeLanguage(value) {
  const raw = String(value || '').toLowerCase();
  if (raw.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en';
}

export function isChinese(value) {
  return normalizeLanguage(value) === 'zh-CN';
}

export function getLocale(value) {
  return isChinese(value) ? 'zh-CN' : 'en-US';
}

export function formatCompactNumber(value, language, maximumFractionDigits = 1) {
  return new Intl.NumberFormat(getLocale(language), {
    notation: 'compact',
    maximumFractionDigits
  }).format(Number(value) || 0);
}

export function formatInteger(value, language) {
  return new Intl.NumberFormat(getLocale(language)).format(Number(value) || 0);
}

export function formatDateTime(value, language) {
  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  if (!timestamp) {
    return '';
  }

  return new Intl.DateTimeFormat(getLocale(language), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(timestamp));
}
