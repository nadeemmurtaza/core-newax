'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Alert } from '../../../../components/alert';
import { EmptyState } from '../../../../components/empty-state';
import { TopBar } from '../../../../components/top-bar';
import { useCoreSession } from '../../../../use-core-session';
import {
  CoreApiError,
  CoreApiUnauthenticatedError,
  getBrandCatalogue,
  type CatalogueCategory,
} from '../../../../../../lib/core-api';

type CatState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; categories: CatalogueCategory[] };

/**
 * CORE-SVC-01 (Brand Overview). Per its required content: category entry
 * points, not every individual service at once -- the full flat list is
 * CORE-SVC-02's job, reached via "Browse all services".
 */
export default function BrandOverviewPage() {
  const router = useRouter();
  const params = useParams<{ membershipId: string; brandId: string }>();
  const session = useCoreSession();
  const [state, setState] = useState<CatState>({ kind: 'loading' });

  useEffect(() => {
    if (session.kind !== 'ready') {
      return;
    }
    getBrandCatalogue(params.membershipId, params.brandId)
      .then((categories) => setState({ kind: 'ready', categories }))
      .catch((err: unknown) => {
        if (err instanceof CoreApiUnauthenticatedError) {
          router.replace('/workspace/unauthorized');
          return;
        }
        setState({
          kind: 'error',
          message: err instanceof CoreApiError ? err.message : 'Could not load this brand.',
        });
      });
  }, [session.kind, params.membershipId, params.brandId, router]);

  if (session.kind === 'loading' || state.kind === 'loading') {
    return (
      <>
        <TopBar contextLabel="Business" />
        <div className="ws-transition">
          <span className="ws-spinner" aria-hidden="true" />
          <span>Loading brand…</span>
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
        <h1>Services</h1>
        <p>Jump into a category, or browse everything available.</p>

        {session.kind === 'error' || state.kind === 'error' ? (
          <Alert>
            {session.kind === 'error' ? session.message : (state as { message: string }).message}
          </Alert>
        ) : state.kind === 'ready' && state.categories.length === 0 ? (
          <EmptyState>
            No services are enabled for this brand yet. An authorized admin can turn services on
            from brand configuration.
          </EmptyState>
        ) : state.kind === 'ready' ? (
          <>
            <div
              className="ws-choice-grid"
              style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
            >
              {state.categories.map((category) => (
                <div className="ws-choice-card" key={category.id}>
                  <h3>{category.label}</h3>
                  <p>
                    {category.services.length} service{category.services.length === 1 ? '' : 's'}
                  </p>
                  <Link href={`${base}/catalogue/${category.id}`} className="ws-btn">
                    Open
                  </Link>
                </div>
              ))}
            </div>

            <p style={{ marginTop: 20 }}>
              <Link href={`${base}/catalogue`} className="ws-btn ws-btn-secondary">
                Browse all services
              </Link>
            </p>
          </>
        ) : null}

        <p style={{ marginTop: 20, fontSize: '0.8rem' }}>
          <Link href={`/workspace/organizations/${params.membershipId}/brands`}>
            &larr; Switch brand
          </Link>
        </p>
      </main>
    </>
  );
}
