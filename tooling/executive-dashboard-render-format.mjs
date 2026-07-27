export function escapeDashboardHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function dashboardValueOrMissing(value, suffix = '') {
  return value === null || value === undefined ? 'Insufficient evidence' : `${value}${suffix}`;
}

export function dashboardMinutes(value) {
  if (value === null || value === undefined) {
    return 'Insufficient evidence';
  }
  if (value < 60) {
    return `${Math.round(value)} min`;
  }
  if (value < 1_440) {
    return `${Math.round((value / 60) * 10) / 10} h`;
  }
  return `${Math.round((value / 1_440) * 10) / 10} d`;
}
