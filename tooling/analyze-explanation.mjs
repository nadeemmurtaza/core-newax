import { readFileSync } from 'node:fs';

import { verifyExplanation } from './explanation-verification.mjs';

function parseArguments(argv) {
  const fileIndex = argv.indexOf('--file');
  if (fileIndex === -1 || fileIndex === argv.length - 1) {
    throw new Error('Usage: pnpm learning:verify-explanation --file <explanation.json>');
  }
  return { file: argv[fileIndex + 1] };
}

try {
  const { file } = parseArguments(process.argv.slice(2));
  const input = JSON.parse(readFileSync(file, 'utf8'));
  const report = verifyExplanation(input);
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'accepted') {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
