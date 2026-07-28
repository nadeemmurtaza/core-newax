import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const validBody = `## Scope
## Acceptance criteria
## Verification
- Head commit: pending
- Exact-head CI: pending
## Engineering learning record
- Ledger entries: not-required
- Learning issues: not-required
- Root-cause status: not-required
- Root-cause evidence: not-required
- Resolution evidence: not-required
- Successful method used: documented
- Unsuccessful method avoided: documented
- New prevention control: not-required
- Ledger consulted before implementation: yes
- Failure history reconciled: yes
- External and tool events reconciled: yes
## Repository freeze and evidence
- Repository-content freeze: active
- Source file contains the workflow run that verifies itself: no
- Repository file action used for pull-request metadata: no
## Known issues
## Merge policy`;

function run(body) {
  const directory = mkdtempSync(join(tmpdir(), 'newax-governance-'));
  const eventPath = join(directory, 'event.json');
  writeFileSync(eventPath, JSON.stringify({ pull_request: { body } }));
  return spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./verify-pr-governance.mjs', import.meta.url))],
    {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_EVENT_PATH: eventPath },
    },
  );
}

test('accepts a structurally valid record without an author-selected outcome', () => {
  const result = run(validBody);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /machine-evaluated/);
});

test('rejects a manual Learning outcome none field', () => {
  const result = run(`${validBody}\n- Learning outcome: none`);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /author cannot choose `none`/);
});

test('rejects every manually supplied learning outcome value', () => {
  const result = run(`${validBody}\n- Learning outcome: new`);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Remove the `Learning outcome` field/);
});
