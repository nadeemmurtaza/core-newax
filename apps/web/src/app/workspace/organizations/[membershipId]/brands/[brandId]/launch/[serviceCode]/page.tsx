'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { TopBar } from '../../../../../../components/top-bar';
import { useCoreSession } from '../../../../../../use-core-session';
import {
  CoreApiError,
  CoreApiUnauthenticatedError,
  resolveServiceLaunch,
  type CatalogueService,
  type LaunchOutcome,
} from '../../../../../../../../lib/core-api';

type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'resolved'; service: CatalogueService | null; launch: LaunchOutcome };

/**
 * CORE-SVC-05 (Direct Module Workspace Entry) + CORE-SVC-09 (Launch
 * States) together: this page's whole job is resolving and showing the
 * outcome of clicking a service, so a success-only entry page and a
 * separate failure-only states page would just be the same screen split
 * in two. "Clicking POS lands on POS" is the acceptance bar -- here, every
 * outcome short of a real secure handoff is honestly blocked_no_bridge,
 * not a fake landing (see catalogue.service.ts's resolveLaunch).
 */
export default function ServiceLaunchPage() {
  const router = useRouter();
  const params = useParams<{ membershipId: string; brandId: string; serviceCode: string }>();
  const session = useCoreSession();
  const [state, setState] = useState<PageState>({ kind: 'loading' });

  useEffect(() => {
    if (session.kind !== 'ready') {
      return;
    }
    resolveServiceLaunch(params.membershipId, params.brandId, params.serviceCode)
      .then(({ service, launch }) => setState({ kind: 'resolved', service, launch }))
      .catch((err: unknown) => {
        if (err instanceof CoreApiUnauthenticatedError) {
          router.replace('/workspace/unauthorized');
          return;
        }
        setState({
          kind: 'error',
          message: err instanceof CoreApiError ? err.message : 'Launch failed. Try again.',
        });
      });
  }, [session.kind, params.membershipId, params.brandId, params.serviceCode, router]);

  const catalogueHref = `/workspace/organizations/${params.membershipId}/brands/${params.brandId}/catalogue`;

  if (session.kind === 'loading' || state.kind === 'loading') {
    return (
      <>
        <TopBar contextLabel="Business" />
        <div className="ws-transition">
          <span className="ws-spinner" aria-hidden="true" />
          <span>Opening…</span>
        </div>
      </>
    );
  }

  if (session.kind === 'unauthenticated') {
    router.replace('/workspace/unauthorized');
    return null;
  }

  if (session.kind === 'error' || state.kind === 'error') {
    return (
      <LaunchResult
        title="Launch failed"
        body={session.kind === 'error' ? session.message : (state as { message: string }).message}
        catalogueHref={catalogueHref}
        showRetry
      />
    );
  }

  const { service, launch } = state;
  const name = service?.displayName ?? params.serviceCode;

  switch (launch.outcome) {
    case 'not_found':
      return (
        <LaunchResult
          title="Service not found"
          body={`"${params.serviceCode}" isn't in this brand's catalogue.`}
          catalogueHref={catalogueHref}
        />
      );
    case 'unavailable':
      return (
        <LaunchResult
          title="Unavailable"
          body={
            launch.reason === 'disabled'
              ? `${name} has been disabled for this brand.`
              : `${name} isn't included in this brand's plan yet.`
          }
          catalogueHref={catalogueHref}
        />
      );
    case 'setup_required':
      return (
        <LaunchResult
          title="Setup required"
          body={`${name} needs to be set up before it can be opened. Ask an authorized administrator to complete setup.`}
          catalogueHref={catalogueHref}
        />
      );
    case 'blocked_no_bridge':
      return (
        <LaunchResult
          title="Secure launch not yet available"
          body={`${name} is active for this brand, but NEWAX Core can't yet hand off a secure session to its application. This is a known, tracked gap, not a bug with this service.`}
          catalogueHref={catalogueHref}
        />
      );
  }
}

function LaunchResult({
  title,
  body,
  catalogueHref,
  showRetry,
}: {
  title: string;
  body: string;
  catalogueHref: string;
  showRetry?: boolean;
}) {
  return (
    <>
      <TopBar contextLabel="Business" />
      <main className="ws-page ws-page-narrow">
        <div className="ws-card" style={{ textAlign: 'center' }}>
          <h1>{title}</h1>
          <p>{body}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
            {showRetry && (
              <button
                type="button"
                className="ws-btn-secondary"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            )}
            <Link href={catalogueHref} className="ws-btn">
              Back to catalogue
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
