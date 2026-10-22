# NEWAX File Metadata Registry

## Purpose

The File Metadata Registry identifies stored binary objects without owning their bytes or exposing storage credentials.

It records which Tenant and Organization own a stored object, its human-facing name and media type, its size, its integrity checksum, and the internal provider locator needed by a future storage boundary.

Files and business Documents are separate concepts. A File is stored binary content. A Document is a business record that may reference one or more Files and remains outside this module.

## Public service operations

- `registerCurrentOrganizationFile`
- `listCurrentOrganizationFiles`

There is no HTTP endpoint in this foundation release.

## Registration contract

`registerCurrentOrganizationFile` registers metadata only. Its caller must be a trusted storage component that has already:

1. durably stored the bytes;
2. determined the exact byte size;
3. computed a SHA-256 checksum; and
4. selected the provider and opaque storage key.

Registration does not upload bytes, verify remote object existence, issue URLs, or make a storage object public.

## Ownership

This module owns `core_files`.

Each File has an immutable `tenant_id` and one Organization inside that Tenant. PostgreSQL composite foreign keys prevent an Organization from being paired with a different Tenant.

Tenant and Organization authority come from trusted request context. They are never accepted as File input fields.

## Permissions

- `files.register` registers metadata after trusted storage completion.
- `files.view` lists active metadata for the trusted current Organization.

Role names are not authorization rules.

## Metadata exposure

Service records contain only:

- File ID;
- Tenant and Organization boundary IDs for server-side composition;
- normalized filename;
- normalized media type;
- byte size; and
- creation time.

Storage provider, storage key, checksum, and creator identity remain internal persistence metadata. They are excluded from service records, events, and structured logs.

## Validation and integrity

- Provider identifiers use bounded lowercase stable codes.
- Storage keys are opaque values bounded to 2,048 UTF-8 bytes and may not contain control characters. The byte ceiling keeps the composite provider-and-key value inside PostgreSQL B-tree index limits.
- Filenames are Unicode-normalized, whitespace-normalized, bounded, and may not contain path separators.
- Media types are normalized lowercase `type/subtype` tokens without parameters.
- File size must fit a non-negative PostgreSQL `bigint`.
- Checksums must use `sha256:<64 lowercase hexadecimal characters>`.
- List cursors must belong to the trusted Tenant and Organization.
- Repository records outside the trusted boundary fail closed.

## Events

- `file.registered`

The event contains actor, Tenant, Organization, File, and occurrence identifiers only. It excludes filename, media type, size, provider, storage key, and checksum.

## Dependencies

- Tenants
- Organizations
- Users

Application composition also uses the existing Database module.

## Deliberately deferred

- Binary upload and download.
- Provider selection and storage adapters.
- Signed or public URLs.
- Malware scanning and quarantine.
- Content inspection or thumbnail generation.
- File update, replacement, versioning, deletion, retention, restore, and purge policy.
- Business Documents and Document-to-File relationships.
- HTTP endpoints.

Those capabilities require explicit storage, security, privacy, lifecycle, and authority rules.

## Client customization

Client-specific file classifications and business attributes belong in domain records or extension modules that reference `file_id`. They must not be added to `core_files` unless they apply to every supported NEWAX deployment.

## Code necessity and simplicity

This package reuses TypeScript, NestJS composition, Prisma, PostgreSQL transactions, and advisory locks already present in the repository.

It adds no dependency, upload framework, storage SDK, validation library, event framework, or generic utility package. Storage capabilities remain absent until their contracts are approved.
