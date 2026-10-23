'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert } from '../components/alert';
import { EmptyState } from '../components/empty-state';
import { StatusPill } from '../components/status-pill';
import { TopBar } from '../components/top-bar';
import { useCoreSession } from '../use-core-session';
import { CoreApiError, listMyMemberships, type Membership } from '../../../lib/core-api';

type ListState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; memberships: Membership[] };

/** Screen 5 (Organization selector) from the design brief. */
export default function OrganizationSelectorPage() {
  const router = useRouter();
  const session = useCoreSession();
  const [list, setList] = useState<ListState>({ kind: 'loading' });
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (session.kind !== 'ready') {
      return;
    }
    listMyMemberships()
      .then((memberships) => setList({ kind: 'ready', memberships }))
      .catch((err: unknown) =>
        setList({
          kind: 'error',
          message: err instanceof CoreApiError ? err.message : 'Could not load organizations.',
        }),
      );
  }, [session.kind]);

  const filtered = useMemo(() => {
    if (list.kind !== 'ready') {
      return [];
    }
    const q = query.trim().toLowerCase();
    if (!q) {
      return list.memberships;
    }
    return list.memberships.filter((m) => m.organizationDisplayName.toLowerCase().includes(q));
  }, [list, query]);

  if (session.kind === 'loading' || (session.kind === 'ready' && list.kind === 'loading')) {
    return (
      <>
        <TopBar contextLabel="Business" />
        <div className="ws-transition">
          <span className="ws-spinner" aria-hidden="true" />
          <span>Loading organizations…</span>
        </div>
      </>
    );
  }

  if (session.kind === 'unauthenticated') {
    router.replace('/workspace/unauthorized');
    return null;
  }

  return (
    <>
      <TopBar contextLabel="Business" />
      <main className="ws-page">
        <h1>Choose an organization</h1>
        <p>Pick which organization to work in. You stay signed in while you switch.</p>

        <input
          type="search"
          className="ws-search"
          placeholder="Search organizations…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search organizations"
        />

        {session.kind === 'error' || list.kind === 'error' ? (
          <Alert>
            {session.kind === 'error' ? session.message : (list as { message: string }).message}
          </Alert>
        ) : filtered.length === 0 && list.kind === 'ready' && list.memberships.length === 0 ? (
          <EmptyState>
            No organizations yet. Ask an administrator to invite you, or create one below if
            you&apos;re eligible.
          </EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState>No organizations match &quot;{query}&quot;.</EmptyState>
        ) : (
          <div className="ws-org-list">
            {filtered.map((m) => (
              <div className="ws-org-row" key={m.membershipId}>
                <div className="ws-org-identity">
                  <div className="ws-org-name">{m.organizationDisplayName}</div>
                  <div className="ws-org-meta">
                    {m.jobTitle ? `${m.membershipType} · ${m.jobTitle}` : m.membershipType}
                  </div>
                </div>
                <div className="ws-org-actions">
                  <StatusPill tone="neutral">{m.membershipType}</StatusPill>
                  <Link href={`/workspace/organizations/${m.membershipId}`} className="ws-btn">
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <button type="button" className="ws-btn-secondary" disabled title="Not yet available">
            + Create organization
          </button>
        </div>

        <p style={{ marginTop: 20, fontSize: '0.8rem' }}>
          <Link href="/workspace">&larr; Back to Personal / Business</Link>
        </p>
      </main>
    </>
  );
}

/**
 * Open question, recorded rather than invented: the brief's wireframe also
 * shows "Last used recently", "Access expires: <date>", and suspended /
 * expired states per row. GET /account/memberships (the real endpoint
 * this page calls) doesn't return status, expiry, or last-used today --
 * only membership_type/job_title/start_date. Those fields belong on
 * AccountMembershipDiscoveryService next.
 */
