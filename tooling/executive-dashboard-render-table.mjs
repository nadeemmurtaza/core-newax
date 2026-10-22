import {
  dashboardMinutes,
  dashboardValueOrMissing,
  escapeDashboardHtml,
} from './executive-dashboard-render-format.mjs';

export function dashboardMetricMeta(metric) {
  const coverage = metric.coverage?.percentage;
  const freshness = metric.freshness ? metric.freshness.slice(0, 10) : 'No source date';
  return `<div class="meta"><span>Coverage: ${escapeDashboardHtml(dashboardValueOrMissing(coverage, '%'))}</span><span>Freshness: ${escapeDashboardHtml(freshness)}</span><span>Status: ${escapeDashboardHtml(metric.status)}</span></div>`;
}

export function dashboardTable(headers, rows) {
  const head = headers.map((header) => `<th>${escapeDashboardHtml(header)}</th>`).join('');
  const body =
    rows.length === 0
      ? `<tr><td colspan="${headers.length}" class="empty">No eligible evidence.</td></tr>`
      : rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${escapeDashboardHtml(cell)}</td>`).join('')}</tr>`,
          )
          .join('');
  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function dashboardPanel(title, metric, content) {
  return `<section class="panel"><div class="panel-head"><div><h2>${escapeDashboardHtml(title)}</h2><p>${escapeDashboardHtml(metric.formula)}</p></div></div>${content}${dashboardMetricMeta(metric)}</section>`;
}

export function dashboardExecutiveCards(metrics) {
  const cards = [
    [
      'Prevention effectiveness',
      dashboardValueOrMissing(metrics.preventionEffectiveness.value, '%'),
    ],
    ['Mean time to detect', dashboardMinutes(metrics.meanTimeToDetect.value)],
    ['Mean time to resolve', dashboardMinutes(metrics.meanTimeToResolve.value)],
    ['Mean time to verify', dashboardMinutes(metrics.meanTimeToVerify.value)],
    ['AI accuracy', dashboardValueOrMissing(metrics.aiAccuracyTrend.details?.currentAccuracy, '%')],
    [
      'Human review effectiveness',
      dashboardValueOrMissing(metrics.humanReviewEffectiveness.value, '%'),
    ],
  ];
  return `<div class="cards">${cards.map(([label, value]) => `<article class="card"><span>${escapeDashboardHtml(label)}</span><strong>${escapeDashboardHtml(value)}</strong></article>`).join('')}</div>`;
}
