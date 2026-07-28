import { correctionForFinding, regressionForFinding } from './ai-tool-mistake-evidence.mjs';
import { hashIdentifier, normalizeArray, normalizeEvent } from './ai-tool-mistake-support.mjs';

const FORBIDDEN_DATASET_KEYS = new Set([
  'prompt',
  'rawPrompt',
  'rawOutput',
  'generatedCode',
  'code',
  'secret',
  'token',
  'credential',
  'privateContent',
]);

function assertPrivacy(value, path = 'dataset') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPrivacy(item, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_DATASET_KEYS.has(key)) {
      throw new TypeError(`${path}.${key} is prohibited in the AI quality dataset.`);
    }
    assertPrivacy(child, `${path}.${key}`);
  }
}

function bounded(values, limit = 25) {
  return [...new Set(normalizeArray(values))].slice(0, limit);
}

export function buildAiQualityDataset({ analysis, events = [], repository = '' } = {}) {
  if (analysis === null || typeof analysis !== 'object' || !Array.isArray(analysis.findings)) {
    throw new TypeError('buildAiQualityDataset requires detector analysis.');
  }
  const normalizedEvents = normalizeArray(events).map(normalizeEvent);
  const outputs = new Map(
    normalizedEvents
      .filter((event) => event.type === 'ai-output' && event.outputId.length > 0)
      .map((event) => [event.outputId, event]),
  );

  const records = analysis.findings.map((finding) => {
    const output = outputs.get(finding.outputId);
    const correction = correctionForFinding(finding, normalizedEvents);
    const regression = regressionForFinding(finding, normalizedEvents);
    const record = {
      schemaVersion: 1,
      recordId: `aiqds_${hashIdentifier(`${finding.id}:${finding.outputId}`).slice(0, 24)}`,
      repository: repository.length === 0 ? null : hashIdentifier(repository),
      findingId: finding.id,
      mistakeType: finding.type,
      state: finding.state,
      confidence: finding.confidence,
      severity: finding.severity,
      attributable: finding.attributable,
      output: {
        outputId: finding.outputId,
        sourceKind: output?.sourceKind || null,
        provider: output?.provider || null,
        model: output?.model || null,
        tool: output?.tool || null,
        toolVersion: output?.toolVersion || null,
        occurredAt: output?.at || null,
        promptHash: output?.promptHash || null,
        outputHash: output?.outputHash || null,
        artifactRefs: bounded(output?.artifactRefs),
      },
      environment: {
        framework: output?.framework || null,
        frameworkVersion: output?.frameworkVersion || null,
        documentationVersion: output?.documentationVersion || null,
        packageName: output?.packageName || null,
        packageVersion: output?.packageVersion || null,
      },
      evidence: {
        eventIds: bounded(finding.eventIds),
        kinds: bounded(finding.evidence.map((item) => item.kind)),
        missing: bounded(finding.missingEvidence),
      },
      correction:
        correction === undefined
          ? null
          : {
              eventId: correction.id,
              at: correction.at,
              commit: correction.correctionCommit || null,
            },
      regression:
        regression === undefined
          ? null
          : {
              eventId: regression.id,
              test: regression.regressionTest || null,
              run: regression.regressionRun || null,
            },
      lifecycle: {
        waived: finding.waived,
        waiver:
          finding.waiver === null
            ? null
            : {
                eventId: finding.waiver.eventId,
                at: finding.waiver.at,
                reviewerHash: hashIdentifier(finding.waiver.reviewer),
                reasonHash: hashIdentifier(finding.waiver.reason),
              },
        resolution: finding.resolution,
      },
      privacy: {
        rawPromptIncluded: false,
        rawOutputIncluded: false,
        generatedCodeIncluded: false,
        privateRepositoryContentIncluded: false,
      },
    };
    assertPrivacy(record);
    return record;
  });

  const dataset = {
    schemaVersion: 1,
    generatedFromAnalysisVersion: analysis.schemaVersion ?? null,
    recordCount: records.length,
    records,
  };
  assertPrivacy(dataset);
  return dataset;
}

export function serializeAiQualityDatasetJsonl(dataset) {
  if (dataset === null || typeof dataset !== 'object' || !Array.isArray(dataset.records)) {
    throw new TypeError('serializeAiQualityDatasetJsonl requires a dataset with records.');
  }
  assertPrivacy(dataset);
  return dataset.records.map((record) => JSON.stringify(record)).join('\n');
}
