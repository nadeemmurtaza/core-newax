'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Alert } from '../../../components/alert';
import { StatusPill } from '../../../components/status-pill';
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

const CAPABILITY_COPY: Record<string, string> = {
  organizationView: 'View organization profile',
  organizationManage: 'Manage organization profile',
  peopleView: 'View people records',
  peopleManage: 'Manage people records',
  membershipsView: 'View memberships',
  membershipsManage: 'Manage memberships',
  usersView: 'View users',
  usersManage: 'Manage users',
  accessControlView: 'View access control',
  accessControlManage: 'Manage access control',
};

/**
 * Screen 7 (Invitations and access status) from the design brief.
 *
 * Shows the real, specific access this membership grants -- "Can view and
 * create invoices in ABC Distribution" over "Has business access" (the
 * brief's own copy guidance) -- built from the real capability flags
 * GET /account/organization-context returns.
 *
 * Open question, recorded rather than invented: the brief's wireframe also
 * shows temporary-access expiry and an invitation history/flow. Neither
 * membership status, expiry, nor an invitation list exist in apps/api
 * today (see the organizations page's note, and the invite page's).
 */
export default function AccessStatusPage() {
  const router = useRouter();
  const params = useParams<{ membershipId: string }>();
  const session = useCoreSession();
  const [state, setState] = useState<ContextState>({ kind: 'loading' });

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
          message: err instanceof CoreApiError ? err.message : 'Could not load access status.',
        });
      });
  }, [session.kind, params.membershipId, router]);

  if (session.kind === 'loading' || state.kind === 'loading') {
    return (
      <>
        <TopBar contextLabel="Business" />
        <div className="ws-transition">
          <span className="ws-spinner" aria-hidden="true" />
          <span>Loading access status…</span>
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
  const granted = Object.entries(context.capabilities).filter(([, allowed]) => allowed);

  return (
    <>
      <TopBar contextLabel="Business" organizationLabel={context.organization.displayName} />
      <main className="ws-page ws-page-narrow">
        <h1>Organization access</h1>

        <div className="ws-card">
          <div className="ws-field">
            <dt>Organization</dt>
            <dd>{context.organization.displayName}</dd>
          </div>
          <div className="ws-field">
            <dt>Role</dt>
            <dd>{context.membership.jobTitle ?? context.membership.type}</dd>
          </div>
          <div className="ws-field">
            <dt>Access</dt>
            <dd>
              {granted.length > 0
                ? granted.map(([key]) => CAPABILITY_COPY[key] ?? key).join(', ')
                : 'No elevated permissions'}
            </dd>
          </div>
          <div className="ws-field">
            <dt>Status</dt>
            <dd>
              <StatusPill tone="positive">Active</StatusPill>
            </dd>
          </div>
        </div>

        <p style={{ marginTop: 20, fontSize: '0.8rem' }}>
          <Link href={`/workspace/organizations/${params.membershipId}`}>
            &larr; Back to workspace
          </Link>
        </p>
      </main>
    </>
  );
}
