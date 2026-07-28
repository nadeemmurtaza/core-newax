import {
  compareEvents,
  createFinding,
  isAttributableOutput,
  isVerifiedEvidence,
  normalizeArray,
  normalizeEvent,
  normalizeString,
  occurredNoLaterThan,
} from './ai-tool-mistake-support.mjs';
import {
  activeEvidence,
  applyFindingLifecycle,
  canBlockFinding,
  eventsForOutput,
  provenanceMissing,
  verifiedEvents,
} from './ai-tool-mistake-evidence.mjs';

export { AI_TOOL_MISTAKE_TYPES } from './ai-tool-mistake-support.mjs';

function evidenceState(output, evidence, { historical = false } = {}) {
  const missing = provenanceMissing(output);
  if (!isAttributableOutput(output)) {
    return { state: 'suspected', confidence: 'medium', missing };
  }
  if (historical) {
    const order = occurredNoLaterThan(evidence, output);
    if (order === null) {
      return {
        state: 'suspected',
        confidence: 'medium',
        missing: [...missing, 'comparable-effective-and-output-timestamps'],
      };
    }
    if (!order) {
      return {
        state: 'suspected',
        confidence: 'medium',
        missing: [...missing, 'evidence-effective-at-output-time'],
      };
    }
  }
  return { state: 'detected', confidence: 'high', missing };
}

function addFinding(findings, finding) {
  const duplicate = findings.some(
    (candidate) =>
      candidate.type === finding.type &&
      candidate.outputId === finding.outputId &&
      candidate.eventIds.join('|') === finding.eventIds.join('|'),
  );
  if (!duplicate) {
    findings.push(finding);
  }
}

export function detectAiToolMistakes(input = {}) {
  const phase = normalizeString(input.phase).toLowerCase() || 'draft';
  const events = normalizeArray(input.events).map(normalizeEvent).sort(compareEvents);
  const findings = [];
  const notices = [];
  const eventIds = new Set();

  for (const event of events) {
    if (eventIds.has(event.id)) {
      throw new TypeError(`Duplicate event-id: ${event.id}.`);
    }
    eventIds.add(event.id);
  }

  const outputs = events.filter((event) => event.type === 'ai-output');
  const outputIds = new Set(outputs.map((output) => output.outputId).filter(Boolean));
  for (const event of events.filter((candidate) => candidate.type !== 'ai-output')) {
    if (event.outputId.length > 0 && !outputIds.has(event.outputId)) {
      notices.push({
        type: 'insufficient-evidence',
        code: 'referenced-output-missing',
        eventId: event.id,
        outputId: event.outputId,
        message: `${event.id} references ${event.outputId}, but no attributable AI or tool output record exists.`,
      });
    }
  }

  for (const output of outputs) {
    if (output.outputId.length === 0) {
      notices.push({
        type: 'insufficient-evidence',
        code: 'output-id-missing',
        eventId: output.id,
        message: `${output.id} cannot be correlated without output-id.`,
      });
      continue;
    }
    const related = activeEvidence(eventsForOutput(events, output.outputId));
    const missingProvenance = provenanceMissing(output);
    if (missingProvenance.length > 0) {
      notices.push({
        type: 'insufficient-evidence',
        code: 'output-provenance-incomplete',
        eventId: output.id,
        outputId: output.outputId,
        missingEvidence: missingProvenance,
        message: `${output.outputId} lacks provenance required for a high-confidence AI or tool finding.`,
      });
    }

    for (const contradiction of verifiedEvents(related, 'authoritative-contradiction')) {
      const temporal = evidenceState(output, contradiction, { historical: true });
      const explicitCorrection = contradiction.confirmsMistake === true;
      addFinding(
        findings,
        createFinding({
          type: 'ai-hallucination',
          output,
          state: explicitCorrection && isAttributableOutput(output) ? 'detected' : temporal.state,
          confidence:
            explicitCorrection && isAttributableOutput(output) ? 'high' : temporal.confidence,
          severity: contradiction.severity === 'medium' ? 'high' : contradiction.severity,
          title: `${output.outputId} asserted a claim or symbol contradicted by verified authoritative evidence.`,
          eventIds: [output.id, contradiction.id],
          evidence: [
            {
              kind: 'generated-output',
              eventId: output.id,
              claim: output.claim,
              symbol: output.symbol,
            },
            {
              kind: 'authoritative-contradiction',
              eventId: contradiction.id,
              expected: contradiction.expected,
              actual: contradiction.actual,
              validationRef: contradiction.validationRef,
            },
          ],
          missingEvidence: explicitCorrection ? missingProvenance : temporal.missing,
          recommendation:
            'Verify generated claims and symbols against the pinned authoritative source before accepting the output.',
        }),
      );
    }

    for (const validation of verifiedEvents(related, 'framework-api-validation')) {
      if (!['missing', 'incompatible', 'failed'].includes(validation.status)) {
        continue;
      }
      const versionMatches =
        output.framework.length > 0 &&
        output.frameworkVersion.length > 0 &&
        validation.framework === output.framework &&
        validation.pinnedVersion === output.frameworkVersion;
      const base = evidenceState(output, validation, { historical: true });
      addFinding(
        findings,
        createFinding({
          type: 'wrong-framework-api',
          output,
          state: versionMatches && isAttributableOutput(output) ? base.state : 'suspected',
          confidence: versionMatches && isAttributableOutput(output) ? base.confidence : 'medium',
          severity: 'high',
          title: `${output.outputId} used a framework API missing or incompatible with the pinned framework version.`,
          eventIds: [output.id, validation.id],
          evidence: [
            {
              kind: 'framework-output',
              framework: output.framework,
              version: output.frameworkVersion,
              symbol: output.symbol,
            },
            {
              kind: 'framework-validation',
              eventId: validation.id,
              pinnedVersion: validation.pinnedVersion,
              symbol: validation.symbol,
              validationKind: validation.validationKind,
              validationCode: validation.validationCode,
              validationRef: validation.validationRef,
            },
          ],
          missingEvidence: versionMatches
            ? base.missing
            : [...missingProvenance, 'matching-framework-and-pinned-version'],
          recommendation:
            'Resolve the API against the repository-pinned framework version and add a compile or contract regression.',
        }),
      );
    }

    for (const documentation of related.filter(
      (event) => event.type === 'documentation-use' && event.materialImpact === true,
    )) {
      const mismatch =
        documentation.documentationVersion.length > 0 &&
        documentation.pinnedVersion.length > 0 &&
        documentation.documentationVersion !== documentation.pinnedVersion;
      if (!mismatch) {
        continue;
      }
      const verifiedImpact =
        isVerifiedEvidence(documentation) || documentation.confirmsMistake === true;
      const base = evidenceState(output, documentation, { historical: true });
      addFinding(
        findings,
        createFinding({
          type: 'wrong-documentation-version',
          output,
          state: verifiedImpact && isAttributableOutput(output) ? base.state : 'suspected',
          confidence: verifiedImpact && isAttributableOutput(output) ? base.confidence : 'medium',
          severity: 'high',
          title: `${output.outputId} relied on documentation for a different version than the repository-pinned version.`,
          eventIds: [output.id, documentation.id],
          evidence: [
            {
              kind: 'documentation-version',
              eventId: documentation.id,
              usedVersion: documentation.documentationVersion,
              pinnedVersion: documentation.pinnedVersion,
              validationRef: documentation.validationRef,
            },
          ],
          missingEvidence: verifiedImpact
            ? base.missing
            : [...missingProvenance, 'verified-material-impact'],
          recommendation:
            'Use documentation matching the repository-pinned version and record the exact source version.',
        }),
      );
    }

    for (const metadata of related.filter(
      (event) => event.type === 'package-metadata' && event.status === 'deprecated',
    )) {
      const samePackage =
        output.packageName.length > 0 &&
        metadata.packageName === output.packageName &&
        (metadata.packageVersion.length === 0 || metadata.packageVersion === output.packageVersion);
      if (!samePackage) {
        continue;
      }
      const base = evidenceState(output, metadata, { historical: true });
      addFinding(
        findings,
        createFinding({
          type: 'deprecated-package',
          output,
          state: samePackage && isVerifiedEvidence(metadata) ? base.state : 'suspected',
          confidence: samePackage && isVerifiedEvidence(metadata) ? base.confidence : 'medium',
          severity: 'high',
          title: `${output.outputId} selected a package version already marked deprecated when selected.`,
          eventIds: [output.id, metadata.id],
          evidence: [
            {
              kind: 'package-selection',
              packageName: output.packageName,
              packageVersion: output.packageVersion,
            },
            {
              kind: 'package-metadata',
              eventId: metadata.id,
              effectiveAt: metadata.effectiveAt ?? metadata.at,
              replacement: metadata.replacement,
              validationRef: metadata.validationRef,
            },
          ],
          missingEvidence: base.missing,
          recommendation:
            'Replace the deprecated package with the approved maintained alternative and verify compatibility.',
        }),
      );
    }

    for (const violation of related.filter((event) => event.type === 'policy-violation')) {
      const confirmed =
        isVerifiedEvidence(violation) &&
        violation.policyId.length > 0 &&
        violation.validationRef.length > 0;
      addFinding(
        findings,
        createFinding({
          type: 'unsafe-suggestion',
          output,
          state: confirmed && isAttributableOutput(output) ? 'detected' : 'suspected',
          confidence: confirmed && isAttributableOutput(output) ? 'high' : 'medium',
          severity: violation.severity === 'medium' ? 'high' : violation.severity,
          title: `${output.outputId} produced a suggestion confirmed to violate an applicable safety or security policy.`,
          eventIds: [output.id, violation.id],
          evidence: [
            {
              kind: 'policy-violation',
              eventId: violation.id,
              policyId: violation.policyId,
              validationKind: violation.validationKind,
              validationRef: violation.validationRef,
            },
          ],
          missingEvidence: confirmed
            ? missingProvenance
            : [...missingProvenance, 'confirmed-policy-id-and-validation-reference'],
          recommendation:
            'Reject the unsafe suggestion, preserve the policy evidence, and add a prevention or review control.',
        }),
      );
    }

    const copyRecords = related.filter(
      (event) => event.type === 'copy-provenance' && event.copiedFrom.length > 0,
    );
    const copyDefects = related.filter(
      (event) =>
        ['copy-validation', 'correction'].includes(event.type) &&
        event.staleIdentifiers.length > 0 &&
        (isVerifiedEvidence(event) || event.confirmsMistake === true),
    );
    for (const provenance of copyRecords) {
      for (const defect of copyDefects) {
        const confirmedProvenance = isVerifiedEvidence(provenance);
        const confirmed = confirmedProvenance && isAttributableOutput(output);
        addFinding(
          findings,
          createFinding({
            type: 'copy-paste-bug',
            output,
            state: confirmed ? 'detected' : 'suspected',
            confidence: confirmed ? 'high' : 'medium',
            severity: 'high',
            title: `${output.outputId} retained stale context from copied material.`,
            eventIds: [output.id, provenance.id, defect.id],
            evidence: [
              {
                kind: 'copy-provenance',
                eventId: provenance.id,
                copiedFrom: provenance.copiedFrom,
              },
              {
                kind: 'stale-context',
                eventId: defect.id,
                staleIdentifiers: defect.staleIdentifiers,
                validationRef: defect.validationRef,
              },
            ],
            missingEvidence: confirmedProvenance
              ? missingProvenance
              : [...missingProvenance, 'verified-copy-provenance'],
            recommendation:
              'Replace stale identifiers and add a regression proving the copied context was fully adapted.',
          }),
        );
      }
    }

    for (const analysis of related.filter(
      (event) =>
        event.type === 'static-analysis' &&
        ['dead', 'unused', 'unreachable'].includes(event.status),
    )) {
      const attributableGeneratedCode = output.generated === true || analysis.generated === true;
      const confirmed =
        attributableGeneratedCode &&
        analysis.validationRef.length > 0 &&
        isVerifiedEvidence(analysis);
      addFinding(
        findings,
        createFinding({
          type: 'generated-dead-code',
          output,
          state: confirmed && isAttributableOutput(output) ? 'detected' : 'suspected',
          confidence: confirmed && isAttributableOutput(output) ? 'high' : 'medium',
          severity: 'medium',
          title: `${output.outputId} generated code confirmed as unused, unreachable or dead.`,
          eventIds: [output.id, analysis.id],
          evidence: [
            {
              kind: 'static-analysis',
              eventId: analysis.id,
              status: analysis.status,
              validationCode: analysis.validationCode,
              validationRef: analysis.validationRef,
            },
          ],
          missingEvidence: confirmed
            ? missingProvenance
            : [...missingProvenance, 'generated-code-attribution-and-static-analysis-reference'],
          recommendation:
            'Remove the dead generated code and add reachability or usage coverage where the behavior is required.',
        }),
      );
    }
  }

  applyFindingLifecycle(findings, events);
  const outputById = new Map(outputs.map((output) => [output.outputId, output]));
  const blockers = findings.filter((finding) =>
    canBlockFinding(finding, outputById.get(finding.outputId)),
  );
  const suspected = findings.filter((finding) => finding.state === 'suspected' && !finding.waived);
  const unresolvedDetected = findings.filter(
    (finding) => finding.state === 'detected' && !finding.waived,
  );
  const status =
    blockers.length > 0
      ? 'detected'
      : unresolvedDetected.length > 0 || suspected.length > 0
        ? 'suspected'
        : notices.length > 0
          ? 'insufficient-evidence'
          : 'clear';

  return {
    schemaVersion: 1,
    phase,
    status,
    findings,
    notices,
    blockers,
    summary: {
      outputs: outputs.length,
      findings: findings.length,
      blockers: blockers.length,
      suspected: suspected.length,
      resolved: findings.filter((finding) => finding.state === 'resolved').length,
      waived: findings.filter((finding) => finding.waived).length,
    },
  };
}
