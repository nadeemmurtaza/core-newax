import {
  buildExecutiveDashboard,
  validateExecutiveDashboardSnapshot,
} from './executive-dashboard.mjs';
import { stableDashboardStringify } from './executive-dashboard-normalization.mjs';

const INPUT_MARKER = 'newax-executive-dashboard-input';
const SNAPSHOT_MARKER = 'newax-executive-dashboard-snapshot';

function parseJsonMarkers(body, marker) {
  const expression = new RegExp(`<!-- ${marker}\\n([\\s\\S]*?)\\n-->`, 'g');
  return [...String(body ?? '').matchAll(expression)].map((match) => {
    try {
      return JSON.parse(match[1]);
    } catch (error) {
      return { parseError: String(error), raw: match[1] };
    }
  });
}

export function renderExecutiveDashboardInputRecord(recordId, input) {
  if (!String(recordId ?? '').trim()) {
    throw new TypeError('Dashboard record ID is required.');
  }
  const record = { recordId: String(recordId).trim(), input };
  return `<!-- ${INPUT_MARKER}\n${stableDashboardStringify(record, 2)}\n-->`;
}

export function renderExecutiveDashboardSnapshotRecord(recordId, input) {
  if (!String(recordId ?? '').trim()) {
    throw new TypeError('Dashboard record ID is required.');
  }
  const snapshot = buildExecutiveDashboard(input);
  const record = {
    recordId: String(recordId).trim(),
    schemaVersion: snapshot.schemaVersion,
    policyVersion: snapshot.policyVersion,
    inputDigest: snapshot.inputDigest,
    snapshotDigest: snapshot.digest,
  };
  return `<!-- ${SNAPSHOT_MARKER}\n${stableDashboardStringify(record, 2)}\n-->`;
}

export function parseExecutiveDashboardInputRecords(body) {
  return parseJsonMarkers(body, INPUT_MARKER);
}

export function parseExecutiveDashboardSnapshotRecords(body) {
  return parseJsonMarkers(body, SNAPSHOT_MARKER);
}

export function collectExecutiveDashboardRecords(issue, comments = []) {
  const inputs = [
    ...parseExecutiveDashboardInputRecords(issue?.body ?? ''),
    ...comments.flatMap((comment) => parseExecutiveDashboardInputRecords(comment.body ?? '')),
  ];
  const snapshots = [
    ...parseExecutiveDashboardSnapshotRecords(issue?.body ?? ''),
    ...comments.flatMap((comment) => parseExecutiveDashboardSnapshotRecords(comment.body ?? '')),
  ];
  const latestInputs = new Map();
  const latestSnapshots = new Map();
  for (const record of inputs) {
    latestInputs.set(record.recordId, record);
  }
  for (const record of snapshots) {
    latestSnapshots.set(record.recordId, record);
  }
  return [...latestInputs.values()].map((inputRecord) => ({
    inputRecord,
    snapshotRecord: latestSnapshots.get(inputRecord.recordId) ?? null,
  }));
}

export function validateExecutiveDashboardRecordPair(pair) {
  const errors = [];
  const inputRecord = pair?.inputRecord;
  const snapshotRecord = pair?.snapshotRecord;
  if (inputRecord?.parseError) {
    return [`Dashboard input JSON is invalid: ${inputRecord.parseError}`];
  }
  if (!inputRecord?.recordId) {
    errors.push('Dashboard input recordId is missing.');
  }
  if (inputRecord?.input === null || typeof inputRecord?.input !== 'object') {
    errors.push('Dashboard input object is missing.');
  }
  if (snapshotRecord === null || snapshotRecord === undefined) {
    errors.push(`Dashboard snapshot is missing for ${inputRecord?.recordId ?? 'unknown record'}.`);
    return errors;
  }
  if (snapshotRecord.parseError) {
    errors.push(`Dashboard snapshot JSON is invalid: ${snapshotRecord.parseError}`);
    return errors;
  }
  if (snapshotRecord.recordId !== inputRecord.recordId) {
    errors.push('Dashboard snapshot recordId does not match its input record.');
  }
  if (inputRecord?.input) {
    const expected = buildExecutiveDashboard(inputRecord.input);
    if (snapshotRecord.snapshot) {
      errors.push(
        ...validateExecutiveDashboardSnapshot(inputRecord.input, snapshotRecord.snapshot),
      );
    } else {
      if (snapshotRecord.schemaVersion !== expected.schemaVersion) {
        errors.push('Dashboard receipt schema version is stale.');
      }
      if (snapshotRecord.policyVersion !== expected.policyVersion) {
        errors.push('Dashboard receipt policy version is stale.');
      }
      if (snapshotRecord.inputDigest !== expected.inputDigest) {
        errors.push('Dashboard receipt input digest does not match.');
      }
      if (snapshotRecord.snapshotDigest !== expected.digest) {
        errors.push('Dashboard receipt snapshot digest does not match.');
      }
    }
  }
  return errors;
}
