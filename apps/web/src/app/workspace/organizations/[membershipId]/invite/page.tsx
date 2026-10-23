'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Alert } from '../../../components/alert';
import { EmptyState } from '../../../components/empty-state';
import { TopBar } from '../../../components/top-bar';
import { useCoreSession } from '../../../use-core-session';
import {
  CoreApiError,
  CoreApiUnauthenticatedError,
  confirmOrganizationContext,
  type OrganizationContext,
} from '../../../../../lib/core-api';

type ContextState =
  | { kind: 'loading' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'ready'; context: OrganizationContext };

/**
 * Extra screen #2 (org-admin invite management), added alongside the
 * brief's 8 core screens -- the administrator's side of screen 7's
 * invitation flow ("Organization administrator enters the invitee's
 * verified email or phone... selects organization, role, permitted
 * resources/actions, and expiry").
 *
 * Gated on `membershipsManage` (the real capability flag
 * GET /account/organization-context returns) rather than just being
 * reachable by URL -- a non-admin sees the same Unauthorized screen as an
 * invalid session, not a broken form.
 *
 * Open question, recorded rather than invented: apps/api has no invite
 * endpoint yet (no POST that creates a pending membership, no listing of
 * pending invites). The form below is real UI -- validated fields, the
 * role/permission/expiry inputs the brief asks for -- but its submit is
 * disabled with that stated explicitly, instead of pretending to send an
 * invite that goes nowhere.
 */
export default function InviteManagementPage() {
  const router = useRouter();
  const params = useParams<{ membershipId: string }>();
  const session = useCoreSession();
  const [state, setState] = useState<ContextState>({ kind: 'loading' });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');

  useEffect(() => {
    if (session.kind !== 'ready') {
      return;
    }
    confirmOrganizationContext(params.membershipId)
      .then((context) => setState({ kind: 'ready', context }))
      .catch((err: unknown) => {
        if (err instanceof CoreApiUnauthenticatedError) {
          router.replace('/workspace/unauthorized');
          return;
        }
        setState({
          kind: 'unavailable',
          message: err instanceof CoreApiError ? err.message : 'Could not load this organization.',
        });
      });
  }, [session.kind, params.membershipId, router]);

  if (session.kind === 'loading' || state.kind === 'loading') {
    return (
      <>
        <TopBar contextLabel="Business" />
        <div className="ws-transition">
          <span className="ws-spinner" aria-hidden="true" />
          <span>Loading…</span>
        </div>
      </>
    );
  }

  if (session.kind === 'unauthenticated') {
    router.replace('/workspace/unauthorized');
    return null;
  }

  if (session.kind === 'error' || state.kind === 'unavailable') {
    return (
      <>
        <TopBar contextLabel="Business" />
        <main className="ws-page ws-page-narrow">
          <Alert>
            {session.kind === 'error' ? session.message : (state as { message: string }).message}
          </Alert>
        </main>
      </>
    );
  }

  const { context } = state;

  if (!context.capabilities.membershipsManage) {
    router.replace('/workspace/unauthorized?reason=access-revoked');
    return null;
  }

  return (
    <>
      <TopBar contextLabel="Business" organizationLabel={context.organization.displayName} />
      <main className="ws-page ws-page-narrow">
        <h1>Invite someone to {context.organization.displayName}</h1>
        <p>Enter their verified email or phone, then choose a role, access, and optional expiry.</p>

        <form
          className="ws-card"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div className="ws-form-row">
            <label htmlFor="invite-identifier">Email or phone</label>
            <input
              id="invite-identifier"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </div>

          <div className="ws-form-row">
            <label htmlFor="invite-role">Role</label>
            <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="manager">Manager</option>
              <option value="owner">Owner</option>
            </select>
          </div>

          <div className="ws-form-row">
            <label htmlFor="invite-expiry">Access expires (optional)</label>
            <input id="invite-expiry" type="date" />
          </div>

          <button type="submit" disabled title="Sending invitations isn't available yet">
            Send invitation
          </button>
          <p className="ws-form-hint" style={{ marginTop: 8 }}>
            Sending invitations isn&apos;t connected to a backend endpoint yet.
          </p>
        </form>

        <h2 style={{ marginTop: 28 }}>Pending invitations</h2>
        <EmptyState>Listing pending invitations isn&apos;t available yet.</EmptyState>

        <p style={{ marginTop: 20, fontSize: '0.8rem' }}>
          <Link href={`/workspace/organizations/${params.membershipId}`}>
            &larr; Back to workspace
          </Link>
        </p>
      </main>
    </>
  );
}
