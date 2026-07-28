import { sanitizeEngineeringEvidence } from './sanitize-engineering-evidence.mjs';

export const ERROR_GRAPH_EDGE_TYPES = new Set([
  'causes',
  'contributes-to',
  'blocks',
  'correlates-with',
]);
export const ERROR_GRAPH_CAUSAL_EDGE_TYPES = new Set(['causes', 'contributes-to', 'blocks']);
export const ERROR_GRAPH_STATUSES = new Set(['candidate', 'machine-supported', 'confirmed']);
export const ERROR_GRAPH_VERIFIED_STATUSES = new Set(['machine-supported', 'confirmed']);

const MAX_RELATIONSHIPS = 50;
const MAX_IMPACTS = 50;
const MAX_EVIDENCE_ITEMS = 20;
const MAX_TEXT = 500;

export function cleanGraphText(value, field, maximum = MAX_TEXT) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new TypeError(`${field} must be a string when supplied.`);
  }
  const text = sanitizeEngineeringEvidence(value).replaceAll(/\s+/g, ' ').trim();
  if (text.length === 0) {
    return null;
  }
  if (text.length > maximum) {
    throw new RangeError(`${field} exceeds ${maximum} characters.`);
  }
  return text;
}

export function cleanGraphArray(value, field, maximum = MAX_EVIDENCE_ITEMS) {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  const values = Array.isArray(value) ? value : [value];
  if (values.length > maximum) {
    throw new RangeError(`${field} supports at most ${maximum} values.`);
  }
  return Array.from(
    new Set(values.map((item) => cleanGraphText(String(item), field, 2_000)).filter(Boolean)),
  );
}

export function normalizeGraphStatus(value, field = 'status') {
  const status = cleanGraphText(value ?? 'candidate', field, 40)?.toLowerCase() ?? 'candidate';
  if (!ERROR_GRAPH_STATUSES.has(status)) {
    throw new TypeError(`Unsupported ${field}: ${status}.`);
  }
  return status;
}

export function normalizeGraphEdgeType(value, field = 'relationship type') {
  const type = cleanGraphText(value ?? 'causes', field, 80)?.toLowerCase() ?? 'causes';
  if (!ERROR_GRAPH_EDGE_TYPES.has(type)) {
    throw new TypeError(`Unsupported ${field}: ${type}.`);
  }
  return type;
}

function uniqueReference(hint) {
  const references = [
    ['parentNodeId', hint.parentNodeId ?? hint.parent_node_id],
    ['parentFingerprint', hint.parentFingerprint ?? hint.parent_fingerprint],
    ['parentRootCauseId', hint.parentRootCauseId ?? hint.parent_root_cause_id],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (references.length !== 1) {
    throw new TypeError(
      'Each relationship hint must provide exactly one parentNodeId, parentFingerprint, or parentRootCauseId.',
    );
  }
  return references[0];
}

export function normalizeRelationshipHints(value) {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new TypeError('relationshipHints must be an array when supplied.');
  }
  if (value.length > MAX_RELATIONSHIPS) {
    throw new RangeError(`relationshipHints supports at most ${MAX_RELATIONSHIPS} relationships.`);
  }
  return value.map((raw, index) => {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new TypeError(`relationshipHints[${index}] must be an object.`);
    }
    const [referenceType, referenceValue] = uniqueReference(raw);
    return {
      referenceType,
      referenceValue: cleanGraphText(
        referenceValue,
        `relationshipHints[${index}].${referenceType}`,
        500,
      ),
      type: normalizeGraphEdgeType(
        raw.type ?? raw.relationship,
        `relationshipHints[${index}].type`,
      ),
      status: normalizeGraphStatus(raw.status, `relationshipHints[${index}].status`),
      evidence: cleanGraphArray(raw.evidence, `relationshipHints[${index}].evidence`),
    };
  });
}

export function normalizeErrorImpacts(value) {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new TypeError('impacts must be an array when supplied.');
  }
  if (value.length > MAX_IMPACTS) {
    throw new RangeError(`impacts supports at most ${MAX_IMPACTS} values.`);
  }
  const ids = new Set();
  return value.map((raw, index) => {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new TypeError(`impacts[${index}] must be an object.`);
    }
    const id = cleanGraphText(raw.id, `impacts[${index}].id`, 160);
    if (id === null) {
      throw new TypeError(`impacts[${index}].id is required.`);
    }
    if (ids.has(id)) {
      throw new TypeError(`Duplicate impact ID: ${id}.`);
    }
    ids.add(id);
    return {
      id,
      kind: cleanGraphText(raw.kind ?? 'operational-impact', `impacts[${index}].kind`, 120),
      label: cleanGraphText(raw.label ?? id, `impacts[${index}].label`, 500),
      parentImpactId: cleanGraphText(
        raw.parentImpactId ?? raw.parent_impact_id,
        `impacts[${index}].parentImpactId`,
        160,
      ),
      type: normalizeGraphEdgeType(
        raw.type ?? raw.relationship ?? 'causes',
        `impacts[${index}].type`,
      ),
      status: normalizeGraphStatus(raw.status ?? 'machine-supported', `impacts[${index}].status`),
      evidence: cleanGraphArray(raw.evidence, `impacts[${index}].evidence`),
    };
  });
}

export function occurrenceNodeIdForEvent(event) {
  const fingerprint = cleanGraphText(event?.fingerprint, 'fingerprint', 500);
  if (fingerprint === null) {
    throw new TypeError('An engineering event requires a fingerprint for graph construction.');
  }
  return `occurrence:${fingerprint}`;
}

export function causeNodeIdForRootCause(rootCauseId) {
  const id = cleanGraphText(rootCauseId, 'rootCauseId', 500);
  if (id === null) {
    throw new TypeError('rootCauseId is required for a cause node.');
  }
  return `cause:${id}`;
}

export function impactNodeIdForEvent(event, impactId) {
  return `${occurrenceNodeIdForEvent(event)}:impact:${encodeURIComponent(impactId)}`;
}
