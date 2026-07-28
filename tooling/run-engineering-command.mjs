import { spawn } from 'node:child_process';

import { deliverExternalFailure } from './deliver-engineering-event.mjs';
import { classifyCommandSource } from './external-failure-intake.mjs';

const separatorIndex = process.argv.indexOf('--');
const commandArguments =
  separatorIndex === -1 ? process.argv.slice(2) : process.argv.slice(separatorIndex + 1);
const [command, ...argumentsList] = commandArguments;

if (command === undefined) {
  throw new Error('Usage: node tooling/run-engineering-command.mjs -- <command> [arguments]');
}

const commandText = `${command} ${argumentsList.join(' ')}`.trim();
const output = [];
let launchError = null;
const child = spawn(command, argumentsList, {
  env: process.env,
  shell: process.platform === 'win32',
  stdio: ['inherit', 'pipe', 'pipe'],
});

for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', (chunk) => {
    const text = chunk.toString();
    output.push(text);
    const target = stream === child.stdout ? process.stdout : process.stderr;
    target.write(text);
  });
}

const exitCode = await new Promise((resolve) => {
  child.on('error', (error) => {
    launchError = error;
    output.push(String(error));
    resolve(1);
  });
  child.on('close', (code) => resolve(code ?? 1));
});

if (exitCode !== 0 && process.env.CI !== 'true') {
  const sourceType =
    process.env.ENGINEERING_SOURCE_TYPE ?? classifyCommandSource(command, argumentsList);
  const result = await deliverExternalFailure(
    {
      sourceType,
      environment: process.env.ENGINEERING_ENVIRONMENT ?? 'local',
      severity: 'error',
      sourceId: process.env.ENGINEERING_EVENT_ID,
      repository: process.env.GITHUB_REPOSITORY,
      commitSha: process.env.GITHUB_SHA,
      service: process.env.ENGINEERING_SERVICE,
      component: process.env.ENGINEERING_COMPONENT,
      operation: commandText,
      release: process.env.ENGINEERING_RELEASE,
      summary:
        launchError === null
          ? `Command exited with status ${exitCode}: ${commandText}`
          : `Command could not start: ${commandText}`,
      details: output.join('').slice(-100_000),
    },
    { delivery: 'queue' },
  );
  process.stderr.write(`\nNEWAX engineering failure queued at ${result.path}.\n`);
}

process.exit(exitCode);
