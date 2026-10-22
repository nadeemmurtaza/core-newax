import { renderRecurrenceDecisionRecord } from './recurrence-record.mjs';

function occurrenceLink(occurrence) {
  const label = occurrence.prNumber === null ? occurrence.id : `PR #${occurrence.prNumber}`;
  return occurrence.url ? `[${label}](${occurrence.url})` : `\`${label}\``;
}

export function renderRecurrenceReport(decision) {
  const previous =
    decision.previousOccurrences.length === 0
      ? '- None. This is the first confirmed occurrence.'
      : decision.previousOccurrences
          .map((occurrence) => `- ${occurrenceLink(occurrence)} — ${occurrence.occurredAt}`)
          .join('\n');
  const rule =
    decision.rule === null
      ? '- No applicable effective rule existed before the current occurrence.'
      : `- Rule: \`${decision.rule.id}\`\n- State: \`${decision.rule.state}\`\n- Effective: \`${decision.rule.effectiveAt}\`\n- Source: ${decision.rule.sourceRef ?? 'not supplied'}`;
  const explanation =
    decision.rule === null
      ? '- Not required because no applicable effective rule existed.'
      : decision.explanation === null
        ? '- Missing. Why was the applicable rule not followed?'
        : `- Disposition: \`${decision.explanation.disposition}\`\n- State: \`${decision.explanation.state}\`\n- Reviewer: ${decision.explanation.reviewer ?? 'missing'}\n- Evidence: ${decision.explanation.evidenceRefs.join(', ') || 'missing'}`;
  const missing =
    decision.missingEvidence.length === 0
      ? '- None.'
      : decision.missingEvidence.map((entry) => `- ${entry}`).join('\n');
  return `${renderRecurrenceDecisionRecord(decision)}
## Recurrence detection

> ⚠ Escalation: **${decision.escalation.toUpperCase()}**  
> State: \`${decision.state}\`  
> Root cause: \`${decision.rootCauseId ?? 'none'}\`

### Previous occurrences

${previous}

### Current occurrence

- ${decision.currentOccurrence === null ? 'None.' : occurrenceLink(decision.currentOccurrence)}

### Existing rule

${rule}

### Why was it not followed?

${explanation}

### Counts

- All confirmed occurrences: \`${decision.counts.all}\`
- Previous occurrences: \`${decision.counts.previous}\`
- Pre-rule history: \`${decision.counts.preRule ?? 0}\`
- Post-rule recurrence position: \`${decision.counts.postRule}\`

### Missing evidence

${missing}

- Review-ready blocker: \`${decision.blocker ? 'yes' : 'no'}\`
- Decision digest: \`${decision.digest}\``;
}
