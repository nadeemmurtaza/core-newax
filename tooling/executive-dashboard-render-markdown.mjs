import { dashboardMinutes, dashboardValueOrMissing } from './executive-dashboard-render-utils.mjs';

export function renderExecutiveDashboardMarkdown(snapshot) {
  const m = snapshot.metrics;
  const lines = [
    '# Engineering Executive Dashboard',
    '',
    `- Window: \`${snapshot.window.start}\` to \`${snapshot.window.end}\``,
    `- Snapshot: \`${snapshot.snapshotAt}\``,
    `- Policy: \`${snapshot.policyVersion}\``,
    `- Source-family coverage: \`${snapshot.dataCoverage.percentage}%\``,
    `- Snapshot digest: \`${snapshot.digest}\``,
    '',
    '## Executive indicators',
    '',
    `- Prevention effectiveness: **${dashboardValueOrMissing(m.preventionEffectiveness.value, '%')}**`,
    `- Mean time to detect: **${dashboardMinutes(m.meanTimeToDetect.value)}**`,
    `- Mean time to resolve: **${dashboardMinutes(m.meanTimeToResolve.value)}**`,
    `- Mean time to verify: **${dashboardMinutes(m.meanTimeToVerify.value)}**`,
    `- AI accuracy: **${dashboardValueOrMissing(m.aiAccuracyTrend.details?.currentAccuracy, '%')}**`,
    `- Human review effectiveness: **${dashboardValueOrMissing(m.humanReviewEffectiveness.value, '%')}**`,
    '',
    '## Coverage gaps',
    '',
    ...Object.values(m)
      .filter((metric) => metric.status === 'insufficient-evidence')
      .map((metric) => `- ${metric.label}: insufficient evidence.`),
  ];
  return `${lines.join('\n')}\n`;
}
