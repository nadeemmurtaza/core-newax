(() => {
  'use strict';
  const inventory = JSON.parse(document.getElementById('registry-inventory').textContent);
  const escapeText = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;',
        })[character],
    );
  const statusBadge = (status) =>
    `<span class="badge ${escapeText(status)}">${escapeText(status)}</span>`;
  const itemList = (items, empty) =>
    items.length
      ? items
          .map(
            (item) =>
              `<div class="list-item searchable" data-search="${escapeText(item.search ?? item.title ?? item)}"><strong>${escapeText(item.title ?? item)}</strong>${item.detail ? `<p>${escapeText(item.detail)}</p>` : ''}</div>`,
          )
          .join('')
      : `<p class="empty">${escapeText(empty)}</p>`;

  document.getElementById('truth-notice').innerHTML = Object.entries(inventory.truthModel)
    .map(
      ([key, value]) =>
        `<p><strong>${escapeText(key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`))}:</strong> ${escapeText(value)}</p>`,
    )
    .join('');
  const metrics = [
    [inventory.database.modelCount, 'Prisma models'],
    [inventory.database.relationCount, 'Relations'],
    [inventory.database.migrations.length, 'Migrations'],
    [inventory.registry.modules.length, 'Registry modules'],
    [inventory.api.endpointCount, 'HTTP endpoints'],
    [inventory.delivery.openPullRequests.items.length, 'Open pull requests'],
  ];
  document.getElementById('metrics').innerHTML = metrics
    .map(
      ([value, label]) =>
        `<div class="metric"><strong>${escapeText(value)}</strong><span>${escapeText(label)}</span></div>`,
    )
    .join('');

  const tabs = ['overview', 'modules', 'models', 'apis', 'migrations', 'delivery'];
  const tabRoot = document.getElementById('tabs');
  tabRoot.innerHTML = tabs
    .map(
      (tab, index) =>
        `<button type="button" data-tab="${tab}" aria-selected="${index === 0}">${escapeText(tab[0].toUpperCase() + tab.slice(1))}</button>`,
    )
    .join('');
  tabRoot.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tab]');
    if (!button) {
      return;
    }
    document
      .querySelectorAll('[data-tab]')
      .forEach((candidate) =>
        candidate.setAttribute('aria-selected', String(candidate === button)),
      );
    document.querySelectorAll('[data-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== button.dataset.tab;
    });
  });

  const moduleByKey = new Map(inventory.registry.modules.map((module) => [module.key, module]));
  document.getElementById('overview-cards').innerHTML = `
    <div class="subpanel"><h3>Source identity</h3><p><strong>Repository:</strong> ${escapeText(inventory.source.repository)}</p><p><strong>Branch:</strong> ${escapeText(inventory.source.branch)}</p><p><strong>Commit:</strong> <code>${escapeText(inventory.source.sha)}</code></p><p><strong>Input fingerprint:</strong> <code>${escapeText(inventory.source.inputHash.slice(0, 16))}</code></p></div>
    <div class="subpanel"><h3>Registry governance</h3><p><strong>Version:</strong> ${escapeText(inventory.registry.version)}</p><p><strong>Status:</strong> ${statusBadge(inventory.registry.status)}</p><p><strong>Updated:</strong> ${escapeText(inventory.registry.lastUpdated)}</p><p>${escapeText(inventory.registry.purpose)}</p></div>`;

  const renderModules = () => {
    const filter = document.getElementById('module-filter').value;
    document.getElementById('module-cards').innerHTML = inventory.registry.modules
      .filter((module) => filter === 'all' || module.governanceStatus === filter)
      .map(
        (module) =>
          `<article class="card searchable" data-search="${escapeText([module.name, module.key, module.description, ...module.databaseOwnership, ...module.requiredPermissions].join(' '))}"><div>${statusBadge(module.governanceStatus)} <span class="chip">${escapeText(module.layer)}</span></div><h3>${escapeText(module.name)}</h3><p>${escapeText(module.description)}</p><p><strong>Tables:</strong> ${module.databaseOwnership.length ? module.databaseOwnership.map((table) => `<code>${escapeText(table)}</code>`).join(' ') : 'None'}</p><p><strong>Depends on:</strong> ${module.dependencies.length ? module.dependencies.map((dependency) => escapeText(dependency.key)).join(', ') : 'None'}</p><p><strong>Tenant scope:</strong> ${escapeText(module.tenantScope)}</p></article>`,
      )
      .join('');
  };
  document.getElementById('module-filter').addEventListener('change', renderModules);
  renderModules();

  document.getElementById('model-rows').innerHTML = inventory.database.models
    .map(
      (model) =>
        `<tr class="searchable" data-search="${escapeText([model.name, model.tableName, model.owner.moduleName].join(' '))}"><td><strong>${escapeText(model.name)}</strong></td><td><code>${escapeText(model.tableName)}</code></td><td>${escapeText(model.owner.moduleName)}</td><td>${statusBadge(model.owner.governanceStatus)}</td><td>${model.scalarFieldCount}</td><td>${model.relationFieldCount}</td></tr>`,
    )
    .join('');
  document.getElementById('api-rows').innerHTML = inventory.api.endpoints
    .map(
      (endpoint) =>
        `<tr class="searchable" data-search="${escapeText([endpoint.method, endpoint.path, endpoint.context, ...endpoint.permissions, endpoint.sourcePath].join(' '))}"><td><strong>${escapeText(endpoint.method)}</strong></td><td><code>${escapeText(endpoint.path)}</code></td><td>${escapeText(endpoint.context)}</td><td>${endpoint.permissions.length ? endpoint.permissions.map((permission) => `<code>${escapeText(permission)}</code>`).join(' ') : 'None'}</td><td><code>${escapeText(endpoint.sourcePath)}</code></td></tr>`,
    )
    .join('');
  document.getElementById('migration-rows').innerHTML = inventory.database.migrations
    .map(
      (migration) =>
        `<tr class="searchable" data-search="${escapeText([migration.id, ...migration.tables].join(' '))}"><td><strong>${escapeText(migration.title)}</strong><br><code>${escapeText(migration.id)}</code></td><td>${
          Object.entries(migration.operationCounts)
            .filter(([, count]) => count > 0)
            .map(([operation, count]) => `${escapeText(operation)}: ${count}`)
            .join(' · ') || 'No classified operation'
        }</td><td>${migration.tables.map((table) => `<code>${escapeText(table)}</code>`).join(' ')}</td><td><code>${escapeText(migration.checksum.slice(0, 12))}</code></td></tr>`,
    )
    .join('');

  const implemented = inventory.delivery.implementedModules.map((key) => ({
    title: moduleByKey.get(key)?.name ?? key,
    detail: `Governance: ${moduleByKey.get(key)?.governanceStatus ?? 'unknown'}`,
  }));
  const planned = inventory.delivery.plannedModules.map((key) => ({
    title: moduleByKey.get(key)?.name ?? key,
    detail: moduleByKey.get(key)?.description ?? '',
  }));
  document.getElementById('implemented-list').innerHTML = itemList(
    implemented,
    'No implemented modules detected.',
  );
  document.getElementById('planned-list').innerHTML = itemList(
    planned,
    'No planned modules detected.',
  );
  document.getElementById('deferred-list').innerHTML = itemList(
    inventory.delivery.deferredItems.map((item) => ({
      title: item.moduleName,
      detail: item.text,
      search: `${item.moduleName} ${item.text}`,
    })),
    'No deferred scope statements detected.',
  );
  const pulls = inventory.delivery.openPullRequests.items.map((pull) => ({
    title: `#${pull.number} ${pull.title}`,
    detail: `${pull.base} ← ${pull.head} · ${pull.headSha.slice(0, 10)}`,
    search: `${pull.number} ${pull.title} ${pull.base} ${pull.head}`,
  }));
  document.getElementById('pr-list').innerHTML =
    inventory.delivery.openPullRequests.status === 'available'
      ? itemList(pulls, 'No open pull requests.')
      : `<p class="empty">Open pull requests unavailable: ${escapeText(inventory.delivery.openPullRequests.reason)}</p>`;

  function renderDatabaseMap() {
    const svg = document.getElementById('database-map');
    const groups = new Map();
    inventory.database.models.forEach((model) => {
      const key = model.owner.moduleKey;
      if (!groups.has(key)) {
        groups.set(key, {
          name: model.owner.moduleName,
          status: model.owner.governanceStatus,
          models: [],
        });
      }
      groups.get(key).models.push(model);
    });
    const ordered = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
    const width = 1420,
      groupWidth = 330,
      gap = 25,
      columns = 4,
      nodeHeight = 68,
      nodeGap = 10,
      positions = new Map(),
      parts = [];
    let y = 20;
    const rowHeights = [];
    ordered.forEach((group, index) => {
      const row = Math.floor(index / columns);
      const height = 58 + group.models.length * (nodeHeight + nodeGap);
      group.layout = { row, column: index % columns, height };
      rowHeights[row] = Math.max(rowHeights[row] || 0, height);
    });
    const rowY = [];
    rowHeights.forEach((height, row) => {
      rowY[row] = y;
      y += height + gap;
    });
    ordered.forEach((group) => {
      const x = 20 + group.layout.column * (groupWidth + gap),
        gy = rowY[group.layout.row];
      parts.push(
        `<g><rect x="${x}" y="${gy}" width="${groupWidth}" height="${group.layout.height}" rx="14" fill="#fff" stroke="#d9e0ea"/><text class="map-group-title" x="${x + 14}" y="${gy + 27}">${escapeText(group.name)}</text><text class="map-node-meta" x="${x + groupWidth - 14}" y="${gy + 27}" text-anchor="end">${escapeText(group.status)}</text></g>`,
      );
      group.models
        .sort((a, b) => a.tableName.localeCompare(b.tableName))
        .forEach((model, index) =>
          positions.set(model.name, {
            x: x + 14,
            y: gy + 44 + index * (nodeHeight + nodeGap),
            width: groupWidth - 28,
            height: nodeHeight,
          }),
        );
    });
    inventory.database.relations.forEach((relation) => {
      const source = positions.get(relation.source),
        target = positions.get(relation.target);
      if (!source || !target) {
        return;
      }
      const sx = source.x + source.width / 2,
        sy = source.y + source.height / 2,
        tx = target.x + target.width / 2,
        ty = target.y + target.height / 2,
        mx = (sx + tx) / 2;
      parts.push(
        `<path class="relation-line" d="M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}"/>`,
      );
    });
    inventory.database.models.forEach((model) => {
      const p = positions.get(model.name);
      if (!p) {
        return;
      }
      const fill =
        model.owner.governanceStatus === 'planned'
          ? '#fff5d6'
          : model.owner.governanceStatus === 'active'
            ? '#e7f7ef'
            : model.owner.governanceStatus === 'unassigned'
              ? '#feeceb'
              : '#eaf2ff';
      parts.push(
        `<g class="model-node" data-model="${escapeText(model.name)}" tabindex="0"><rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" rx="9" fill="${fill}" stroke="#b8c4d3"/><text class="map-node-title" x="${p.x + 11}" y="${p.y + 21}">${escapeText(model.name)}</text><text class="map-node-table" x="${p.x + 11}" y="${p.y + 39}">${escapeText(model.tableName)}</text><text class="map-node-meta" x="${p.x + 11}" y="${p.y + 56}">${model.scalarFieldCount} scalar · ${model.relationFieldCount} relation</text></g>`,
      );
    });
    svg.setAttribute('viewBox', `0 0 ${width} ${y + 20}`);
    svg.setAttribute('width', width);
    svg.setAttribute('height', y + 20);
    svg.innerHTML = parts.join('');
    svg.querySelectorAll('.model-node').forEach((node) => {
      const show = () => showModel(node.dataset.model);
      node.addEventListener('click', show);
      node.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          show();
        }
      });
    });
  }
  function showModel(name) {
    const model = inventory.database.models.find((candidate) => candidate.name === name);
    if (!model) {
      return;
    }
    document.getElementById('model-detail').innerHTML =
      `<h3>${escapeText(model.name)} <code>${escapeText(model.tableName)}</code></h3><p><strong>Owner:</strong> ${escapeText(model.owner.moduleName)} · <strong>Governance:</strong> ${escapeText(model.owner.governanceStatus)}</p><div class="chips">${model.fields.map((field) => `<span class="chip">${escapeText(`${field.name}: ${field.type}`)}</span>`).join('')}</div>`;
  }
  renderDatabaseMap();
  let zoom = 1;
  const applyZoom = () => {
    document.getElementById('database-map').style.transform = `scale(${zoom})`;
    document.getElementById('zoom-reset').textContent = `${Math.round(zoom * 100)}%`;
  };
  document.getElementById('zoom-in').addEventListener('click', () => {
    zoom = Math.min(1.8, zoom + 0.1);
    applyZoom();
  });
  document.getElementById('zoom-out').addEventListener('click', () => {
    zoom = Math.max(0.5, zoom - 0.1);
    applyZoom();
  });
  document.getElementById('zoom-reset').addEventListener('click', () => {
    zoom = 1;
    applyZoom();
  });
  document.getElementById('global-search').addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll('.searchable').forEach((element) => {
      const haystack = (element.dataset.search || element.textContent || '').toLowerCase();
      element.classList.toggle('hidden', query.length > 0 && !haystack.includes(query));
    });
  });
  document.getElementById('download-inventory').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(inventory, null, 2) + '\n'], {
        type: 'application/json',
      }),
      url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = 'newax-core-database-inventory.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });
  document.getElementById('source-footer').textContent =
    `Source ${inventory.source.sha.slice(0, 12)} · ${inventory.source.branch}${inventory.source.generatedAt ? ` · generated ${inventory.source.generatedAt}` : ''}`;
})();
