import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  PREVENTION_CONTROL_TYPES,
  controlTargetPath,
  stableStringify,
} from './prevention-engine-support.mjs';
import { validatePreventionPack } from './prevention-engine.mjs';

function markdownHeader(pack, control, title) {
  return `<!-- newax-prevention-control\npack-id: ${pack.id}\nroot-cause-id: ${pack.rootCauseId}\ncontrol-id: ${control.id}\ncontrol-type: ${control.type}\nrevision: ${pack.revision}\nstate: ${control.state}\ndigest: ${control.digest}\n-->\n# ${title}\n\n- Root cause: \`${pack.rootCauseId}\`\n- Ledger entry: \`${pack.ledgerEntry ?? 'not-recorded'}\`\n- State: \`${control.state}\`\n- Revision: \`${pack.revision}\`\n- Source occurrences: ${pack.occurrences.map((item) => `\`${item.id}\``).join(', ')}\n\n`;
}

function renderMarkdown(pack, control) {
  const definition = control.definition;
  if (control.type === 'pr-checklist') {
    return `${markdownHeader(pack, control, 'Pull Request Prevention Checklist')}## Required item\n\n- [ ] ${definition.item}\n`;
  }
  if (control.type === 'review-checklist') {
    return `${markdownHeader(pack, control, 'Review Prevention Checklist')}## Required reviewer check\n\n- [ ] ${definition.item}\n`;
  }
  if (control.type === 'coding-standard') {
    return `${markdownHeader(pack, control, 'Coding Prevention Standard')}## Rule\n\n${definition.rule}\n\n## Avoid\n\n${definition.unsuccessfulMethod || 'The evidence-backed unsuccessful method recorded by the source lesson.'}\n\n## Required method\n\n${definition.successfulMethod || 'The evidence-backed successful method recorded by the source lesson.'}\n`;
  }
  if (control.type === 'test-template') {
    return `${markdownHeader(pack, control, definition.title)}## Arrange\n\n${definition.arrange}\n\n## Act\n\n${definition.act}\n\n## Assert\n\n${definition.assert}\n`;
  }
  throw new TypeError(`No markdown renderer for ${control.type}.`);
}

function renderJson(pack, control) {
  return `${stableStringify({ schemaVersion: 1, pack, control })}\n`;
}

export function renderPreventionFiles(pack) {
  const errors = validatePreventionPack(pack);
  if (errors.length > 0) {
    throw new TypeError(`Invalid prevention pack:\n- ${errors.join('\n- ')}`);
  }
  const controls = new Map(pack.controls.map((control) => [control.type, control]));
  return PREVENTION_CONTROL_TYPES.map((type) => {
    const control = controls.get(type);
    const content = ['ci-check', 'verification-rule', 'static-analysis-rule'].includes(type)
      ? renderJson(pack, control)
      : renderMarkdown(pack, control);
    return { path: controlTargetPath(pack.rootCauseId, type), content };
  });
}

export function writePreventionFiles(pack, outputRoot = process.cwd()) {
  const files = renderPreventionFiles(pack);
  const temporaryRoot = join(outputRoot, `.prevention-tmp-${process.pid}-${Date.now()}`);
  try {
    for (const file of files) {
      const temporaryPath = join(temporaryRoot, file.path);
      mkdirSync(dirname(temporaryPath), { recursive: true });
      writeFileSync(temporaryPath, file.content, 'utf8');
    }
    for (const file of files) {
      const destination = join(outputRoot, file.path);
      mkdirSync(dirname(destination), { recursive: true });
      renameSync(join(temporaryRoot, file.path), destination);
    }
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
  return files.map((file) => file.path);
}
