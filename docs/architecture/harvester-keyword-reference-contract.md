# Harvester Keyword Reference Contract for NEWAX Core

Status: **Proposed**  
Version: **1.0**  
Date: **4 August 2026**  
Implementation status: **Not implemented**

This document defines NEWAX Core's optional governance relationship with Harvester's keyword taxonomy.

Harvester owns the complete discovery and opportunity keyword system. Core may retain stable references and bounded decision summaries, but it must not copy, execute, or become authoritative for Harvester's private keyword profiles.

## 1. Product boundary

```text
Harvester
→ owns sectors, domains, activities, keywords, evidence evaluation,
  provider offerings, opportunity assessment, and lead qualification

NEWAX Core
→ optionally owns tenant-governed identity, provenance, relationship,
  integration, reporting, and audit projections

Communicator
→ owns audiences, campaigns, consent, messaging, engagement,
  conversations, and reply context
```

Core is not required for direct Harvester-to-Communicator operation.

## 2. Harvester registry coverage

The current Harvester documentation defines:

- 16 broad sectors;
- 1,586 canonical product-or-service domains;
- 519 canonical business activities;
- 1,586 separate domain keyword profiles;
- 519 separate activity keyword profiles;
- shared organization-cue profiles;
- shared exclusion and negative-context profiles.

These counts describe the current proposed Harvester registry. Core must treat them as source-owned, versioned references rather than Core master data.

## 3. Core may store

A bounded Core projection may contain:

| Field                      | Core purpose                                        |
| -------------------------- | --------------------------------------------------- |
| `tenant_id`                | Tenant isolation                                    |
| `source_product`           | Authoritative source identity, normally `HARVESTER` |
| `source_installation_id`   | Product-installation boundary                       |
| `source_event_id`          | Idempotent replay and provenance                    |
| `source_entity_id`         | Harvester organization or lead reference            |
| `core_organization_id`     | Optional resolved Core organization reference       |
| `taxonomy_version`         | Registry version used by Harvester                  |
| `keyword_registry_version` | Keyword dataset version used by Harvester           |
| `sector_codes`             | Bounded classification references                   |
| `domain_codes`             | Bounded classification references                   |
| `activity_codes`           | Bounded classification references                   |
| `provider_offering_codes`  | Services active in the Harvester assessment         |
| `keyword_profile_ids`      | Reference-only profile identifiers                  |
| `evidence_summary`         | Redacted, bounded source explanation                |
| `confidence_dimensions`    | Versioned Harvester confidence values               |
| `opportunity_codes`        | Harvester-supported opportunity references          |
| `assessment_version`       | Harvester policy version                            |
| `assessed_at`              | Assessment time                                     |
| `expires_at`               | Optional refresh boundary                           |
| `received_at`              | Core intake time                                    |

The projection may support governance, reporting, provenance, relationship resolution, or controlled context. It does not transfer decision ownership.

## 4. Core must not store by default

Core must not receive or expose:

- complete domain or activity keyword lists;
- private query terms and weights;
- embeddings or semantic prompts;
- unrestricted source documents or page captures;
- provider credentials or search tokens;
- complete competitor, problem-signal, or exclusion profiles;
- hidden Harvester ranking logic;
- unrestricted personal data copied from discovery sources.

A separately authorized backup, migration, or audit export is outside this normal integration contract.

## 5. Core decision restrictions

Core must not:

1. infer that a service is missing from a keyword profile reference;
2. convert a keyword match into canonical organization truth;
3. recalculate Harvester opportunity scores using Core assumptions;
4. silently upgrade an old assessment to a newer keyword version;
5. mutate or deactivate a Harvester keyword profile;
6. expose source-private keyword configuration through generic Registry APIs;
7. make Harvester or Communicator depend on Core runtime availability;
8. merge duplicate projections without preserving source provenance.

## 6. Suggested source facet

A future Core implementation may use a source-owned facet or projection similar to:

```text
HarvesterOpportunityReference
├── tenant and source identity
├── optional canonical organization link
├── sector, domain, and activity references
├── provider offering references
├── keyword and assessment versions
├── bounded evidence summary
├── multidimensional confidence
├── supported opportunity references
├── provenance and audit
└── freshness and expiry
```

The exact schema requires a separate reviewed migration and API design. This document does not authorize one silently.

## 7. Intake and authorization

Any future integration must require:

- a registered Harvester application identity;
- tenant and environment restrictions;
- least-privilege scopes;
- signed requests or short-lived service tokens;
- source-event idempotency;
- replay protection;
- payload-size and field limits;
- redaction and logging controls;
- audit records;
- revocation and emergency disablement.

Authentication success does not bypass tenant, resource, or field authorization.

## 8. Lifecycle

Core should treat a Harvester assessment as a versioned source assertion.

```text
Received
→ Validated
→ Optionally resolved to a Core organization
→ Stored as a source projection
→ Superseded by a newer Harvester assessment
→ Expired or retained according to policy
```

Supersession must preserve history. A newer assessment must not rewrite the evidence or policy version used by an earlier one.

## 9. Acceptance criteria

- [x] Harvester remains authoritative for the keyword registry and opportunity decision.
- [x] Core receives only references and bounded summaries in normal operation.
- [x] Core does not duplicate private keyword datasets.
- [x] Core cannot independently turn keyword references into service-gap claims.
- [x] Tenant isolation, provenance, idempotency, versioning, and expiry are explicit.
- [x] Direct Harvester-to-Communicator operation remains possible without Core.
- [x] No runtime behavior is presented as implemented.

## 10. Delivery boundary

This is a documentation-only contract.

No Core schema, migration, API, event consumer, credential, authorization rule, frontend page, synchronization process, or production integration is implemented by this document.
