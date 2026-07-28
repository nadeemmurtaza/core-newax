import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildInventory, serializeInventory } from './inventory.mjs';
import { renderHtml } from './render.mjs';

export { buildInventory, serializeInventory } from './inventory.mjs';
export {
  detectGlobalPrefix,
  parseControllersFromFiles,
  parseMigrations,
  parseModuleRegistry,
  parsePrismaSchema,
} from './parsers.mjs';
export { renderHtml, safeJsonForHtml } from './render.mjs';

const DEFAULT_OUTPUT = 'docs/generated/database-registry';
const normalizePath = (path) => path.split(sep).join('/');

function parseArguments(argv) {
  const options = {
    root: process.cwd(),
    output: DEFAULT_OUTPUT,
    mode: 'snapshot',
    action: 'write',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--root') {
      options.root = argv[++index];
    } else if (argument === '--output') {
      options.output = argv[++index];
    } else if (argument === '--mode') {
      options.mode = argv[++index];
    } else if (argument === '--check') {
      options.action = 'check';
    } else if (argument === '--write') {
      options.action = 'write';
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!['snapshot', 'publish'].includes(options.mode)) {
    throw new Error(`Unsupported mode: ${options.mode}`);
  }
  return options;
}

function outputFiles(inventory) {
  return {
    'index.html': renderHtml(inventory),
    'inventory.json': serializeInventory(inventory),
    '.nojekyll': '',
  };
}

function writeOutputs(outputDirectory, files) {
  mkdirSync(outputDirectory, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const path = join(outputDirectory, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, 'utf8');
  }
}

function checkOutputs(outputDirectory, files) {
  const mismatches = [];
  for (const [name, expected] of Object.entries(files)) {
    const path = join(outputDirectory, name);
    if (!existsSync(path)) {
      mismatches.push(`${name} is missing`);
    } else if (readFileSync(path, 'utf8') !== expected) {
      mismatches.push(`${name} is stale`);
    }
  }
  if (mismatches.length) {
    throw new Error(`Database Registry outputs are not current:\n- ${mismatches.join('\n- ')}`);
  }
}

export async function run(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const root = resolve(options.root);
  const outputDirectory = resolve(root, options.output);
  const inventory = await buildInventory({ root, mode: options.mode });
  const files = outputFiles(inventory);
  if (options.action === 'check') {
    checkOutputs(outputDirectory, files);
    console.log(
      `Database Registry outputs are current: ${normalizePath(relative(root, outputDirectory))}`,
    );
  } else {
    writeOutputs(outputDirectory, files);
    console.log(`Database Registry generated: ${normalizePath(relative(root, outputDirectory))}`);
    console.log(
      `Models: ${inventory.database.modelCount}; modules: ${inventory.registry.modules.length}; endpoints: ${inventory.api.endpointCount}; migrations: ${inventory.database.migrations.length}`,
    );
  }
  return inventory;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
