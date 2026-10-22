import { buildKnowledgeGraph, validateKnowledgeGraph } from './knowledge-graph.mjs';
import { stableKnowledgeStringify } from './knowledge-graph-normalization.mjs';
import { parseKnowledgeGraphMarker } from './knowledge-graph-renderer.mjs';
import { analyzeKnowledgeHistory } from './knowledge-graph-traversal.mjs';

const INPUT_MARKER = 'newax-knowledge-graph-input';

function parseJsonBlocks(body, marker) {
  const pattern = new RegExp(`<!-- ${marker}\\n([\\s\\S]*?)\\n-->`, 'g');
  return [...String(body ?? '').matchAll(pattern)].map((match) => {
    try {
      return JSON.parse(match[1]);
    } catch (error) {
      return { parseError: String(error), raw: match[1] };
    }
  });
}

function headingValue(body, heading) {
  const lines = String(body ?? '').split('\n');
  const target = `### ${heading}`.toLowerCase();
  const start = lines.findIndex((line) => line.trim().toLowerCase() === target);
  if (start === -1) {
    return '';
  }
  const values = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^###\s+/.test(lines[index].trim())) {
      break;
    }
    values.push(lines[index]);
  }
  return values.join('\n').trim();
}

function parseJsonHeading(body, heading) {
  const value = headingValue(body, heading);
  if (!value) {
    return null;
  }
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim() ?? value;
  try {
    return JSON.parse(fenced);
  } catch (error) {
    return { parseError: String(error), raw: fenced };
  }
}

export function renderKnowledgeGraphInputRecord({
  recordId,
  focusNodeId = null,
  nodes,
  edges,
  source = null,
}) {
  const record = {
    schemaVersion: 1,
    recordId: String(recordId ?? '').trim(),
    focusNodeId: focusNodeId === null ? null : String(focusNodeId).trim(),
    source,
    nodes,
    edges,
  };
  if (!record.recordId) {
    throw new TypeError('Knowledge graph input record requires recordId.');
  }
  buildKnowledgeGraph(nodes, edges, { source });
  return `<!-- ${INPUT_MARKER}\n${stableKnowledgeStringify(record, 2)}\n-->`;
}

export function parseKnowledgeGraphInputRecords(body) {
  const blocks = parseJsonBlocks(body, INPUT_MARKER);
  if (blocks.length > 0) {
    return blocks;
  }
  const graphInput = parseJsonHeading(body, 'Knowledge graph input JSON');
  if (graphInput === null) {
    return [];
  }
  return [
    {
      schemaVersion: 1,
      recordId: headingValue(body, 'Record ID').replaceAll('`', '').trim(),
      focusNodeId: headingValue(body, 'Focus node ID').replaceAll('`', '').trim() || null,
      source:
        graphInput.source ??
        (headingValue(body, 'Source reference').replaceAll('`', '').trim() || null),
      nodes: graphInput.nodes,
      edges: graphInput.edges,
    },
  ];
}

export function collectKnowledgeGraphRecord(issue, comments = []) {
  const inputs = [
    ...parseKnowledgeGraphInputRecords(issue?.body ?? ''),
    ...comments.flatMap((comment) => parseKnowledgeGraphInputRecords(comment.body ?? '')),
  ];
  const rendered = [issue?.body ?? '', ...comments.map((comment) => comment.body ?? '')]
    .map(parseKnowledgeGraphMarker)
    .filter(Boolean);
  return {
    inputRecord: inputs.at(-1) ?? null,
    renderedRecord: rendered.at(-1) ?? null,
  };
}

export function validateKnowledgeGraphRecord(record) {
  const errors = [];
  const input = record?.inputRecord;
  const rendered = record?.renderedRecord;
  if (input === null || input === undefined) {
    return ['Knowledge graph input record is missing.'];
  }
  if (input.parseError) {
    return [`Knowledge graph input JSON is invalid: ${input.parseError}`];
  }
  if (input.schemaVersion !== 1) {
    errors.push('Knowledge graph input schemaVersion must be 1.');
  }
  if (!String(input.recordId ?? '').trim()) {
    errors.push('Knowledge graph recordId is missing.');
  }
  let graph;
  try {
    graph = buildKnowledgeGraph(input.nodes ?? [], input.edges ?? [], {
      source: input.source ?? null,
    });
  } catch (error) {
    errors.push(String(error));
    return errors;
  }
  if (rendered === null || rendered === undefined) {
    errors.push('Rendered knowledge graph section is missing.');
    return errors;
  }
  if (rendered.graph === null) {
    errors.push('Rendered knowledge graph data is invalid.');
    return errors;
  }
  errors.push(...validateKnowledgeGraph(rendered.graph).errors);
  if (rendered.graph.digest !== graph.digest) {
    errors.push('Rendered knowledge graph digest does not match the recalculated input graph.');
  }
  const analysis = analyzeKnowledgeHistory(graph, input.focusNodeId ?? null);
  const claimedStatus = rendered.metadata?.['history-status'];
  if (claimedStatus !== analysis.status) {
    errors.push(`Rendered history status must be ${analysis.status}.`);
  }
  if (claimedStatus === 'complete' && analysis.gaps.length > 0) {
    errors.push('A complete knowledge history cannot contain gaps.');
  }
  return errors;
}
