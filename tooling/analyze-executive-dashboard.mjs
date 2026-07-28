#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildExecutiveDashboard } from './executive-dashboard.mjs';
import { collectExecutiveDashboardGithub } from './executive-dashboard-history-github.mjs';
import {
  renderExecutiveDashboardHtml,
  renderExecutiveDashboardMarkdown,
} from './executive-dashboard-renderer.mjs';
import { stableDashboardStringify } from './executive-dashboard-normalization.mjs';

function args(values) {
  const result = { period: 'week', windowDays: 90, minimumObservationDays: 14 };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const next = values[index + 1];
    if (value === '--file') {
      result.file = next;
      index += 1;
    } else if (value === '--github') {
      result.github = true;
    } else if (value === '--output') {
      result.output = next;
      index += 1;
    } else if (value === '--json') {
      result.json = next;
      index += 1;
    } else if (value === '--period') {
      result.period = next;
      index += 1;
    } else if (value === '--window-days') {
      result.windowDays = Number(next);
      index += 1;
    } else if (value === '--window-start') {
      result.windowStart = next;
      index += 1;
    } else if (value === '--window-end') {
      result.windowEnd = next;
      index += 1;
    } else if (value === '--snapshot-at') {
      result.snapshotAt = next;
      index += 1;
    } else if (value === '--minimum-observation-days') {
      result.minimumObservationDays = Number(next);
      index += 1;
    } else if (value === '--markdown') {
      result.markdown = true;
    } else {
      throw new TypeError(`Unknown argument: ${value}`);
    }
  }
  return result;
}

function write(path, content) {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, 'utf8');
}

async function inputFromOptions(options) {
  if (options.file) {
    return JSON.parse(readFileSync(resolve(options.file), 'utf8'));
  }
  if (!options.github) {
    throw new TypeError('Use --file or --github.');
  }
  const { githubRequest } = await import('./engineering-learning-core.mjs');
  const evidence = await collectExecutiveDashboardGithub({
    request: (path) => githubRequest(path),
  });
  const snapshotAt = new Date(options.snapshotAt ?? Date.now()).toISOString();
  const windowEnd = new Date(options.windowEnd ?? snapshotAt).toISOString();
  const windowStart = new Date(
    options.windowStart ?? Date.parse(windowEnd) - options.windowDays * 86_400_000,
  ).toISOString();
  return {
    ...evidence,
    snapshotAt,
    windowStart,
    windowEnd,
    period: options.period,
    minimumObservationDays: options.minimumObservationDays,
  };
}

export async function runExecutiveDashboardCli(argv = process.argv.slice(2)) {
  const options = args(argv);
  const input = await inputFromOptions(options);
  const snapshot = buildExecutiveDashboard(input);
  const html = renderExecutiveDashboardHtml(snapshot);
  const json = `${stableDashboardStringify(snapshot, 2)}\n`;
  if (options.output) {
    write(options.output, html);
  }
  if (options.json) {
    write(options.json, json);
  }
  const stdout = options.markdown
    ? renderExecutiveDashboardMarkdown(snapshot)
    : options.output || options.json
      ? `Executive dashboard generated: ${snapshot.digest}\n`
      : json;
  process.stdout.write(stdout);
  return snapshot;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runExecutiveDashboardCli();
}
