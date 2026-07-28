'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

interface Membership {
  readonly membership_id: string;
  readonly organization_id: string;
  readonly organization_display_name: string;
  readonly membership_type: string;
}

interface EvidenceItem {
  readonly id: string;
  readonly file_name: string;
  readonly mime_type: string;
  readonly file_size: string;
  readonly document_type: string;
  readonly evidence_role: string;
  readonly certificate_import_id: string | null;
  readonly certificate_import_status: CertificateImportStatus | null;
}

type CertificateImportStatus = 'pending' | 'extracted' | 'accepted' | 'rejected';

interface CertificateImportRecord {
  readonly id: string;
  readonly evidence_id: string;
  readonly intake_id: string;
  readonly status: CertificateImportStatus;
  readonly extraction_payload: unknown | null;
  readonly extractor_code: string | null;
  readonly extraction_version: string | null;
  readonly confidence_bps: number | null;
  readonly extracted_by_user_id: string | null;
  readonly reviewed_by_user_id: string | null;
  readonly review_decision: 'accepted' | 'rejected' | null;
  readonly review_notes: string | null;
  readonly applied_by_user_id: string | null;
  readonly applied_at: string | null;
  readonly version: number;
  readonly intake_version: number;
  readonly intake_status: string;
}

interface ApiEnvelope<T> {
  readonly success: true;
  readonly data: T;
}

const emptyPayload = JSON.stringify(
  {
    schemaVersion: 1,
    people: [{ clientKey: 'person_1', firstName: '', lastName: '' }],
    relationships: [],
  },
  null,
  2,
);

export function CertificateImportWorkspace() {
  const [memberships, setMemberships] = useState<readonly Membership[]>([]);
  const [membershipId, setMembershipId] = useState('');
  const [intakeId, setIntakeId] = useState('');
  const [fileId, setFileId] = useState('');
  const [documentType, setDocumentType] = useState('birth_certificate');
  const [items, setItems] = useState<readonly EvidenceItem[]>([]);
  const [importId, setImportId] = useState('');
  const [importRecord, setImportRecord] = useState<CertificateImportRecord | null>(null);
  const [payload, setPayload] = useState(emptyPayload);
  const [reviewNotes, setReviewNotes] = useState('');
  const [message, setMessage] = useState('Select an organization and enter an intake ID.');
  const [busy, setBusy] = useState(false);

  const selectedMembership =
    memberships.find((membership) => membership.membership_id === membershipId) ?? null;

  const request = useCallback(
    async <T,>(path: string, init: RequestInit = {}, requiresMembership = true): Promise<T> => {
      const headers = new Headers(init.headers);
      headers.set('Accept', 'application/json');
      if (init.body !== undefined) {
        headers.set('Content-Type', 'application/json');
      }
      if (requiresMembership) {
        if (membershipId.length === 0) {
          throw new Error('Select an organization first.');
        }
        headers.set('x-newax-membership-id', membershipId);
      }
      if (init.method !== undefined && init.method !== 'GET' && init.method !== 'HEAD') {
        const csrf = csrfCookie();
        if (csrf === null) {
          throw new Error('Your secure session is missing its CSRF token. Sign in again.');
        }
        headers.set('x-newax-csrf', csrf);
      }

      const response = await fetch(path, {
        ...init,
        headers,
        credentials: 'include',
        cache: 'no-store',
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          errorMessage(body) ?? `Request failed with status ${String(response.status)}.`,
        );
      }
      if (!isApiEnvelope<T>(body)) {
        throw new Error('The server returned an invalid response.');
      }
      return body.data;
    },
    [membershipId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void request<readonly Membership[]>(
      '/api/account/memberships',
      { signal: controller.signal },
      false,
    )
      .then((records) => {
        if (!controller.signal.aborted) {
          setMemberships(records);
          setMembershipId((current) => current || records[0]?.membership_id || '');
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setMessage(messageFrom(error));
        }
      });
    return () => controller.abort();
  }, [request]);

  function changeMembership(nextMembershipId: string): void {
    setMembershipId(nextMembershipId);
    setItems([]);
    setImportId('');
    setImportRecord(null);
    setPayload(emptyPayload);
    setReviewNotes('');
    setMessage(
      nextMembershipId.length === 0
        ? 'Select an organization to begin.'
        : 'Organization changed. Enter an intake ID to load its evidence.',
    );
  }

  async function execute(task: () => Promise<void>): Promise<void> {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      setMessage(messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  async function refreshEvidence(): Promise<void> {
    if (intakeId.trim().length === 0) {
      throw new Error('Enter an intake ID first.');
    }
    const data = await request<readonly EvidenceItem[]>(
      `/api/core/organizations/current/people-intakes/${encodeURIComponent(intakeId.trim())}/evidence`,
    );
    setItems(data);
    setMessage(`Loaded ${String(data.length)} evidence record(s).`);
  }

  function loadEvidence(): void {
    void execute(refreshEvidence);
  }

  function attach(event: FormEvent): void {
    event.preventDefault();
    void execute(async () => {
      await request(
        `/api/core/organizations/current/people-intakes/${encodeURIComponent(intakeId.trim())}/evidence`,
        {
          method: 'POST',
          body: JSON.stringify({
            file_id: fileId.trim(),
            document_type: documentType,
            evidence_role: 'primary',
          }),
        },
      );
      setFileId('');
      await refreshEvidence();
      setMessage('Evidence attached to the editable intake draft.');
    });
  }

  function createImport(evidenceId: string): void {
    void execute(async () => {
      const record = await request<CertificateImportRecord>(
        `/api/core/organizations/current/people-intakes/${encodeURIComponent(intakeId.trim())}/evidence/${encodeURIComponent(evidenceId)}/certificate-imports`,
        { method: 'POST', body: '{}' },
      );
      selectImport(record);
      await refreshEvidence();
      setMessage(`Certificate import ${record.id} created at version ${String(record.version)}.`);
    });
  }

  function openImport(selectedImportId: string): void {
    void execute(async () => {
      const record = await request<CertificateImportRecord>(
        `/api/core/organizations/current/people-intakes/certificate-imports/${encodeURIComponent(selectedImportId)}`,
      );
      selectImport(record);
      setMessage(`Loaded certificate import ${record.id} at version ${String(record.version)}.`);
    });
  }

  function selectImport(record: CertificateImportRecord): void {
    setImportId(record.id);
    setImportRecord(record);
    setReviewNotes(record.review_notes ?? '');
    if (record.extraction_payload !== null) {
      setPayload(JSON.stringify(record.extraction_payload, null, 2));
    }
  }

  function stageExtraction(event: FormEvent): void {
    event.preventDefault();
    void execute(async () => {
      const current = requireImport(importRecord, 'Load a pending certificate import first.');
      if (current.status !== 'pending') {
        throw new Error('Only a pending certificate import can receive extraction data.');
      }
      const record = await request<CertificateImportRecord>(
        `/api/core/organizations/current/people-intakes/certificate-imports/${encodeURIComponent(current.id)}/extraction`,
        {
          method: 'PUT',
          body: JSON.stringify({
            expected_version: current.version,
            extractor_code: 'manual',
            extraction_version: '1',
            confidence_bps: 10000,
            payload: parsePayload(payload),
          }),
        },
      );
      selectImport(record);
      setMessage(
        `Extraction staged at version ${String(record.version)}. A different user must review it.`,
      );
    });
  }

  function review(decision: 'accepted' | 'rejected'): void {
    void execute(async () => {
      const current = requireImport(importRecord, 'Load an extracted certificate import first.');
      if (current.status !== 'extracted') {
        throw new Error('Only an extracted certificate import can be reviewed.');
      }
      if (decision === 'rejected' && reviewNotes.trim().length === 0) {
        throw new Error('Add reviewer notes before rejecting the extraction.');
      }
      const record = await request<CertificateImportRecord>(
        `/api/core/organizations/current/people-intakes/certificate-imports/${encodeURIComponent(current.id)}/review`,
        {
          method: 'POST',
          body: JSON.stringify({
            expected_version: current.version,
            decision,
            notes: reviewNotes.trim().length === 0 ? null : reviewNotes.trim(),
          }),
        },
      );
      selectImport(record);
      setMessage(
        decision === 'accepted'
          ? 'Extraction accepted. The intake creator may now apply it to the editable draft.'
          : 'Extraction rejected with reviewer notes.',
      );
    });
  }

  function applyAcceptedExtraction(): void {
    void execute(async () => {
      const current = requireImport(importRecord, 'Load an accepted certificate import first.');
      if (current.status !== 'accepted' || current.applied_at !== null) {
        throw new Error('Only an unapplied accepted extraction can be applied.');
      }
      const record = await request<CertificateImportRecord>(
        `/api/core/organizations/current/people-intakes/certificate-imports/${encodeURIComponent(current.id)}/apply`,
        {
          method: 'POST',
          body: JSON.stringify({
            expected_import_version: current.version,
            expected_intake_version: current.intake_version,
          }),
        },
      );
      selectImport(record);
      setMessage(
        `Accepted extraction applied to intake ${record.intake_id}. Canonical People records remain unchanged.`,
      );
    });
  }

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 32, fontFamily: 'system-ui' }}>
      <p>
        <Link href="/internal/people-intake">← Family intake dashboard</Link>
      </p>
      <h1>Certificate import and evidence</h1>
      <p>
        Attach an existing NEWAX File record, stage structured family data, review it independently,
        and apply only accepted extraction to an editable draft. Nothing writes directly to the
        canonical People Registry.
      </p>

      <section aria-label="Organization context" style={{ marginBlock: 24 }}>
        <label>
          Organization
          <select
            value={membershipId}
            disabled={busy}
            onChange={(event) => changeMembership(event.target.value)}
          >
            <option value="">Select organization</option>
            {memberships.map((membership) => (
              <option key={membership.membership_id} value={membership.membership_id}>
                {membership.organization_display_name} · {membership.membership_type}
              </option>
            ))}
          </select>
        </label>
        <p>
          Current context:{' '}
          <strong>
            {selectedMembership?.organization_display_name ?? 'No organization selected'}
          </strong>
        </p>
      </section>

      <p role="status" aria-live="polite">
        {busy ? 'Working…' : message}
      </p>

      <section>
        <h2>1. Evidence attachment</h2>
        <form onSubmit={attach} style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
          <label>
            Intake ID
            <input
              value={intakeId}
              disabled={busy}
              onChange={(event) => setIntakeId(event.target.value)}
              required
              style={{ width: '100%' }}
            />
          </label>
          <label>
            Registered File ID
            <input
              value={fileId}
              disabled={busy}
              onChange={(event) => setFileId(event.target.value)}
              required
              style={{ width: '100%' }}
            />
          </label>
          <label>
            Document type
            <select
              value={documentType}
              disabled={busy}
              onChange={(event) => setDocumentType(event.target.value)}
            >
              <option value="birth_certificate">Birth certificate</option>
              <option value="crc">CRC</option>
              <option value="family_registration_certificate">
                Family registration certificate
              </option>
              <option value="marriage_certificate">Marriage certificate</option>
              <option value="guardianship_order">Guardianship order</option>
              <option value="other">Other</option>
            </select>
          </label>
          <div>
            <button type="submit" disabled={busy || membershipId.length === 0}>
              Attach evidence
            </button>{' '}
            <button
              type="button"
              disabled={busy || membershipId.length === 0 || intakeId.trim().length === 0}
              onClick={loadEvidence}
            >
              Load evidence
            </button>
          </div>
        </form>

        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.file_name}</strong> · {item.mime_type} · {item.document_type} ·{' '}
              {item.certificate_import_status ?? 'not imported'}{' '}
              {item.certificate_import_id === null ? (
                <button type="button" disabled={busy} onClick={() => createImport(item.id)}>
                  Create import
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => openImport(item.certificate_import_id ?? '')}
                >
                  Open import
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>2. Structured extraction</h2>
        <label>
          Certificate import ID
          <input
            value={importId}
            disabled={busy}
            onChange={(event) => {
              setImportId(event.target.value);
              setImportRecord(null);
            }}
            style={{ width: '100%' }}
          />
        </label>{' '}
        <button
          type="button"
          disabled={busy || membershipId.length === 0 || importId.trim().length === 0}
          onClick={() => openImport(importId.trim())}
        >
          Load import
        </button>
        {importRecord !== null ? (
          <div style={{ marginBlock: 16 }}>
            <p>
              Status: <strong>{importRecord.status}</strong> · import version {importRecord.version}{' '}
              · intake version {importRecord.intake_version} · intake status{' '}
              {importRecord.intake_status}
            </p>

            {importRecord.status === 'pending' ? (
              <form onSubmit={stageExtraction} style={{ display: 'grid', gap: 12 }}>
                <label>
                  Extracted family payload
                  <textarea
                    value={payload}
                    disabled={busy}
                    onChange={(event) => setPayload(event.target.value)}
                    rows={20}
                    style={{ width: '100%', fontFamily: 'monospace' }}
                  />
                </label>
                <button type="submit" disabled={busy}>
                  Stage extraction
                </button>
              </form>
            ) : null}

            {importRecord.status === 'extracted' ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <pre style={{ overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{payload}</pre>
                <label>
                  Reviewer notes
                  <textarea
                    value={reviewNotes}
                    disabled={busy}
                    onChange={(event) => setReviewNotes(event.target.value)}
                    placeholder="Required for rejection; optional for acceptance."
                    rows={5}
                    style={{ width: '100%' }}
                  />
                </label>
                <div>
                  <button type="button" disabled={busy} onClick={() => review('rejected')}>
                    Reject with notes
                  </button>{' '}
                  <button type="button" disabled={busy} onClick={() => review('accepted')}>
                    Accept extraction
                  </button>
                </div>
                <p>A different authenticated user must perform this review.</p>
              </div>
            ) : null}

            {importRecord.status === 'accepted' && importRecord.applied_at === null ? (
              <div>
                <p>
                  The extraction is accepted. Only the intake creator can apply it while the intake
                  remains an editable draft.
                </p>
                <button type="button" disabled={busy} onClick={applyAcceptedExtraction}>
                  Apply accepted extraction to draft
                </button>
              </div>
            ) : null}

            {importRecord.status === 'rejected' ? (
              <p>
                Rejected: <strong>{importRecord.review_notes ?? 'No notes recorded'}</strong>
              </p>
            ) : null}

            {importRecord.applied_at !== null ? (
              <p>
                Applied at <strong>{new Date(importRecord.applied_at).toLocaleString()}</strong>.
                Canonical People records were not changed.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function csrfCookie(): string | null {
  const prefix = '__Host-newax_csrf=';
  const item = document.cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  return item === undefined ? null : decodeURIComponent(item.slice(prefix.length));
}

function isApiEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    (value as { readonly success?: unknown }).success === true &&
    'data' in value
  );
}

function errorMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) {
    return null;
  }
  const error = (payload as { readonly error?: unknown }).error;
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return null;
  }
  const message = (error as { readonly message?: unknown }).message;
  return typeof message === 'string' ? message : null;
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'The request could not be completed.';
}

function parsePayload(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error('The extraction payload must be valid JSON.');
  }
}

function requireImport(
  record: CertificateImportRecord | null,
  message: string,
): CertificateImportRecord {
  if (record === null) {
    throw new Error(message);
  }
  return record;
}
