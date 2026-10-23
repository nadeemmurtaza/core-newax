'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Alert } from '../../components/alert';
import { TopBar } from '../../components/top-bar';
import { useCoreSession } from '../../use-core-session';
import {
  CoreApiError,
  CoreApiUnauthenticatedError,
  confirmOrganizationContext,
  type OrganizationContext,
} from '../../../../lib/core-api';

type ContextState =
  | { kind: 'loading' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'ready'; context: OrganizationContext };

/**
 * Screen 6 (Active workspace shell + switching) from the design brief.
 *
 * The brief's wireframe shows a full app nav (ERP, Mail, CRM, Documents,
 * Analytics) and real product content below it. Those products aren't
 * core-newax's to render -- this screen's real job, and the thing this
 * page actually does, is confirm the organization context (via
 * GET /account/organization-context, scoped by the membership ID in the
 * URL) and show it clearly before anything scoped to that organization
 * loads. The nav row below links out to each product's own subdomain
 * rather than embedding fake product UI here.
 */
export default function ActiveWorkspacePage() {
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
          message:
            err instanceof CoreApiError
              ? err.message
              : 'This organization is unavailable right now.',
        });
      });
  }, [session.kind, params.membershipId, router]);

  if (session.kind === 'loading' || state.kind === 'loading') {
    return (
      <>
        <TopBar contextLabel="Business" />
        <div className="ws-transition">
          <span className="ws-spinner" aria-hidden="true" />
          <span>Loading your workspace…</span>
        </div>
      </>
    );
  }

  if (session.kind === 'unauthenticated') {
    router.replace('/workspace/unauthorized');
    return null;
  }

  if (session.kind === 'error' || state.kind === 'unavailable') {
    // "If access validation fails, remain in or return to a safe state and
    // explain that access is unavailable. Never partially render another
    // organization's data." -- the brief, verbatim.
    return (
      <>
        <TopBar contextLabel="Business" />
        <main className="ws-page ws-page-narrow">
          <Alert>
            {session.kind === 'error' ? session.message : (state as { message: string }).message}
          </Alert>
          <Link href="/workspace/organizations" className="ws-btn">
            Back to organizations
          </Link>
        </main>
      </>
    );
  }

  const { context } = state;

  return (
    <>
      <TopBar contextLabel="Business" organizationLabel={context.organization.displayName} />
      <nav className="ws-nav" aria-label="Applications">
        <span
          className="ws-nav-active"
          style={{ padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600 }}
        >
          Overview
        </span>
        {['ERP', 'Mail', 'CRM', 'Documents', 'Analytics'].map((app) => (
          <a
            key={app}
            href="#"
            aria-disabled="true"
            title="Not yet connected to this organization context"
          >
            {app}
          </a>
        ))}
      </nav>
      <main className="ws-page">
        <h1>{context.organization.displayName}</h1>
        <p>
          {context.membership.jobTitle
            ? `${context.membership.type} · ${context.membership.jobTitle}`
            : context.membership.type}
        </p>

        <p style={{ margin: '4px 0 16px' }}>
          <Link href={`/workspace/organizations/${params.membershipId}/brands`} className="ws-btn">
            Browse services
          </Link>
        </p>

        <div className="ws-card">
          <h2>What you can do here</h2>
          <dl>
            {Object.entries(context.capabilities)
              .filter(([, allowed]) => allowed)
              .map(([key]) => (
                <div className="ws-field" key={key}>
                  <dd>{humanizeCapability(key)}</dd>
                </div>
              ))}
          </dl>
          {Object.values(context.capabilities).every((v) => !v) && (
            <p>No elevated permissions in this organization.</p>
          )}
        </div>

        <p style={{ marginTop: 20, fontSize: '0.8rem' }}>
          <Link href={`/workspace/organizations/${params.membershipId}/access`}>
            View access &amp; invitations
          </Link>
          {' · '}
          <Link href="/workspace/organizations">Switch organization</Link>
        </p>
      </main>
    </>
  );
}

function humanizeCapability(key: string): string {
  const withSpaces = key.replace(/([A-Z])/g, ' $1');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}
