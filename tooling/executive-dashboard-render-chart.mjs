import { escapeDashboardHtml } from './executive-dashboard-render-format.mjs';

export function dashboardTrendSvg(series, key) {
  const values = series.map((entry) => entry[key]);
  const numeric = values.filter(Number.isFinite);
  if (numeric.length < 2) {
    return '<div class="empty">Not enough trend evidence.</div>';
  }
  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const points = values
    .map((value, index) => {
      if (!Number.isFinite(value)) {
        return null;
      }
      const x = series.length === 1 ? 0 : (index / (series.length - 1)) * 560;
      const y = max === min ? 70 : 140 - ((value - min) / (max - min)) * 140;
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    })
    .filter(Boolean)
    .join(' ');
  return `<svg class="spark" viewBox="0 0 560 140" role="img" aria-label="${escapeDashboardHtml(key)} trend"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
}
