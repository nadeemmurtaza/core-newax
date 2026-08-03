# Communication Complaint Registry

Status: **Changed**  
Implementation boundary: database governance projection only

## Purpose

NEWAX Core records a tenant-scoped governance projection of email complaints received by a connected product. It does not own provider webhooks, message delivery, or Harvester outreach decisions.

## Ownership

- **Communicator** owns the authoritative provider complaint event and normalized complaint evidence.
- **Harvester** owns lead-contact suppression and outreach eligibility.
- **NEWAX Core** owns the optional cross-product governance projection for tenant reporting, audit, and controlled synchronization.

No product writes another product's private tables or shares database credentials.

## Table

`core_communication_complaints`

The table records:

- tenant boundary;
- optional canonical contact-method link;
- source product and source complaint identifier;
- complaint classification;
- provider and provider message reference;
- normalized recipient address;
- governance status;
- whether suppression is required;
- occurrence and receipt timestamps;
- redacted, normalized metadata.

The complete provider webhook body and message content must not be copied into Core.

## Complaint classifications

- `recipient_spam`
- `feedback_loop`
- `dmarc_forensic`
- `authentication_failure`
- `other`

## Idempotency

The unique key is:

```text
tenant_id + source_product + source_complaint_id
```

Source retries must update or return the existing governance record rather than creating duplicates.

## Status

Allowed governance states are:

- `active`
- `acknowledged`
- `resolved`
- `false_positive`

A resolved Core governance record does not automatically remove a Harvester suppression. Suppression reversal is a separate, explicitly authorized action in the product that owns outreach eligibility.

## Delivery boundary

This change adds the database table and constraints. It does not add provider webhook ingestion, cross-product event delivery, APIs, user interfaces, automatic suppression reversal, or a claim that all DMARC reports are recipient complaints.
