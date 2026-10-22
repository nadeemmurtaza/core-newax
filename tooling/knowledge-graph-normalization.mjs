import { createHash } from 'node:crypto';

import {
  KNOWLEDGE_GRAPH_EDGE_STATUSES,
  KNOWLEDGE_GRAPH_EDGE_TYPES,
  KNOWLEDGE_GRAPH_NODE_TYPES,
} from './knowledge-graph-schema.mjs';

const MAX_TEXT = 2_000;
const MAX_ARRAY = 50;
const MAX_METADATA_KEYS = 40;

export function cleanKnowledgeText(value, field = 'value', maximum = MAX_TEXT) {
  if (value === undefined || value === null) {
    return '';
  }
  const normalized = String(value).replaceAll('\u0000', '').trim();
  if (normalized.length > maximum) {
    throw new TypeError(`${field} exceeds ${maximum} characters.`);
  }
  return normalized;
}

export function cleanKnowledgeArray(value, field = 'values') {
  const input = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  if (input.length > MAX_ARRAY) {
    throw new TypeError(`${field} exceeds ${MAX_ARRAY} entries.`);
  }
  return [
    ...new Set(input.map((entry) => cleanKnowledgeText(entry, field)).filter(Boolean)),
  ].sort();
}

export function normalizeKnowledgeMetadata(value, path = 'metadata', depth = 0) {
  if (depth > 3) {
    throw new TypeError(`${path} exceeds the metadata depth limit.`);
  }
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    return typeof value === 'string' ? cleanKnowledgeText(value, path) : value;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY) {
      throw new TypeError(`${path} exceeds ${MAX_ARRAY} entries.`);
    }
    return value.map((entry, index) =>
      normalizeKnowledgeMetadata(entry, `${path}[${index}]`, depth + 1),
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, entry]) => entry !== undefined);
    if (entries.length > MAX_METADATA_KEYS) {
      throw new TypeError(`${path} exceeds ${MAX_METADATA_KEYS} keys.`);
    }
    return Object.fromEntries(
      entries
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [
          cleanKnowledgeText(key, `${path} key`, 100),
          normalizeKnowledgeMetadata(entry, `${path}.${key}`, depth + 1),
        ]),
    );
  }
  throw new TypeError(`${path} contains an unsupported value.`);
}

export function stableKnowledgeValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableKnowledgeValue);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableKnowledgeValue(entry)]),
    );
  }
  return value;
}

export function stableKnowledgeStringify(value, spacing = 0) {
  return JSON.stringify(stableKnowledgeValue(value), null, spacing);
}

export function knowledgeGraphDigest(value) {
  return createHash('sha256').update(stableKnowledgeStringify(value)).digest('hex');
}

function normalizeDate(value, field) {
  const text = cleanKnowledgeText(value, field, 100);
  if (!text) {
    return null;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${field} must be an ISO-compatible timestamp.`);
  }
  return date.toISOString();
}

function normalizeUrl(value, field) {
  const text = cleanKnowledgeText(value, field);
  if (!text) {
    return null;
  }
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new TypeError(`${field} must be a valid URL.`);
  }
  if (parsed.protocol !== 'https:') {
    throw new TypeError(`${field} must use https.`);
  }
  return parsed.toString();
}

export function normalizeKnowledgeNode(value, index = 0) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`nodes[${index}] must be an object.`);
  }
  const id = cleanKnowledgeText(value.id, `nodes[${index}].id`, 500);
  const kind = cleanKnowledgeText(value.kind, `nodes[${index}].kind`, 100).toLowerCase();
  if (!id) {
    throw new TypeError(`nodes[${index}].id is required.`);
  }
  if (!KNOWLEDGE_GRAPH_NODE_TYPES.includes(kind)) {
    throw new TypeError(`nodes[${index}].kind is unsupported: ${kind || 'missing'}.`);
  }
  const url = normalizeUrl(value.url, `nodes[${index}].url`);
  const sourceRef = cleanKnowledgeText(value.sourceRef, `nodes[${index}].sourceRef`, 1_000) || null;
  if (url === null && sourceRef === null) {
    throw new TypeError(`nodes[${index}] requires a durable url or sourceRef.`);
  }
  return {
    id,
    kind,
    label: cleanKnowledgeText(value.label || id, `nodes[${index}].label`, 1_000),
    status: cleanKnowledgeText(
      value.status || 'observed',
      `nodes[${index}].status`,
      100,
    ).toLowerCase(),
    occurredAt: normalizeDate(value.occurredAt, `nodes[${index}].occurredAt`),
    url,
    sourceRef,
    evidenceRefs: cleanKnowledgeArray(value.evidenceRefs, `nodes[${index}].evidenceRefs`),
    metadata: normalizeKnowledgeMetadata(value.metadata ?? {}, `nodes[${index}].metadata`),
  };
}

export function normalizeKnowledgeEdge(value, index = 0) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`edges[${index}] must be an object.`);
  }
  const from = cleanKnowledgeText(value.from, `edges[${index}].from`, 500);
  const to = cleanKnowledgeText(value.to, `edges[${index}].to`, 500);
  const type = cleanKnowledgeText(value.type, `edges[${index}].type`, 100).toLowerCase();
  const status = cleanKnowledgeText(
    value.status || 'candidate',
    `edges[${index}].status`,
    100,
  ).toLowerCase();
  if (!from || !to) {
    throw new TypeError(`edges[${index}] requires from and to.`);
  }
  if (!KNOWLEDGE_GRAPH_EDGE_TYPES.includes(type)) {
    throw new TypeError(`edges[${index}].type is unsupported: ${type || 'missing'}.`);
  }
  if (!KNOWLEDGE_GRAPH_EDGE_STATUSES.includes(status)) {
    throw new TypeError(`edges[${index}].status is unsupported: ${status || 'missing'}.`);
  }
  const provenance = cleanKnowledgeText(value.provenance, `edges[${index}].provenance`, 1_000);
  if (!provenance) {
    throw new TypeError(`edges[${index}].provenance is required.`);
  }
  const normalized = {
    from,
    to,
    type,
    status,
    evidenceRefs: cleanKnowledgeArray(value.evidenceRefs, `edges[${index}].evidenceRefs`),
    provenance,
    occurredAt: normalizeDate(value.occurredAt, `edges[${index}].occurredAt`),
  };
  return {
    id: cleanKnowledgeText(value.id, `edges[${index}].id`, 500) || knowledgeEdgeId(normalized),
    ...normalized,
  };
}

export function knowledgeEdgeId(edge) {
  return `kg-edge-${createHash('sha256')
    .update([edge.from, edge.type, edge.to, edge.status].join('|'))
    .digest('hex')
    .slice(0, 20)}`;
}

export function mergeKnowledgeNode(existing, incoming) {
  if (existing === undefined) {
    return incoming;
  }
  if (existing.kind !== incoming.kind) {
    throw new TypeError(`Knowledge node ${incoming.id} has incompatible kind.`);
  }
  for (const field of ['url', 'sourceRef']) {
    if (
      existing[field] !== null &&
      incoming[field] !== null &&
      existing[field] !== incoming[field]
    ) {
      throw new TypeError(`Knowledge node ${incoming.id} has incompatible ${field}.`);
    }
  }
  return {
    ...existing,
    url: existing.url ?? incoming.url,
    sourceRef: existing.sourceRef ?? incoming.sourceRef,
    label: existing.label.length >= incoming.label.length ? existing.label : incoming.label,
    status: existing.status === incoming.status ? existing.status : 'mixed',
    occurredAt: [existing.occurredAt, incoming.occurredAt].filter(Boolean).sort()[0] ?? null,
    evidenceRefs: [...new Set([...existing.evidenceRefs, ...incoming.evidenceRefs])].sort(),
    metadata: { ...existing.metadata, ...incoming.metadata },
  };
}
