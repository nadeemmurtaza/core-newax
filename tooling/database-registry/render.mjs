import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_DIRECTORY = dirname(fileURLToPath(import.meta.url));

export function safeJsonForHtml(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

export function renderHtml(inventory) {
  const styles = readFileSync(join(SOURCE_DIRECTORY, 'styles.css'), 'utf8');
  const explanationStyles = readFileSync(join(SOURCE_DIRECTORY, 'explain.css'), 'utf8');
  const client = readFileSync(join(SOURCE_DIRECTORY, 'client.js'), 'utf8');
  const explanations = readFileSync(join(SOURCE_DIRECTORY, 'explain.js'), 'utf8');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>NEWAX Core Database Registry</title>
  <style>${styles}\n${explanationStyles}</style>
</head>
<body>
  <header class="hero">
    <div>
      <p class="eyebrow">NEWAX · The Business Infrastructure Company</p>
      <h1>Core Database Registry</h1>
      <p class="lede">A source-backed view of schema, migrations, modules, APIs and delivery boundaries.</p>
    </div>
    <div class="hero-actions">
      <button id="download-inventory" type="button">Download inventory</button>
      <button type="button" onclick="window.print()">Print / Save PDF</button>
    </div>
  </header>

  <main>
    <section class="notice" id="truth-notice"></section>
    <section class="metrics" id="metrics"></section>

    <section class="toolbar" aria-label="Registry controls">
      <input id="global-search" type="search" placeholder="Search modules, tables, APIs or migrations" aria-label="Search registry">
      <nav class="tabs" id="tabs" aria-label="Registry views"></nav>
    </section>

    <section class="panel tab-panel" data-panel="overview">
      <div class="section-heading">
        <div><p class="eyebrow">Architecture</p><h2>Database relationship map</h2></div>
        <div class="zoom-controls"><button id="zoom-out" type="button">−</button><button id="zoom-reset" type="button">100%</button><button id="zoom-in" type="button">+</button></div>
      </div>
      <div class="map-shell"><svg id="database-map" role="img" aria-label="Prisma database relationship map"></svg></div>
      <div class="model-detail" id="model-detail"><p>Select a model to inspect its fields and ownership.</p></div>
      <div class="grid two" id="overview-cards"></div>
    </section>

    <section class="panel tab-panel" data-panel="modules" hidden>
      <div class="section-heading"><div><p class="eyebrow">Governance</p><h2>Module Registry</h2></div><select id="module-filter" aria-label="Filter modules"><option value="all">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="planned">Planned</option></select></div>
      <div class="cards" id="module-cards"></div>
    </section>

    <section class="panel tab-panel" data-panel="models" hidden>
      <div class="section-heading"><div><p class="eyebrow">Schema</p><h2>Prisma models and ownership</h2></div></div>
      <div class="table-wrap"><table><thead><tr><th>Model</th><th>Table</th><th>Owner</th><th>Governance</th><th>Fields</th><th>Relations</th></tr></thead><tbody id="model-rows"></tbody></table></div>
    </section>

    <section class="panel tab-panel" data-panel="apis" hidden>
      <div class="section-heading"><div><p class="eyebrow">Entry points</p><h2>Discovered HTTP APIs</h2></div></div>
      <div class="table-wrap"><table><thead><tr><th>Method</th><th>Path</th><th>Context</th><th>Permissions</th><th>Source</th></tr></thead><tbody id="api-rows"></tbody></table></div>
    </section>

    <section class="panel tab-panel" data-panel="migrations" hidden>
      <div class="section-heading"><div><p class="eyebrow">Database change history</p><h2>Migration definitions</h2></div></div>
      <p class="muted">A migration file being present does not prove it has been applied to a production database.</p>
      <div class="table-wrap"><table><thead><tr><th>Migration</th><th>Operations</th><th>Tables</th><th>Fingerprint</th></tr></thead><tbody id="migration-rows"></tbody></table></div>
    </section>

    <section class="panel tab-panel" data-panel="delivery" hidden>
      <div class="section-heading"><div><p class="eyebrow">Delivery state</p><h2>Built, planned, deferred and open work</h2></div></div>
      <div class="grid two"><div class="subpanel"><h3>Implemented registry modules</h3><div id="implemented-list"></div></div><div class="subpanel"><h3>Planned registry modules</h3><div id="planned-list"></div></div></div>
      <div class="grid two"><div class="subpanel"><h3>Deferred scope</h3><div id="deferred-list"></div></div><div class="subpanel"><h3>Open pull requests</h3><div id="pr-list"></div></div></div>
    </section>
  </main>

  <footer>
    <strong>NEWAX</strong> builds the systems modern organizations depend on.
    <span id="source-footer"></span>
  </footer>

  <script id="registry-inventory" type="application/json">${safeJsonForHtml(inventory)}</script>
  <script>${client}</script>
  <script>${explanations}</script>
</body>
</html>\n`;
}
