'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import styles from './people-intake-dashboard.module.css';
import {
  draftToApiBody,
  emptyIdentifier,
  emptyPerson,
  emptyRelationship,
  initialFamilyIntakeDraft,
  maskIdentifier,
  type DraftIdentifier,
  type DraftPerson,
  type DraftRelationship,
  type FamilyIntakeDraft,
  validateFamilyIntakeDraft,
} from './people-intake-model';

interface Membership {
  readonly membership_id: string;
  readonly organization_id: string;
  readonly organization_display_name: string;
  readonly membership_type: string;
}

interface IntakeSummary {
  readonly id: string;
  readonly title: string;
  readonly source_type: string;
  readonly source_reference: string | null;
  readonly status: 'draft' | 'submitted' | 'approved' | 'rejected';
  readonly person_count: number;
  readonly relationship_count: number;
  readonly version: number;
  readonly created_by_user_id: string;
  readonly submitted_at: string | null;
  readonly reviewed_at: string | null;
  readonly review_notes: string | null;
  readonly updated_at: string;
}

interface IntakeRecord extends IntakeSummary {
  readonly payload: {
    readonly schema_version: 1;
    readonly people: readonly {
      readonly client_key: string;
      readonly first_name: string;
      readonly middle_name: string | null;
      readonly last_name: string;
      readonly preferred_name: string | null;
      readonly date_of_birth: string | null;
      readonly gender: string | null;
      readonly identifiers: readonly {
        readonly identifier_type: string;
        readonly identifier_value: string;
        readonly issuing_authority: string | null;
        readonly issuing_country_code: string | null;
      }[];
    }[];
    readonly relationships: readonly {
      readonly source_person_key: string;
      readonly target_person_key: string;
      readonly relationship_type: string;
      readonly relationship_role: string;
      readonly relationship_basis: string;
    }[];
  };
}

interface ApiEnvelope<T> {
  readonly success: true;
  readonly data: T;
}

interface Message {
  readonly tone: 'neutral' | 'success' | 'error';
  readonly text: string;
}

function localId(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

export function PeopleIntakeDashboard() {
  const [memberships, setMemberships] = useState<readonly Membership[]>([]);
  const [membershipId, setMembershipId] = useState('');
  const [draft, setDraft] = useState<FamilyIntakeDraft>(() => initialFamilyIntakeDraft());
  const [intakes, setIntakes] = useState<readonly IntakeSummary[]>([]);
  const [reviewRecord, setReviewRecord] = useState<IntakeRecord | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [message, setMessage] = useState<Message>({
    tone: 'neutral',
    text: 'No data has been saved.',
  });
  const [busy, setBusy] = useState(false);
  const issues = useMemo(() => validateFamilyIntakeDraft(draft), [draft]);
  const selectedMembership =
    memberships.find((item) => item.membership_id === membershipId) ?? null;
  const savedDrafts = intakes.filter((item) => item.status === 'draft');
  const reviewQueue = intakes.filter((item) => item.status === 'submitted');

  const request = useCallback(
    async <T,>(path: string, init: RequestInit = {}, requiresMembership = false): Promise<T> => {
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
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = errorMessage(payload);
        throw new Error(error ?? `Request failed with status ${String(response.status)}.`);
      }
      return (payload as ApiEnvelope<T>).data;
    },
    [membershipId],
  );

  const loadIntakes = useCallback(async () => {
    if (membershipId.length === 0) {
      return;
    }
    try {
      const response = await request<{ readonly items: readonly IntakeSummary[] }>(
        '/api/core/organizations/current/people-intakes?limit=100',
        {},
        true,
      );
      setIntakes(response.items);
    } catch (error) {
      setMessage({ tone: 'error', text: messageFrom(error) });
    }
  }, [membershipId, request]);

  useEffect(() => {
    const controller = new AbortController();
    void request<readonly Membership[]>('/api/account/memberships', {
      signal: controller.signal,
    })
      .then((response) => {
        if (!controller.signal.aborted) {
          setMemberships(response);
          setMembershipId((current) => current || response[0]?.membership_id || '');
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setMessage({ tone: 'error', text: messageFrom(error) });
        }
      });
    return () => controller.abort();
  }, [request]);

  useEffect(() => {
    if (membershipId.length === 0) {
      return undefined;
    }
    const controller = new AbortController();
    void request<{ readonly items: readonly IntakeSummary[] }>(
      '/api/core/organizations/current/people-intakes?limit=100',
      { signal: controller.signal },
      true,
    )
      .then((response) => {
        if (!controller.signal.aborted) {
          setIntakes(response.items);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setMessage({ tone: 'error', text: messageFrom(error) });
        }
      });
    return () => controller.abort();
  }, [membershipId, request]);

  function updatePerson(localIdValue: string, patch: Partial<DraftPerson>): void {
    setDraft((current) => ({
      ...current,
      people: current.people.map((person) =>
        person.localId === localIdValue ? { ...person, ...patch } : person,
      ),
    }));
  }

  function updateIdentifier(
    personLocalId: string,
    identifierLocalId: string,
    patch: Partial<DraftIdentifier>,
  ): void {
    setDraft((current) => ({
      ...current,
      people: current.people.map((person) =>
        person.localId === personLocalId
          ? {
              ...person,
              identifiers: person.identifiers.map((identifier) =>
                identifier.localId === identifierLocalId ? { ...identifier, ...patch } : identifier,
              ),
            }
          : person,
      ),
    }));
  }

  function updateRelationship(localIdValue: string, patch: Partial<DraftRelationship>): void {
    setDraft((current) => ({
      ...current,
      relationships: current.relationships.map((relationship) =>
        relationship.localId === localIdValue ? { ...relationship, ...patch } : relationship,
      ),
    }));
  }

  function changeMembership(nextMembershipId: string): void {
    setMembershipId(nextMembershipId);
    setIntakes([]);
    setDraft(initialFamilyIntakeDraft());
    setReviewRecord(null);
    setReviewNotes('');
    setMessage({
      tone: 'neutral',
      text:
        nextMembershipId.length === 0
          ? 'Select an organization to begin.'
          : 'Organization changed. A new unsaved draft is ready.',
    });
  }

  async function saveDraft(): Promise<void> {
    if (issues.length > 0) {
      setMessage({ tone: 'error', text: 'Resolve the validation issues before saving.' });
      return;
    }
    setBusy(true);
    try {
      const base = draftToApiBody(draft);
      const record =
        draft.intakeId === null
          ? await request<IntakeRecord>(
              '/api/core/organizations/current/people-intakes',
              { method: 'POST', body: JSON.stringify(base) },
              true,
            )
          : await request<IntakeRecord>(
              `/api/core/organizations/current/people-intakes/${draft.intakeId}`,
              {
                method: 'PUT',
                body: JSON.stringify({ ...base, expected_version: draft.version }),
              },
              true,
            );
      setDraft(fromRecord(record));
      setMessage({ tone: 'success', text: `Draft saved at version ${String(record.version)}.` });
      await loadIntakes();
    } catch (error) {
      setMessage({ tone: 'error', text: messageFrom(error) });
    } finally {
      setBusy(false);
    }
  }

  async function submitDraft(): Promise<void> {
    if (draft.intakeId === null || draft.version === null) {
      setMessage({ tone: 'error', text: 'Save the draft before submission.' });
      return;
    }
    setBusy(true);
    try {
      const record = await request<IntakeRecord>(
        `/api/core/organizations/current/people-intakes/${draft.intakeId}/submit`,
        { method: 'POST', body: JSON.stringify({ expected_version: draft.version }) },
        true,
      );
      setDraft(fromRecord(record));
      setMessage({
        tone: 'success',
        text: 'Submitted for independent verification. The content is now immutable.',
      });
      await loadIntakes();
    } catch (error) {
      setMessage({ tone: 'error', text: messageFrom(error) });
    } finally {
      setBusy(false);
    }
  }

  async function openDraft(id: string): Promise<void> {
    setBusy(true);
    try {
      const record = await request<IntakeRecord>(
        `/api/core/organizations/current/people-intakes/${id}`,
        {},
        true,
      );
      if (record.status !== 'draft') {
        throw new Error('Only draft intakes can be reopened for editing.');
      }
      setDraft(fromRecord(record));
      setReviewRecord(null);
      setReviewNotes('');
      setMessage({
        tone: 'success',
        text: `Draft loaded at version ${String(record.version)}.`,
      });
    } catch (error) {
      setMessage({ tone: 'error', text: messageFrom(error) });
    } finally {
      setBusy(false);
    }
  }

  async function openReview(id: string): Promise<void> {
    setBusy(true);
    try {
      const record = await request<IntakeRecord>(
        `/api/core/organizations/current/people-intakes/${id}`,
        {},
        true,
      );
      setReviewRecord(record);
      setReviewNotes('');
    } catch (error) {
      setMessage({ tone: 'error', text: messageFrom(error) });
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: 'approved' | 'rejected'): Promise<void> {
    if (reviewRecord === null) {
      return;
    }
    if (decision === 'rejected' && reviewNotes.trim().length === 0) {
      setMessage({ tone: 'error', text: 'Add reviewer notes before rejecting.' });
      return;
    }
    setBusy(true);
    try {
      const record = await request<IntakeRecord>(
        `/api/core/organizations/current/people-intakes/${reviewRecord.id}/review`,
        {
          method: 'POST',
          body: JSON.stringify({
            expected_version: reviewRecord.version,
            decision,
            notes: reviewNotes.trim().length === 0 ? null : reviewNotes,
          }),
        },
        true,
      );
      setReviewRecord(record);
      setMessage({
        tone: 'success',
        text:
          decision === 'approved'
            ? 'Intake approved. No canonical people were created.'
            : 'Intake rejected with reviewer notes.',
      });
      await loadIntakes();
    } catch (error) {
      setMessage({ tone: 'error', text: messageFrom(error) });
    } finally {
      setBusy(false);
    }
  }

  const editable = draft.status === 'draft';

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <Link className={styles.brand} href="/">
            NEWAX
          </Link>
          <p className={styles.kicker}>People Intake · Internal Operations</p>
          <h1>Family data entry and verification</h1>
          <p className={styles.lead}>
            Enter proposed people and relationships, verify the complete family picture, and keep
            unreviewed data outside the canonical registry.
          </p>
        </div>
        <div className={styles.securityCard}>
          <strong>Controlled staging</strong>
          <span>Drafts and approvals do not create canonical people.</span>
        </div>
      </header>

      <section className={styles.contextBar} aria-label="Organization context">
        <label>
          Organization
          <select value={membershipId} onChange={(event) => changeMembership(event.target.value)}>
            <option value="">Select organization</option>
            {memberships.map((membership) => (
              <option key={membership.membership_id} value={membership.membership_id}>
                {membership.organization_display_name} · {membership.membership_type}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span>Current context</span>
          <strong>
            {selectedMembership?.organization_display_name ?? 'No organization selected'}
          </strong>
        </div>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => void loadIntakes()}
          disabled={busy || membershipId.length === 0}
        >
          Refresh workspace
        </button>
      </section>

      <div className={`${styles.message} ${styles[message.tone]}`} role="status">
        {message.text}
      </div>

      <div className={styles.workspace}>
        <section className={styles.editor} aria-labelledby="draft-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Draft workspace</p>
              <h2 id="draft-title">Enter the family record</h2>
            </div>
            <span className={styles.statusBadge} data-status={draft.status}>
              {draft.status}
            </span>
          </div>

          <div className={styles.metadataGrid}>
            <label>
              Intake title
              <input
                value={draft.title}
                disabled={!editable}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Family certificate review"
              />
            </label>
            <label>
              Source type
              <input
                value={draft.sourceType}
                disabled={!editable}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, sourceType: event.target.value }))
                }
                placeholder="nadra_crc"
              />
            </label>
            <label>
              Source reference
              <input
                value={draft.sourceReference}
                disabled={!editable}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, sourceReference: event.target.value }))
                }
                placeholder="Internal document reference"
              />
            </label>
          </div>

          <div className={styles.blockHeader}>
            <div>
              <p className={styles.eyebrow}>People</p>
              <h3>One card per real human</h3>
            </div>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={!editable}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  people: [
                    ...current.people,
                    emptyPerson(localId('person'), `person_${String(current.people.length + 1)}`),
                  ],
                }))
              }
            >
              Add person
            </button>
          </div>

          <div className={styles.peopleList}>
            {draft.people.map((person, personIndex) => (
              <article key={person.localId} className={styles.personCard}>
                <div className={styles.cardTitle}>
                  <div>
                    <span>Person {personIndex + 1}</span>
                    <strong>
                      {[person.firstName, person.lastName].filter(Boolean).join(' ') ||
                        'Unnamed person'}
                    </strong>
                  </div>
                  <button
                    type="button"
                    className={styles.textButton}
                    disabled={!editable || draft.people.length === 1}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        people: current.people.filter((item) => item.localId !== person.localId),
                        relationships: current.relationships.filter(
                          (item) =>
                            item.sourcePersonKey !== person.clientKey &&
                            item.targetPersonKey !== person.clientKey,
                        ),
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
                <div className={styles.personGrid}>
                  <label>
                    Person key
                    <input
                      value={person.clientKey}
                      disabled={!editable}
                      onChange={(event) =>
                        updatePerson(person.localId, { clientKey: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    First name
                    <input
                      value={person.firstName}
                      disabled={!editable}
                      onChange={(event) =>
                        updatePerson(person.localId, { firstName: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Middle name
                    <input
                      value={person.middleName}
                      disabled={!editable}
                      onChange={(event) =>
                        updatePerson(person.localId, { middleName: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Last name
                    <input
                      value={person.lastName}
                      disabled={!editable}
                      onChange={(event) =>
                        updatePerson(person.localId, { lastName: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Preferred name
                    <input
                      value={person.preferredName}
                      disabled={!editable}
                      onChange={(event) =>
                        updatePerson(person.localId, { preferredName: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Date of birth
                    <input
                      type="date"
                      value={person.dateOfBirth}
                      disabled={!editable}
                      onChange={(event) =>
                        updatePerson(person.localId, { dateOfBirth: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Gender code
                    <input
                      value={person.gender}
                      disabled={!editable}
                      onChange={(event) =>
                        updatePerson(person.localId, { gender: event.target.value })
                      }
                      placeholder="female"
                    />
                  </label>
                </div>
                <div className={styles.identifierHeader}>
                  <strong>Official identifiers</strong>
                  <button
                    type="button"
                    className={styles.textButton}
                    disabled={!editable}
                    onClick={() =>
                      updatePerson(person.localId, {
                        identifiers: [
                          ...person.identifiers,
                          emptyIdentifier(localId('identifier')),
                        ],
                      })
                    }
                  >
                    Add identifier
                  </button>
                </div>
                {person.identifiers.length === 0 ? (
                  <p className={styles.empty}>
                    No identifier added. Names alone do not prove identity.
                  </p>
                ) : null}
                {person.identifiers.map((identifier) => (
                  <div key={identifier.localId} className={styles.identifierRow}>
                    <label>
                      Type
                      <input
                        value={identifier.identifierType}
                        disabled={!editable}
                        onChange={(event) =>
                          updateIdentifier(person.localId, identifier.localId, {
                            identifierType: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Value
                      <input
                        value={identifier.identifierValue}
                        disabled={!editable}
                        autoComplete="off"
                        onChange={(event) =>
                          updateIdentifier(person.localId, identifier.localId, {
                            identifierValue: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Country
                      <input
                        value={identifier.issuingCountryCode}
                        disabled={!editable}
                        onChange={(event) =>
                          updateIdentifier(person.localId, identifier.localId, {
                            issuingCountryCode: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Authority
                      <input
                        value={identifier.issuingAuthority}
                        disabled={!editable}
                        onChange={(event) =>
                          updateIdentifier(person.localId, identifier.localId, {
                            issuingAuthority: event.target.value,
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.textButton}
                      disabled={!editable}
                      onClick={() =>
                        updatePerson(person.localId, {
                          identifiers: person.identifiers.filter(
                            (item) => item.localId !== identifier.localId,
                          ),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </article>
            ))}
          </div>

          <div className={styles.blockHeader}>
            <div>
              <p className={styles.eyebrow}>Relationships</p>
              <h3>Connect existing draft people</h3>
            </div>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={!editable || draft.people.length < 2}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  relationships: [
                    ...current.relationships,
                    emptyRelationship(
                      localId('relationship'),
                      current.people[0]?.clientKey ?? '',
                      current.people[1]?.clientKey ?? '',
                    ),
                  ],
                }))
              }
            >
              Add relationship
            </button>
          </div>

          {draft.relationships.length === 0 ? (
            <p className={styles.emptyPanel}>No relationships added yet.</p>
          ) : (
            <div className={styles.relationshipList}>
              {draft.relationships.map((relationship) => (
                <div key={relationship.localId} className={styles.relationshipRow}>
                  <label>
                    From
                    <select
                      value={relationship.sourcePersonKey}
                      disabled={!editable}
                      onChange={(event) =>
                        updateRelationship(relationship.localId, {
                          sourcePersonKey: event.target.value,
                        })
                      }
                    >
                      {draft.people.map((person) => (
                        <option key={person.localId} value={person.clientKey}>
                          {person.clientKey || 'unnamed'}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Relationship
                    <input
                      value={relationship.relationshipType}
                      disabled={!editable}
                      onChange={(event) =>
                        updateRelationship(relationship.localId, {
                          relationshipType: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Role
                    <input
                      value={relationship.relationshipRole}
                      disabled={!editable}
                      onChange={(event) =>
                        updateRelationship(relationship.localId, {
                          relationshipRole: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Basis
                    <input
                      value={relationship.relationshipBasis}
                      disabled={!editable}
                      onChange={(event) =>
                        updateRelationship(relationship.localId, {
                          relationshipBasis: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    To
                    <select
                      value={relationship.targetPersonKey}
                      disabled={!editable}
                      onChange={(event) =>
                        updateRelationship(relationship.localId, {
                          targetPersonKey: event.target.value,
                        })
                      }
                    >
                      {draft.people.map((person) => (
                        <option key={person.localId} value={person.clientKey}>
                          {person.clientKey || 'unnamed'}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className={styles.textButton}
                    disabled={!editable}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        relationships: current.relationships.filter(
                          (item) => item.localId !== relationship.localId,
                        ),
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={busy}
              onClick={() => {
                setDraft(initialFamilyIntakeDraft());
                setReviewRecord(null);
                setReviewNotes('');
                setMessage({ tone: 'neutral', text: 'New unsaved draft started.' });
              }}
            >
              New draft
            </button>
            <button
              type="button"
              disabled={busy || !editable || membershipId.length === 0}
              onClick={() => void saveDraft()}
            >
              {busy ? 'Working…' : draft.intakeId === null ? 'Save draft' : 'Save changes'}
            </button>
            <button
              type="button"
              className={styles.submitButton}
              disabled={busy || !editable || draft.intakeId === null || issues.length > 0}
              onClick={() => void submitDraft()}
            >
              Submit for verification
            </button>
          </div>
        </section>

        <aside className={styles.sidebar}>
          <section className={styles.panel}>
            <p className={styles.eyebrow}>Validation</p>
            <h2>
              {issues.length === 0
                ? 'Ready to save'
                : `${String(issues.length)} issue${issues.length === 1 ? '' : 's'}`}
            </h2>
            {issues.length === 0 ? (
              <p className={styles.successText}>
                The draft has a valid local structure. Server validation still applies.
              </p>
            ) : (
              <ul className={styles.issueList}>
                {issues.slice(0, 12).map((item) => (
                  <li key={`${item.field}-${item.message}`}>
                    <strong>{item.field}</strong>
                    <span>{item.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.panel}>
            <p className={styles.eyebrow}>Family preview</p>
            <h2>Understand the links</h2>
            {draft.relationships.length === 0 ? (
              <p className={styles.empty}>Add relationships to see a readable preview.</p>
            ) : (
              <div className={styles.previewList}>
                {draft.relationships.map((relationship) => (
                  <div key={relationship.localId} className={styles.previewLink}>
                    <strong>{personLabel(draft.people, relationship.sourcePersonKey)}</strong>
                    <span>
                      {relationship.relationshipType} · {relationship.relationshipRole} ·{' '}
                      {relationship.relationshipBasis}
                    </span>
                    <strong>{personLabel(draft.people, relationship.targetPersonKey)}</strong>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.maskedList}>
              {draft.people.flatMap((person) =>
                person.identifiers.map((identifier) => (
                  <div key={identifier.localId}>
                    <span>{personLabel(draft.people, person.clientKey)}</span>
                    <code>
                      {identifier.identifierType}: {maskIdentifier(identifier.identifierValue)}
                    </code>
                  </div>
                )),
              )}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.blockHeader}>
              <div>
                <p className={styles.eyebrow}>Saved drafts</p>
                <h2>{String(savedDrafts.length)} editable</h2>
              </div>
            </div>
            {savedDrafts.length === 0 ? (
              <p className={styles.empty}>No saved drafts in this organization.</p>
            ) : (
              <div className={styles.queueList}>
                {savedDrafts.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={styles.queueItem}
                    disabled={busy}
                    onClick={() => void openDraft(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <span>
                      {item.person_count} people · {item.relationship_count} relationships · version{' '}
                      {item.version}
                    </span>
                    <small>Updated {new Date(item.updated_at).toLocaleString()}</small>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.blockHeader}>
              <div>
                <p className={styles.eyebrow}>Verification queue</p>
                <h2>{String(reviewQueue.length)} waiting</h2>
              </div>
            </div>
            {reviewQueue.length === 0 ? (
              <p className={styles.empty}>No submitted intakes in this organization.</p>
            ) : (
              <div className={styles.queueList}>
                {reviewQueue.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={styles.queueItem}
                    onClick={() => void openReview(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <span>
                      {item.person_count} people · {item.relationship_count} relationships
                    </span>
                    <small>
                      {item.submitted_at === null
                        ? 'Submission time unavailable'
                        : new Date(item.submitted_at).toLocaleString()}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      {reviewRecord !== null ? (
        <section className={styles.reviewPanel} aria-labelledby="review-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Independent verification</p>
              <h2 id="review-title">{reviewRecord.title}</h2>
            </div>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => setReviewRecord(null)}
            >
              Close review
            </button>
          </div>
          <div className={styles.reviewSummary}>
            <div>
              <span>Source</span>
              <strong>{reviewRecord.source_type}</strong>
            </div>
            <div>
              <span>People</span>
              <strong>{reviewRecord.person_count}</strong>
            </div>
            <div>
              <span>Relationships</span>
              <strong>{reviewRecord.relationship_count}</strong>
            </div>
            <div>
              <span>Version</span>
              <strong>{reviewRecord.version}</strong>
            </div>
          </div>
          <div className={styles.reviewPeople}>
            {reviewRecord.payload.people.map((person) => (
              <article key={person.client_key}>
                <h3>
                  {person.first_name} {person.middle_name ?? ''} {person.last_name}
                </h3>
                <p>
                  {person.date_of_birth ?? 'Date of birth not supplied'} ·{' '}
                  {person.gender ?? 'Gender not supplied'}
                </p>
                {person.identifiers.map((identifier) => (
                  <div
                    key={`${person.client_key}-${identifier.identifier_type}-${identifier.identifier_value}`}
                    className={styles.sensitiveValue}
                  >
                    <span>{identifier.identifier_type}</span>
                    <code>{identifier.identifier_value}</code>
                    <small>
                      {identifier.issuing_authority ?? 'Authority not supplied'} ·{' '}
                      {identifier.issuing_country_code ?? 'Country not supplied'}
                    </small>
                  </div>
                ))}
              </article>
            ))}
          </div>
          <div className={styles.reviewRelationships}>
            {reviewRecord.payload.relationships.map((relationship, index) => (
              <div
                key={`${relationship.source_person_key}-${relationship.target_person_key}-${String(index)}`}
              >
                <strong>{relationship.source_person_key}</strong>
                <span>
                  {relationship.relationship_type} / {relationship.relationship_role} /{' '}
                  {relationship.relationship_basis}
                </span>
                <strong>{relationship.target_person_key}</strong>
              </div>
            ))}
          </div>
          {reviewRecord.status === 'submitted' ? (
            <div className={styles.reviewDecision}>
              <label>
                Reviewer notes
                <textarea
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  placeholder="Required for rejection; optional for approval."
                />
              </label>
              <div>
                <button
                  type="button"
                  className={styles.rejectButton}
                  disabled={busy}
                  onClick={() => void decide('rejected')}
                >
                  Reject with notes
                </button>
                <button type="button" disabled={busy} onClick={() => void decide('approved')}>
                  Approve intake
                </button>
              </div>
            </div>
          ) : (
            <p className={styles.decisionNotice}>
              Decision: <strong>{reviewRecord.status}</strong>. Approval does not create canonical
              people.
            </p>
          )}
        </section>
      ) : null}
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

function personLabel(people: readonly DraftPerson[], key: string): string {
  const person = people.find((item) => item.clientKey === key);
  if (person === undefined) {
    return key || 'Unknown person';
  }
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || person.clientKey;
}

function fromRecord(record: IntakeRecord): FamilyIntakeDraft {
  return {
    intakeId: record.id,
    version: record.version,
    status: record.status,
    title: record.title,
    sourceType: record.source_type,
    sourceReference: record.source_reference ?? '',
    people: record.payload.people.map((person, personIndex) => ({
      localId: `loaded-person-${String(personIndex)}-${person.client_key}`,
      clientKey: person.client_key,
      firstName: person.first_name,
      middleName: person.middle_name ?? '',
      lastName: person.last_name,
      preferredName: person.preferred_name ?? '',
      dateOfBirth: person.date_of_birth ?? '',
      gender: person.gender ?? '',
      identifiers: person.identifiers.map((identifier, identifierIndex) => ({
        localId: `loaded-identifier-${String(personIndex)}-${String(identifierIndex)}`,
        identifierType: identifier.identifier_type,
        identifierValue: identifier.identifier_value,
        issuingAuthority: identifier.issuing_authority ?? '',
        issuingCountryCode: identifier.issuing_country_code ?? '',
      })),
    })),
    relationships: record.payload.relationships.map((relationship, index) => ({
      localId: `loaded-relationship-${String(index)}`,
      sourcePersonKey: relationship.source_person_key,
      targetPersonKey: relationship.target_person_key,
      relationshipType: relationship.relationship_type,
      relationshipRole: relationship.relationship_role,
      relationshipBasis: relationship.relationship_basis,
    })),
  };
}
