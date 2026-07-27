(() => {
  'use strict';

  const inventory = JSON.parse(document.getElementById('registry-inventory').textContent);
  const modelByName = new Map(inventory.database.models.map((model) => [model.name, model]));

  const guides = {
    CoreTenant: [
      'Customer account',
      'The top-level ownership boundary for one NEWAX customer. It keeps one customer’s data separate from every other customer.',
      'A hospital group, university network, property company, or retail group.',
      'ownership',
    ],
    CoreOrganization: [
      'Organization',
      'A company, hospital, school, branch, department, legal entity, or operating unit inside a customer account.',
      'A hospital, campus, branch, or department.',
      'ownership',
    ],
    CoreOrganizationRelationship: [
      'Organization relationship',
      'Explains how two organizations are connected, such as parent company, subsidiary, branch, partner, or managed unit.',
      'A hospital group owns two hospitals.',
      'ownership',
    ],
    CorePerson: [
      'Person',
      'A real human being known to the platform. A person can exist before receiving a login account.',
      'An employee, student, doctor, customer, or administrator.',
      'people',
    ],
    CorePersonIdentifier: [
      'Person identifier',
      'A stable business identifier used to recognize a person in a specific context.',
      'Employee number, student number, or patient number.',
      'people',
    ],

    CorePeopleIntake: [
      'People intake',
      'A versioned draft and independent-review record for proposed people, identifiers, and relationships before canonical application.',
      'A family certificate entered as a draft, submitted for checking, and approved or rejected without creating people yet.',
      'people-intake',
    ],
    CorePersonRelationship: [
      'Person relationship',
      'A governed connection between two real people, stored once without copying either person or their official identifiers.',
      'A parent linked to a child, or a legal guardian linked to a dependent.',
      'people',
    ],
    CoreUser: [
      'User account',
      'The platform access account connected to a person. It controls whether that person can sign in and act.',
      'A person’s NEWAX portal account.',
      'identity',
    ],
    CoreUserIdentity: [
      'Sign-in identity',
      'The identity used to recognize a user during sign-in, including internal or external identity providers.',
      'An email, Google, or Microsoft identity.',
      'identity',
    ],
    CoreUserCredential: [
      'User credential',
      'Protected authentication information used to verify a user. Sensitive values are not ordinary business data.',
      'A password verifier associated with a user.',
      'security',
    ],
    CoreUserSession: [
      'User session',
      'An active or historical signed-in connection between a user and the platform.',
      'A browser or mobile session.',
      'security',
    ],
    CoreAuthenticationAttempt: [
      'Sign-in attempt',
      'A record of an attempted authentication, whether successful, rejected, or incomplete.',
      'A failed password attempt or successful login.',
      'security',
    ],
    CoreMembership: [
      'Organization membership',
      'The connection that says a person belongs to, works with, studies at, or participates in an organization.',
      'A doctor belongs to a hospital.',
      'access',
    ],
    CoreMembershipRole: [
      'Membership role assignment',
      'Assigns a role to a person’s membership in a specific organization.',
      'A hospital member receives the Department Administrator role.',
      'access',
    ],
    CoreRole: [
      'Role',
      'A named bundle of access responsibilities, usually scoped to an organization or the platform.',
      'Administrator, Instructor, Viewer, or Records Manager.',
      'access',
    ],
    CorePermission: [
      'Permission',
      'One specific action the system can allow or deny.',
      'View organizations or manage members.',
      'access',
    ],
    CoreRolePermission: [
      'Role permission link',
      'Connects a role to one permission, building the exact authority granted by that role.',
      'Administrator receives organizations.view.',
      'access',
    ],
    CoreAddress: [
      'Address',
      'A reusable physical or postal address stored once and linked wherever it is needed.',
      'Home, registered office, branch, or asset location.',
      'contact',
    ],
    CoreContactMethod: [
      'Contact method',
      'A reusable way to contact a person or organization.',
      'Email address, mobile number, or landline.',
      'contact',
    ],
    CorePersonAddress: [
      'Person-to-address link',
      'Connects a person to an address without copying address data into the person record.',
      'A person’s home or mailing address.',
      'contact',
    ],
    CoreOrganizationAddress: [
      'Organization-to-address link',
      'Connects an organization to one of its governed addresses.',
      'Registered office, branch, or billing address.',
      'contact',
    ],
    CoreObjectAddress: [
      'Business-record-to-address link',
      'Connects a reusable business record to an address.',
      'A property or facility linked to its physical location.',
      'records',
    ],
    CorePersonContactMethod: [
      'Person-to-contact link',
      'Connects a person to a contact method and preserves how that channel is used.',
      'A person’s work email or primary mobile.',
      'contact',
    ],
    CoreOrganizationContactMethod: [
      'Organization-to-contact link',
      'Connects an organization to a contact method.',
      'A support email or reception number.',
      'contact',
    ],
    CoreObjectType: [
      'Business record type',
      'Defines what kind of reusable operational record can exist.',
      'Property, facility, course, case, asset, room, or project.',
      'records',
    ],
    CoreObject: [
      'Business record',
      'A reusable operational record owned by an organization. Its type explains what it represents.',
      'A property, legal case, asset, course, or project.',
      'records',
    ],
    CoreObjectAssignment: [
      'Business record assignment',
      'Connects a business record to the organization member responsible for it.',
      'A case assigned to a lawyer or asset assigned to staff.',
      'records',
    ],
    CoreFile: [
      'File record',
      'Stores controlled information about a file owned by an organization and customer account.',
      'A contract, report, certificate, image, or attachment.',
      'operations',
    ],
    CoreAuditLog: [
      'Audit log',
      'A trace of important actions that supports accountability, investigation, and operational confidence.',
      'Who changed a record, what happened, and when.',
      'operations',
    ],
    CoreExternalReference: [
      'External system reference',
      'Maps a NEWAX record to the identifier used by another system while NEWAX retains its own record identity.',
      'A student linked to an identifier in an external SIS.',
      'operations',
    ],
    CoreHttpRateLimitBucket: [
      'Request limit counter',
      'Tracks request usage so the platform can limit abusive or excessive traffic.',
      'Counting login attempts or API requests in a time window.',
      'security',
    ],
  };

  const categories = [
    [
      'ownership',
      'Customer and organization structure',
      'Defines who owns the data and how companies, branches, campuses, departments, and operating units are arranged.',
    ],
    [
      'people',
      'People',
      'Stores real human beings, the identifiers used to recognize them, and governed relationships such as parent, guardian, spouse, sibling, and dependent.',
    ],
    [
      'identity',
      'Accounts and sign-in identity',
      'Connects a real person to a platform account and the identity used to sign in.',
    ],
    [
      'access',
      'Memberships, roles, and permissions',
      'Explains where a person belongs and exactly what they are allowed to do.',
    ],
    [
      'contact',
      'Addresses and contact details',
      'Stores reusable addresses and communication methods, then links them to people and organizations.',
    ],
    [
      'records',
      'Reusable business records',
      'Supports governed records such as assets, cases, properties, courses, facilities, and projects.',
    ],
    [
      'operations',
      'Files, integrations, and accountability',
      'Supports controlled files, external-system mappings, and audit evidence.',
    ],
    [
      'security',
      'Authentication and platform protection',
      'Protects sign-in, sessions, credentials, and request limits.',
    ],
  ];

  const journeys = [
    [
      'How a person receives access to an organization',
      'Ownership is established first. A real person is connected to an organization, assigned a role, and receives only the permissions attached to that role.',
      [
        'CoreTenant',
        'CoreOrganization',
        'CorePerson',
        'CoreMembership',
        'CoreMembershipRole',
        'CoreRole',
        'CorePermission',
      ],
    ],

    [
      'How a family relationship avoids duplicate people',
      'Each human is stored once. A tenant-scoped relationship links two existing people, while CNIC, CRC, passport, and other identifiers remain attached to the correct person.',
      ['CoreTenant', 'CorePerson', 'CorePersonIdentifier', 'CorePersonRelationship'],
    ],
    [
      'How sign-in remains separate from the human record',
      'The person is the human being. The user is the access account. Identities, credentials, sessions, and attempts handle authentication separately.',
      [
        'CorePerson',
        'CoreUser',
        'CoreUserIdentity',
        'CoreUserCredential',
        'CoreUserSession',
        'CoreAuthenticationAttempt',
        'CoreAuditLog',
      ],
    ],
    [
      'How a reusable business record is governed',
      'An organization defines a record type, creates a record, assigns responsibility, attaches supporting information, and retains audit evidence.',
      [
        'CoreOrganization',
        'CoreObjectType',
        'CoreObject',
        'CoreObjectAssignment',
        'CoreFile',
        'CoreExternalReference',
        'CoreAuditLog',
      ],
    ],
  ];

  const escapeText = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (character) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character],
    );
  const humanize = (value) =>
    String(value ?? '')
      .replace(/^Core/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const lowerFirst = (value) => value.charAt(0).toLowerCase() + value.slice(1);
  const article = (value) => (/^[aeiou]/i.test(value) ? 'an' : 'a');

  function guideFor(modelName) {
    const entry = guides[modelName];
    if (entry) {
      return { plainName: entry[0], purpose: entry[1], example: entry[2], category: entry[3] };
    }
    const plainName = humanize(modelName);
    return {
      plainName,
      purpose: `Stores ${lowerFirst(plainName)} information used by NEWAX Core.`,
      example: 'A governed operational record.',
      category: 'operations',
    };
  }

  function fieldMeaning(field) {
    const exact = {
      id: 'Unique internal identifier for this record.',
      tenantId: 'Which customer account owns this record.',
      organizationId: 'Which organization this record belongs to.',
      personId: 'Which real person this record concerns.',
      userId: 'Which platform user account this record concerns.',
      createdAt: 'When the record was created.',
      updatedAt: 'When the record was last changed.',
      deletedAt: 'When the record was logically removed, when applicable.',
      status: 'The current operational state.',
      code: 'A stable machine-readable code used by systems and integrations.',
      name: 'The human-readable name.',
      displayName: 'The name shown to users.',
      legalName: 'The formal legal name.',
      metadata: 'Additional structured data governed by the owning module.',
    };
    if (exact[field.name]) {
      return exact[field.name];
    }
    if (field.relation) {
      return `Relationship to ${guideFor(field.baseType).plainName}.`;
    }
    if (field.name.endsWith('Id')) {
      return `Reference identifier for ${humanize(field.name.slice(0, -2)).toLowerCase()}.`;
    }
    if (/At$/.test(field.name)) {
      return `Date and time for ${humanize(field.name).toLowerCase()}.`;
    }
    return `Stores ${humanize(field.name).toLowerCase()} for this record.`;
  }

  function relationSentence(relation) {
    const overrides = {
      'CoreOrganization.parentOrganization':
        'An organization may sit underneath another organization, such as a branch under a parent company.',
      'CoreObject.parentObject':
        'A business record may sit underneath another business record, allowing governed hierarchies.',
      'CoreOrganizationRelationship.sourceOrganization':
        'An organization relationship starts from one organization.',
      'CoreOrganizationRelationship.targetOrganization':
        'An organization relationship points to another organization.',
      'CoreMembership.organization': 'An organization membership belongs to one organization.',
      'CoreMembership.person':
        'An organization membership connects one real person to that organization.',
      'CoreMembershipRole.membership': 'A role assignment belongs to one organization membership.',
      'CoreMembershipRole.role': 'A role assignment grants one role to that membership.',
      'CoreRolePermission.role': 'A role-permission link belongs to one role.',
      'CoreRolePermission.permission': 'A role-permission link grants one specific permission.',

      'CorePersonRelationship.tenant':
        'A person relationship belongs to one customer account, keeping sensitive family links inside the correct Tenant.',
      'CorePersonRelationship.sourcePerson':
        'The source person starts the directed relationship, such as the parent in a parent-of link.',
      'CorePersonRelationship.targetPerson':
        'The target person receives the directed relationship, such as the child in a parent-of link.',
      'CorePersonRelationship.verifiedByUser':
        'A verified relationship may record which authorized user completed verification.',
      'CorePerson.user':
        'A person may have a platform user account, but the person can exist without login access.',
      'CoreFile.createdByUser': 'A file may record which user created its database record.',
      'CoreAuditLog.actorUser': 'An audit log may record which user performed the action.',
      'CoreMembershipRole.assignedByUser':
        'A role assignment may record which user assigned the role.',
      'CoreMembershipRole.revokedByUser':
        'A role assignment may record which user revoked the role.',
      'CoreObjectAssignment.assignedByUser':
        'A business record assignment may record which user made the assignment.',
      'CoreRolePermission.createdByUser':
        'A role-permission link may record which user created it.',
    };
    if (overrides[`${relation.source}.${relation.field}`]) {
      return overrides[`${relation.source}.${relation.field}`];
    }
    const source = guideFor(relation.source).plainName;
    const target = guideFor(relation.target).plainName;
    return `${article(source)} ${lowerFirst(source)} ${relation.optional ? 'may link to' : 'must link to'} one ${lowerFirst(target)}.`;
  }

  function relationImportance(relation) {
    const importance = {
      CoreTenant: 'Keeps records inside the correct customer ownership boundary.',
      CoreOrganization: 'Keeps the record inside the correct organization and operating context.',
      CorePerson: 'Connects operational activity to the real human being involved.',
      CoreUser: 'Supports accountability, authentication, or traceability to a platform account.',
      CoreMembership:
        'Connects responsibility and access to a person inside a specific organization.',
      CoreRole: 'Determines the named access responsibility being assigned.',
      CorePermission: 'Determines the exact action that a role is allowed to perform.',
      CoreObjectType: 'Explains what kind of business record the object represents.',
      CoreObject: 'Connects supporting information or responsibility to the business record.',
      CoreAddress: 'Reuses one governed address instead of copying address data into many records.',
      CoreContactMethod: 'Reuses one governed contact method and preserves where it is used.',
    };
    return (
      importance[relation.target] ??
      `Keeps ${lowerFirst(guideFor(relation.source).plainName)} connected to the correct ${lowerFirst(guideFor(relation.target).plainName)} without duplicating data.`
    );
  }

  function modelLabel(modelName) {
    return `${guideFor(modelName).plainName} (${modelName})`;
  }

  function relationsFor(modelName) {
    return {
      outgoing: inventory.database.relations.filter((relation) => relation.source === modelName),
      incoming: inventory.database.relations.filter((relation) => relation.target === modelName),
    };
  }

  function buildUnderstandPanel() {
    const panel = document.createElement('section');
    panel.className = 'panel tab-panel plain-language-explainer';
    panel.dataset.panel = 'understand';
    panel.innerHTML = `
      <div class="section-heading"><div><p class="eyebrow">Start here</p><h2>How the database supports the business</h2></div></div>
      <div class="plain-intro"><div class="plain-intro-icon">DB</div><div><h3>Think of the database as organized filing cabinets</h3><p>Each record type stores one kind of thing, such as a person, organization, role, file, or business record. A relationship is the controlled rule connecting one record to another.</p></div></div>
      <div class="reading-guide">
        <article><span>1</span><div><h3>Record type</h3><p>A controlled place to store one kind of information.</p></div></article>
        <article><span class="required">→</span><div><h3>Required relationship</h3><p>The source record must have the linked record.</p></div></article>
        <article><span class="optional">⇢</span><div><h3>Optional relationship</h3><p>The connection exists only when relevant.</p></div></article>
        <article><span class="owner">◎</span><div><h3>Ownership boundary</h3><p>Tenant and organization links keep data under the correct customer.</p></div></article>
      </div>
      <div class="section-heading explain-spaced"><div><p class="eyebrow">Business map</p><h2>Eight understandable areas</h2><p class="muted">Open any record to inspect its exact relationships.</p></div></div>
      <div class="business-map" id="business-map-explain"></div>
      <div class="section-heading explain-spaced"><div><p class="eyebrow">Common journeys</p><h2>How information moves through NEWAX Core</h2></div></div>
      <div class="journey-grid" id="journeys-explain"></div>`;
    return panel;
  }

  function installTabsAndPanel() {
    const overview = document.querySelector('[data-panel="overview"]');
    overview.dataset.panel = 'relationships';
    const panel = buildUnderstandPanel();
    overview.parentNode.insertBefore(panel, overview);

    const overviewButton = document.querySelector('[data-tab="overview"]');
    overviewButton.dataset.tab = 'relationships';
    overviewButton.textContent = 'Relationship explorer';
    overviewButton.setAttribute('aria-selected', 'false');
    const understandButton = document.createElement('button');
    understandButton.type = 'button';
    understandButton.dataset.tab = 'understand';
    understandButton.textContent = 'Understand it';
    understandButton.setAttribute('aria-selected', 'true');
    overviewButton.parentNode.insertBefore(understandButton, overviewButton);

    document.querySelectorAll('[data-panel]').forEach((candidate) => {
      candidate.hidden = candidate.dataset.panel !== 'understand';
    });
  }

  function renderBusinessMap() {
    document.getElementById('business-map-explain').innerHTML = categories
      .map(([key, title, summary], index) => {
        const models = inventory.database.models.filter(
          (model) => guideFor(model.name).category === key,
        );
        return `<article class="business-domain searchable" data-search="${escapeText([title, summary, ...models.map((model) => guideFor(model.name).plainName)].join(' '))}"><div class="domain-number">${index + 1}</div><div><h3>${escapeText(title)}</h3><p>${escapeText(summary)}</p><div class="domain-models">${models.map((model) => `<button type="button" class="explain-model-pill" data-explain-model="${escapeText(model.name)}"><strong>${escapeText(guideFor(model.name).plainName)}</strong><small>${escapeText(model.tableName)}</small></button>`).join('')}</div></div></article>`;
      })
      .join('');
  }

  function renderJourneys() {
    document.getElementById('journeys-explain').innerHTML = journeys
      .map(
        ([title, summary, steps]) =>
          `<article class="journey-card searchable" data-search="${escapeText([title, summary, ...steps.map(modelLabel)].join(' '))}"><h3>${escapeText(title)}</h3><p>${escapeText(summary)}</p><div class="journey-flow">${steps
            .filter((name) => modelByName.has(name))
            .map(
              (name, index) =>
                `${index ? '<span class="journey-arrow">→</span>' : ''}<button type="button" class="journey-step" data-explain-model="${escapeText(name)}"><strong>${escapeText(guideFor(name).plainName)}</strong><small>${escapeText(name)}</small></button>`,
            )
            .join('')}</div></article>`,
      )
      .join('');
  }

  function enhanceRelationshipPanel() {
    const panel = document.querySelector('[data-panel="relationships"]');
    const originalHeading = panel.querySelector('.section-heading');
    originalHeading.querySelector('h2').textContent = 'Exact technical relationship map';
    originalHeading.querySelector('.eyebrow').textContent = 'Engineering view';

    const explorer = document.createElement('div');
    explorer.className = 'relationship-explorer';
    explorer.innerHTML = `
      <div class="explorer-heading"><div><p class="eyebrow">Plain-language explorer</p><h2>Understand one record and every direct connection</h2></div><label><span>Select a record</span><select id="explain-model-select"></select></label></div>
      <section class="focus-summary" id="explain-focus-summary"></section>
      <section class="focus-map" id="explain-focus-map"></section>
      <div class="section-heading explain-spaced"><div><p class="eyebrow">Relationship explanations</p><h2>What each connection means and why it exists</h2></div></div>
      <div class="relationship-explanations" id="explain-relationship-list"></div>`;
    panel.insertBefore(explorer, originalHeading);

    const complete = document.createElement('div');
    complete.innerHTML = `<div class="section-heading explain-spaced"><div><p class="eyebrow">Complete relationship register</p><h2>All ${inventory.database.relationCount} discovered relationships</h2></div></div><div class="table-wrap"><table><thead><tr><th>Plain-language relationship</th><th>Database link</th><th>Requirement</th><th>Why it matters</th></tr></thead><tbody id="explain-relationship-rows"></tbody></table></div>`;
    panel.appendChild(complete);

    const select = document.getElementById('explain-model-select');
    select.innerHTML = inventory.database.models
      .map(
        (model) =>
          `<option value="${escapeText(model.name)}">${escapeText(guideFor(model.name).plainName)} · ${escapeText(model.tableName)}</option>`,
      )
      .join('');
    select.addEventListener('change', () => showModel(select.value));

    document.getElementById('explain-relationship-rows').innerHTML = inventory.database.relations
      .map(
        (relation) =>
          `<tr class="searchable" data-search="${escapeText([relation.source, relation.target, relation.field, relationSentence(relation), relationImportance(relation)].join(' '))}"><td>${escapeText(relationSentence(relation))}</td><td><code>${escapeText(`${relation.source}.${relation.field}`)}</code></td><td>${relation.optional ? '<span class="badge planned">Optional</span>' : '<span class="badge active">Required</span>'}</td><td>${escapeText(relationImportance(relation))}</td></tr>`,
      )
      .join('');
  }

  function relationshipCard(relation, direction) {
    const relatedName = direction === 'outgoing' ? relation.target : relation.source;
    return `<button type="button" class="relationship-card ${relation.optional ? 'optional' : 'required'}" data-explain-model="${escapeText(relatedName)}"><span>${direction === 'outgoing' ? 'This record points to' : 'Points to this record'}</span><strong>${escapeText(guideFor(relatedName).plainName)}</strong><small>${escapeText(relatedName)} · ${relation.optional ? 'optional' : 'required'}</small><p>${escapeText(relationSentence(relation))}</p></button>`;
  }

  function showModel(modelName, switchTab = false) {
    const model = modelByName.get(modelName);
    if (!model) {
      return;
    }
    const guide = guideFor(modelName);
    const related = relationsFor(modelName);
    const select = document.getElementById('explain-model-select');
    if (select) {
      select.value = modelName;
    }

    document.getElementById('explain-focus-summary').innerHTML =
      `<div><p class="eyebrow">Selected record</p><h2>${escapeText(guide.plainName)}</h2><p class="focus-purpose">${escapeText(guide.purpose)}</p><p><strong>Simple example:</strong> ${escapeText(guide.example)}</p></div><dl><div><dt>Technical model</dt><dd><code>${escapeText(model.name)}</code></dd></div><div><dt>Database table</dt><dd><code>${escapeText(model.tableName)}</code></dd></div><div><dt>Module owner</dt><dd>${escapeText(model.owner.moduleName)} · ${escapeText(model.owner.governanceStatus)}</dd></div><div><dt>Contents</dt><dd>${model.scalarFieldCount} stored fields and ${model.relationFieldCount} direct relationship fields</dd></div></dl>`;

    document.getElementById('explain-focus-map').innerHTML =
      `<div class="focus-column"><h3>Records that point to this</h3><p>These records depend on or refer to the selected record.</p>${related.incoming.length ? related.incoming.map((relation) => relationshipCard(relation, 'incoming')).join('') : '<p class="empty">No incoming relationships.</p>'}</div><div class="focus-center"><div><span>Selected record</span><strong>${escapeText(guide.plainName)}</strong><code>${escapeText(model.tableName)}</code><small>${related.incoming.length} incoming · ${related.outgoing.length} outgoing</small></div></div><div class="focus-column"><h3>This record points to</h3><p>These links establish ownership, responsibility, identity, or supporting information.</p>${related.outgoing.length ? related.outgoing.map((relation) => relationshipCard(relation, 'outgoing')).join('') : '<p class="empty">No outgoing relationships.</p>'}</div>`;

    const direct = [...related.incoming, ...related.outgoing];
    document.getElementById('explain-relationship-list').innerHTML = direct.length
      ? direct
          .map(
            (relation) =>
              `<article class="relationship-explanation searchable" data-search="${escapeText([relationSentence(relation), relationImportance(relation), relation.source, relation.target].join(' '))}"><div>${relation.optional ? '<span class="badge planned">Optional</span>' : '<span class="badge active">Required</span>'}</div><h3>${escapeText(relationSentence(relation))}</h3><p>${escapeText(relationImportance(relation))}</p><dl><div><dt>From</dt><dd>${escapeText(modelLabel(relation.source))}</dd></div><div><dt>To</dt><dd>${escapeText(modelLabel(relation.target))}</dd></div><div><dt>Field</dt><dd><code>${escapeText(`${relation.source}.${relation.field}`)}</code></dd></div></dl></article>`,
          )
          .join('')
      : '<p class="empty">No direct relationships.</p>';

    const detail = document.getElementById('model-detail');
    detail.innerHTML = `<div class="detail-heading"><div><p class="eyebrow">Field-by-field explanation</p><h3>${escapeText(guide.plainName)}</h3></div><div><code>${escapeText(model.name)}</code> <code>${escapeText(model.tableName)}</code></div></div><p>${escapeText(guide.purpose)}</p><div class="table-wrap"><table class="field-table"><thead><tr><th>Field</th><th>Type</th><th>Meaning</th><th>Rules</th></tr></thead><tbody>${model.fields
      .map(
        (field) =>
          `<tr><td><code>${escapeText(field.name)}</code></td><td>${escapeText(field.type)}</td><td>${escapeText(fieldMeaning(field))}</td><td>${[
            field.id ? 'Primary identifier' : null,
            field.unique ? 'Unique' : null,
            field.optional ? 'Optional' : 'Required',
            field.relation ? 'Relationship' : 'Stored value',
          ]
            .filter(Boolean)
            .map((rule) => `<span class="chip">${escapeText(rule)}</span>`)
            .join(' ')}</td></tr>`,
      )
      .join('')}</tbody></table></div>`;

    highlightMap(modelName);
    if (switchTab) {
      document.querySelector('[data-tab="relationships"]')?.click();
      document
        .getElementById('explain-focus-summary')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function enhanceModelTable() {
    const table = document.getElementById('model-rows').closest('table');
    table.querySelector('thead').innerHTML =
      '<tr><th>Plain name</th><th>Table</th><th>What it stores</th><th>Owner</th><th>Governance</th><th>Fields</th><th>Relations</th></tr>';
    document.getElementById('model-rows').innerHTML = inventory.database.models
      .map(
        (model) =>
          `<tr class="searchable" data-search="${escapeText([model.name, model.tableName, guideFor(model.name).plainName, guideFor(model.name).purpose, model.owner.moduleName].join(' '))}"><td><button type="button" class="explain-table-link" data-explain-model="${escapeText(model.name)}"><strong>${escapeText(guideFor(model.name).plainName)}</strong><small>${escapeText(model.name)}</small></button></td><td><code>${escapeText(model.tableName)}</code></td><td>${escapeText(guideFor(model.name).purpose)}</td><td>${escapeText(model.owner.moduleName)}</td><td><span class="badge ${escapeText(model.owner.governanceStatus)}">${escapeText(model.owner.governanceStatus)}</span></td><td>${model.scalarFieldCount}</td><td>${model.relationFieldCount}</td></tr>`,
      )
      .join('');
  }

  function prepareMapRelations() {
    const lines = [...document.querySelectorAll('#database-map .relation-line')];
    lines.forEach((line, index) => {
      const relation = inventory.database.relations[index];
      if (!relation) {
        return;
      }
      line.dataset.source = relation.source;
      line.dataset.target = relation.target;
      line.classList.toggle('optional-link', relation.optional);
    });
  }

  function highlightMap(modelName) {
    const connected = new Set([modelName]);
    inventory.database.relations.forEach((relation) => {
      if (relation.source === modelName) {
        connected.add(relation.target);
      }
      if (relation.target === modelName) {
        connected.add(relation.source);
      }
    });
    document.querySelectorAll('#database-map .model-node').forEach((node) => {
      node.classList.toggle('explain-selected', node.dataset.model === modelName);
      node.classList.toggle('explain-dimmed', !connected.has(node.dataset.model));
    });
    document.querySelectorAll('#database-map .relation-line').forEach((line) => {
      const active = line.dataset.source === modelName || line.dataset.target === modelName;
      line.classList.toggle('explain-selected', active);
      line.classList.toggle('explain-dimmed', !active);
    });
  }

  installTabsAndPanel();
  renderBusinessMap();
  renderJourneys();
  enhanceRelationshipPanel();
  enhanceModelTable();
  prepareMapRelations();

  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-explain-model]');
    if (opener) {
      showModel(opener.dataset.explainModel, true);
    }
    const mapNode = event.target.closest('#database-map .model-node');
    if (mapNode) {
      showModel(mapNode.dataset.model);
    }
  });

  const initial = modelByName.has('CoreTenant') ? 'CoreTenant' : inventory.database.models[0]?.name;
  if (initial) {
    showModel(initial);
  }
})();
