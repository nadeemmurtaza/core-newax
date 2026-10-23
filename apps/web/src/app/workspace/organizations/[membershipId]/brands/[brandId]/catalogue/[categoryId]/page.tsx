'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Alert } from '../../../../../../components/alert';
import { EmptyState } from '../../../../../../components/empty-state';
import { StatusPill } from '../../../../../../components/status-pill';
import { TopBar } from '../../../../../../components/top-bar';
import { useCoreSession } from '../../../../../../use-core-session';
import {
  CoreApiError,
  CoreApiUnauthenticatedError,
  getServiceCategory,
  type CatalogueCategory,
  type ServiceAvailability,
} from '../../../../../../../../lib/core-api';

type CatState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; category: CatalogueCategory };

const STATUS_COPY: Record<
  ServiceAvailability,
  { label: string; tone: 'positive' | 'warning' | 'neutral' | 'negative' }
> = {
  active: { label: 'Active', tone: 'positive' },
  available: { label: 'Available', tone: 'neutral' },
  setup_required: { label: 'Setup required', tone: 'warning' },
  unavailable: { label: 'Unavailable', tone: 'negative' },
};

/** CORE-SVC-03 (Service Category): one category, no unrelated clutter. */
export default function ServiceCategoryPage() {
  const router = useRouter();
  const params = useParams<{ membershipId: string; brandId: string; categoryId: string }>();
  const session = useCoreSession();
  const [state, setState] = useState<CatState>({ kind: 'loading' });

  useEffect(() => {
    if (session.kind !== 'ready') {
      return;
    }
    getServiceCategory(params.membershipId, params.brandId, params.categoryId)
      .then((category) => setState({ kind: 'ready', category }))
      .catch((err: unknown) => {
        if (err instanceof CoreApiUnauthenticatedError) {
          router.replace('/workspace/unauthorized');
          return;
        }
        setState({
          kind: 'error',
          message: err instanceof CoreApiError ? err.message : 'Could not load this category.',
        });
      });
  }, [session.kind, params.membershipId, params.brandId, params.categoryId, router]);

  if (session.kind === 'loading' || state.kind === 'loading') {
    return (
      <>
        <TopBar contextLabel="Business" />
        <div className="ws-transition">
          <span className="ws-spinner" aria-hidden="true" />
          <span>Loading category…</span>
        </div>
      </>
    );
  }

  if (session.kind === 'unauthenticated') {
    router.replace('/workspace/unauthorized');
    return null;
  }

  const base = `/workspace/organizations/${params.membershipId}/brands/${params.brandId}`;

  return (
    <>
      <TopBar contextLabel="Business" />
      <main className="ws-page">
        {session.kind === 'error' || state.kind === 'error' ? (
          <Alert>
            {session.kind === 'error' ? session.message : (state as { message: string }).message}
          </Alert>
        ) : state.kind === 'ready' ? (
          <>
            <h1>{state.category.label}</h1>
            {state.category.description && <p>{state.category.description}</p>}

            {state.category.services.length === 0 ? (
              <EmptyState>No services are available in this category yet.</EmptyState>
            ) : (
              <div className="ws-org-list">
                {state.category.services.map((service) => {
                  const status = STATUS_COPY[service.availability];
                  const launchable = service.availability !== 'unavailable';
                  return (
                    <div className="ws-org-row" key={service.id}>
                      <div className="ws-org-identity">
                        <div className="ws-org-name">{service.displayName}</div>
                        <div className="ws-org-meta">{service.outcomeDescription}</div>
                      </div>
                      <div className="ws-org-actions">
                        <StatusPill tone={status.tone}>{status.label}</StatusPill>
                        {launchable ? (
                          <Link href={`${base}/launch/${service.code}`} className="ws-btn">
                            Open
                          </Link>
                        ) : (
                          <button type="button" className="ws-btn-secondary" disabled>
                            Open
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : null}

        <p style={{ marginTop: 20, fontSize: '0.8rem' }}>
          <Link href={`${base}/catalogue`}>&larr; Back to all services</Link>
        </p>
      </main>
    </>
  );
}
