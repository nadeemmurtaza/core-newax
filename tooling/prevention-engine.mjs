import {
  EXECUTABLE_CONTROL_TYPES,
  PREVENTION_CONTROL_TYPES,
  assertDeclarativeDefinition,
  contentDigest,
  controlId,
  controlTargetPath,
  hasExecutableImplementation,
  normalizeMistake,
  normalizeString,
  resolutionEvidence,
  stableStringify,
  uniqueStrings,
  validSupersession,
} from './prevention-engine-support.mjs';

function defaultDefinition(type, mistake) {
  const common = {
    rootCauseId: mistake.rootCauseId,
    lesson: mistake.preventionControl,
    category: mistake.category,
  };
  const definitions = {
    'ci-check': {
      ...common,
      kind: 'prevention-pack-current',
      assertion: 'required-control-pack-matches-resolved-learning-evidence',
    },
    'pr-checklist': {
      ...common,
      item: `Confirm this change follows the prevention control for ${mistake.rootCauseId}: ${mistake.preventionControl}`,
    },
    'review-checklist': {
      ...common,
      item: `Verify evidence that ${mistake.rootCauseId} cannot recur through this change.`,
    },
    'coding-standard': {
      ...common,
      rule: mistake.preventionControl,
      unsuccessfulMethod: mistake.unsuccessfulMethod,
      successfulMethod: mistake.successfulMethod,
    },
    'verification-rule': {
      ...common,
      kind: 'required-evidence',
      required: ['exact-fix-commit', 'reviewer', 'regression-evidence', 'verification-evidence'],
    },
    'static-analysis-rule': {
      ...common,
      kind: 'review-required',
      selector: { category: mistake.category, rootCauseId: mistake.rootCauseId },
      assertion: 'a bounded machine predicate must be approved before enforcement',
    },
    'test-template': {
      ...common,
      title: `Regression for ${mistake.rootCauseId}`,
      arrange: 'Reproduce the smallest evidence-backed precondition for the resolved mistake.',
      act: 'Execute the corrected path.',
      assert: 'Prove the original failure cannot recur and the intended behavior remains intact.',
    },
  };
  return definitions[type];
}

function occurrenceFromMistake(mistake) {
  return {
    id: mistake.id,
    issueNumber: mistake.issueNumber,
    resolvedAt: mistake.resolvedAt,
    fixCommit: mistake.fixCommit,
    evidenceRefs: uniqueStrings([
      ...mistake.evidenceRefs,
      ...mistake.verificationRefs,
      ...mistake.regressionRefs,
    ]),
  };
}

function sameOccurrence(left, right) {
  return left.id === right.id && left.fixCommit === right.fixCommit;
}

function mergeOccurrences(existing, next) {
  const values = Array.isArray(existing) ? [...existing] : [];
  if (!values.some((entry) => sameOccurrence(entry, next))) {
    values.push(next);
  }
  return values.sort((left, right) => {
    const time = Date.parse(left.resolvedAt) - Date.parse(right.resolvedAt);
    return Number.isFinite(time) && time !== 0 ? time : left.id.localeCompare(right.id);
  });
}

function controlState(type, override) {
  if (!EXECUTABLE_CONTROL_TYPES.has(type)) {
    return 'generated';
  }
  return hasExecutableImplementation(override) ? 'enforced' : 'candidate';
}

function normalizeOverride(type, override = {}) {
  const definition = override.definition ?? null;
  if (definition !== null && EXECUTABLE_CONTROL_TYPES.has(type)) {
    assertDeclarativeDefinition(type, definition);
  }
  return {
    owner: normalizeString(override.owner),
    reviewer: normalizeString(override.reviewer),
    implementationRef: normalizeString(override.implementationRef),
    verificationRefs: uniqueStrings(override.verificationRefs),
    definition,
    supersession: override.supersession ?? null,
  };
}

function buildControl(mistake, type, existingControl, overrideInput) {
  const override = normalizeOverride(type, overrideInput);
  const desiredState = controlState(type, override);
  const existingIsEnforced = existingControl?.state === 'enforced';
  const hasSupersession = validSupersession(override.supersession ?? {});
  const preserveEnforcedControl = existingIsEnforced && !hasSupersession;
  const supersession = hasSupersession
    ? {
        approver: normalizeString(override.supersession.approver),
        reason: normalizeString(override.supersession.reason),
        effectiveAt: normalizeString(override.supersession.effectiveAt),
      }
    : null;
  const state = preserveEnforcedControl ? 'enforced' : desiredState;
  const definition = preserveEnforcedControl
    ? existingControl.definition
    : (override.definition ?? defaultDefinition(type, mistake));
  if (EXECUTABLE_CONTROL_TYPES.has(type)) {
    assertDeclarativeDefinition(type, definition);
  }
  const draft = {
    id: controlId(mistake.rootCauseId, type),
    type,
    targetPath: controlTargetPath(mistake.rootCauseId, type),
    state,
    owner: preserveEnforcedControl
      ? existingControl.owner
      : override.owner || existingControl?.owner || null,
    reviewer: preserveEnforcedControl
      ? existingControl.reviewer
      : override.reviewer || existingControl?.reviewer || null,
    implementationRef: preserveEnforcedControl
      ? existingControl.implementationRef
      : override.implementationRef || existingControl?.implementationRef || null,
    verificationRefs: uniqueStrings([
      ...(existingControl?.verificationRefs ?? []),
      ...override.verificationRefs,
    ]),
    definition,
    supersession,
  };
  return { ...draft, digest: contentDigest(draft) };
}

function controlMap(pack) {
  return new Map((pack?.controls ?? []).map((control) => [control.type, control]));
}

export function buildOrUpdatePreventionPack(mistakeInput, existingPack = null, options = {}) {
  const evidence = resolutionEvidence(mistakeInput);
  if (!evidence.ready) {
    return {
      status: 'insufficient-evidence',
      missingEvidence: evidence.missing,
      mistake: evidence.mistake,
      pack: null,
    };
  }
  const mistake = evidence.mistake;
  if (existingPack !== null && existingPack.rootCauseId !== mistake.rootCauseId) {
    throw new TypeError('Existing prevention pack belongs to a different root cause.');
  }
  const existingControls = controlMap(existingPack);
  const overrides = options.controls ?? {};
  const controls = PREVENTION_CONTROL_TYPES.map((type) =>
    buildControl(mistake, type, existingControls.get(type), overrides[type] ?? {}),
  );
  const occurrences = mergeOccurrences(existingPack?.occurrences, occurrenceFromMistake(mistake));
  const core = {
    schemaVersion: 1,
    id: `PACK-${mistake.rootCauseId}`,
    rootCauseId: mistake.rootCauseId,
    ledgerEntry: mistake.ledgerEntry || existingPack?.ledgerEntry || null,
    category: mistake.category,
    lesson: {
      unsuccessfulMethod: mistake.unsuccessfulMethod,
      successfulMethod: mistake.successfulMethod,
      preventionControl: mistake.preventionControl,
    },
    occurrences,
    controls,
  };
  const comparableExisting =
    existingPack === null ? null : { ...existingPack, revision: undefined, digest: undefined };
  const comparableNext = { ...core, revision: undefined, digest: undefined };
  const unchanged =
    comparableExisting !== null &&
    stableStringify(comparableExisting, 0) === stableStringify(comparableNext, 0);
  const revision = unchanged ? existingPack.revision : (existingPack?.revision ?? 0) + 1;
  const pack = { ...core, revision };
  pack.digest = contentDigest(pack);
  return {
    status: 'ready',
    missingEvidence: [],
    mistake,
    pack,
    changed: !unchanged,
  };
}

export function validatePreventionPack(pack) {
  const errors = [];
  if (pack === null || typeof pack !== 'object') {
    return ['Prevention pack is missing.'];
  }
  const controls = Array.isArray(pack.controls) ? pack.controls : [];
  const byType = new Map();
  for (const control of controls) {
    if (byType.has(control.type)) {
      errors.push(`Duplicate prevention control type: ${control.type}.`);
    }
    byType.set(control.type, control);
  }
  for (const type of PREVENTION_CONTROL_TYPES) {
    const control = byType.get(type);
    if (control === undefined) {
      errors.push(`Missing prevention control type: ${type}.`);
      continue;
    }
    const expectedPath = controlTargetPath(pack.rootCauseId, type);
    if (control.targetPath !== expectedPath) {
      errors.push(`${type} target path must be ${expectedPath}.`);
    }
    if (EXECUTABLE_CONTROL_TYPES.has(type)) {
      try {
        assertDeclarativeDefinition(type, control.definition);
      } catch (error) {
        errors.push(String(error.message ?? error));
      }
      if (control.state === 'enforced' && !hasExecutableImplementation(control)) {
        errors.push(
          `${type} cannot be enforced without owner, reviewer, implementation and verification evidence.`,
        );
      }
    }
  }
  if (!Number.isInteger(pack.revision) || pack.revision < 1) {
    errors.push('Revision must be a positive integer.');
  }
  if (!Array.isArray(pack.occurrences) || pack.occurrences.length === 0) {
    errors.push('At least one resolved occurrence is required.');
  }
  return errors;
}

export function buildPreventionRegistry(mistakes, existingPacks = [], options = {}) {
  const packs = new Map(existingPacks.map((pack) => [pack.rootCauseId, pack]));
  const results = [];
  const orderedMistakes = [...mistakes].sort((left, right) => {
    const leftTime = Date.parse(normalizeMistake(left).resolvedAt);
    const rightTime = Date.parse(normalizeMistake(right).resolvedAt);
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return normalizeMistake(left).id.localeCompare(normalizeMistake(right).id);
  });
  for (const input of orderedMistakes) {
    const normalized = normalizeMistake(input);
    const result = buildOrUpdatePreventionPack(
      normalized,
      packs.get(normalized.rootCauseId) ?? null,
      options[normalized.rootCauseId] ?? {},
    );
    results.push(result);
    if (result.pack !== null) {
      packs.set(result.pack.rootCauseId, result.pack);
    }
  }
  return {
    results,
    packs: [...packs.values()].sort((left, right) =>
      left.rootCauseId.localeCompare(right.rootCauseId),
    ),
  };
}
