import { executiveDashboardRows } from './executive-dashboard-render-data.mjs';
import { EXECUTIVE_DASHBOARD_STYLE } from './executive-dashboard-render-style.mjs';
import {
  dashboardExecutiveCards,
  dashboardMetricMeta,
  dashboardMinutes,
  dashboardPanel,
  dashboardTable,
  dashboardTrendSvg,
  dashboardValueOrMissing,
  escapeDashboardHtml,
} from './executive-dashboard-render-utils.mjs';

export function renderExecutiveDashboardHtml(snapshot) {
  const m = snapshot.metrics;
  const rows = executiveDashboardRows(snapshot);
  const quality = m.engineeringQualityTrend.value ?? [];
  const ai = m.aiAccuracyTrend.value ?? [];
  const review = m.humanReviewEffectiveness;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>NEWAX Engineering Executive Dashboard</title><style>${EXECUTIVE_DASHBOARD_STYLE}</style></head><body><main>
<header><div><h1>Engineering Executive Dashboard</h1><p>Source-backed quality, cost, time, prevention, AI, and human-review intelligence.</p></div><div class="stamp"><div>Window: ${escapeDashboardHtml(snapshot.window.start)} to ${escapeDashboardHtml(snapshot.window.end)}</div><div>Snapshot: ${escapeDashboardHtml(snapshot.snapshotAt)}</div><div>Policy: ${escapeDashboardHtml(snapshot.policyVersion)}</div></div></header>
${dashboardExecutiveCards(m)}<div class="grid">
${dashboardPanel('Top recurring root causes', m.topRecurringRootCauses, dashboardTable(['Root cause', 'Category', 'Occurrences', 'Post-rule', 'PRs', 'Escalation'], rows.rootRows))}
${dashboardPanel('Most expensive categories', m.mostExpensiveCategories, dashboardTable(['Category', 'Currency', 'Verified minor', 'Estimated minor', 'Total minor'], rows.costRows))}
${dashboardPanel('Time lost by category', m.timeLostByCategory, dashboardTable(['Category', 'Verified', 'Estimated', 'Total'], rows.timeRows))}
${dashboardPanel('Prevention effectiveness', m.preventionEffectiveness, `<div class="hero-number">${escapeDashboardHtml(dashboardValueOrMissing(m.preventionEffectiveness.value, '%'))}</div>${dashboardTable(['Rule', 'Root cause', 'State', 'Post-rule occurrences', 'Recurrence-free'], rows.preventionRows)}`)}
${dashboardPanel('Rules frequently ignored', m.rulesFrequentlyIgnored, dashboardTable(['Rule', 'Root cause', 'Ignored', 'Dispositions', 'PRs'], rows.ignoredRows))}
${dashboardPanel(
  'Detection, resolution, and verification speed',
  m.meanTimeToDetect,
  dashboardTable(
    ['Metric', 'Mean', 'Median', 'Eligible'],
    [
      [
        'MTTD',
        dashboardMinutes(m.meanTimeToDetect.value),
        dashboardMinutes(m.meanTimeToDetect.details?.medianMinutes),
        String(m.meanTimeToDetect.denominator ?? 0),
      ],
      [
        'MTTR',
        dashboardMinutes(m.meanTimeToResolve.value),
        dashboardMinutes(m.meanTimeToResolve.details?.medianMinutes),
        String(m.meanTimeToResolve.denominator ?? 0),
      ],
      [
        'MTTV',
        dashboardMinutes(m.meanTimeToVerify.value),
        dashboardMinutes(m.meanTimeToVerify.details?.medianMinutes),
        String(m.meanTimeToVerify.denominator ?? 0),
      ],
    ],
  ),
)}
<section class="panel wide"><div class="panel-head"><div><h2>Engineering quality trend</h2><p>${escapeDashboardHtml(m.engineeringQualityTrend.formula)}</p></div></div>${dashboardTrendSvg(quality, 'verifiedResolutionRate')}<div class="legend"><span>Sparkline: verified resolution rate</span></div>${dashboardTable(
    [
      'Period',
      'Verified resolution',
      'Recurrence-free',
      'Evidence quality',
      'Executed governance',
      'Human review',
    ],
    quality.map((row) => [
      row.periodStart.slice(0, 10),
      dashboardValueOrMissing(row.verifiedResolutionRate, '%'),
      dashboardValueOrMissing(row.recurrenceFreeRate, '%'),
      dashboardValueOrMissing(row.evidenceQualityAverage),
      dashboardValueOrMissing(row.executedGovernancePassRate, '%'),
      dashboardValueOrMissing(row.humanReviewEffectiveness, '%'),
    ]),
  )}${dashboardMetricMeta(m.engineeringQualityTrend)}</section>
<section class="panel"><div class="panel-head"><div><h2>AI accuracy trend</h2><p>${escapeDashboardHtml(m.aiAccuracyTrend.formula)}</p></div></div>${dashboardTrendSvg(ai, 'accuracy')}${dashboardTable(['Current strict accuracy', 'Validated', 'Partial', 'Incorrect'], [[dashboardValueOrMissing(m.aiAccuracyTrend.details?.currentAccuracy, '%'), String(m.aiAccuracyTrend.denominator ?? 0), String(m.aiAccuracyTrend.details?.partial ?? 0), String(m.aiAccuracyTrend.details?.incorrect ?? 0)]])}${dashboardMetricMeta(m.aiAccuracyTrend)}</section>
${dashboardPanel('Human review effectiveness', review, dashboardTable(['Effectiveness', 'Review coverage', 'Reviewed PRs', 'Eligible PRs', 'Escaped findings'], [[dashboardValueOrMissing(review.value, '%'), dashboardValueOrMissing(review.details?.reviewCoverage, '%'), String(review.details?.reviewedPullRequests ?? 0), String(review.details?.eligiblePullRequests ?? 0), String(review.details?.escapedFindings ?? 0)]]))}
<section class="panel wide"><div class="panel-head"><div><h2>Metric definitions and trust boundaries</h2><p>Every metric retains its formula, coverage, freshness, status, and sources.</p></div></div><ul class="definitions">${rows.definitions}</ul><div class="meta"><span>Source-family coverage: ${escapeDashboardHtml(String(snapshot.dataCoverage.percentage))}%</span><span>Input digest: ${escapeDashboardHtml(snapshot.inputDigest)}</span><span>Snapshot digest: ${escapeDashboardHtml(snapshot.digest)}</span></div></section>
</div></main></body></html>`;
}
