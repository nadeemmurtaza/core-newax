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
  listBrands,
  type Brand,
} from '../../../../../lib/core-api';

type ListState =
  { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; brands: Brand[] };

/**
 * Brand selection -- the step the catalogue addendum's "Core -> Brand
 * Overview -> Category -> Service/Module -> Destination Workspace"
 * navigation rule assumes already happened. Not one of the addendum's
 * numbered CORE-SVC pages (it starts at Brand Overview, brand already
 * selected), but a real organization can have zero, one, or several
 * brands, so this step has to exist somewhere. A single brand skips
 * straight to its overview -- no pointless intermediate click.
 */
export default function BrandSelectorPage() {
  const router = useRouter();
  const params = useParams<{ membershipId: string }>();
  const session = useCoreSession();
  const [state, setState] = useState<ListState>({ kind: 'loading' });

  useEffect(() => {
    if (session.kind !== 'ready') {
      return;
    }
    listBrands(params.membershipId)
      .then((brands) => {
        if (brands.length === 1) {
          router.replace(`/workspace/organizations/${params.membershipId}/brands/${brands[0]!.id}`);
          return;
        }
        setState({ kind: 'ready', brands });
      })
      .catch((err: unknown) => {
        if (err instanceof CoreApiUnauthenticatedError) {
          router.replace('/workspace/unauthorized');
          return;
        }
        setState({
          kind: 'error',
          message: err instanceof CoreApiError ? err.message : 'Could not load brands.',
        });
      });
  }, [session.kind, params.membershipId, router]);

  if (session.kind === 'loading' || state.kind === 'loading') {
    return (
      <>
        <TopBar contextLabel="Business" />
        <div className="ws-transition">
          <span className="ws-spinner" aria-hidden="true" />
          <span>Loading brands…</span>
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
      <main className="ws-page ws-page-narrow">
        <h1>Choose a brand</h1>
        <p>Pick which brand to work in.</p>

        {session.kind === 'error' || state.kind === 'error' ? (
          <Alert>
            {session.kind === 'error' ? session.message : (state as { message: string }).message}
          </Alert>
        ) : state.kind === 'ready' && state.brands.length === 0 ? (
          <EmptyState>
            No brands are set up for this organization yet. Ask an administrator to create one.
          </EmptyState>
        ) : state.kind === 'ready' ? (
          <div className="ws-org-list">
            {state.brands.map((brand) => (
              <div className="ws-org-row" key={brand.id}>
                <div className="ws-org-identity">
                  <div className="ws-org-name">{brand.displayName}</div>
                </div>
                <Link
                  href={`/workspace/organizations/${params.membershipId}/brands/${brand.id}`}
                  className="ws-btn"
                >
                  Open
                </Link>
              </div>
            ))}
          </div>
        ) : null}

        <p style={{ marginTop: 20, fontSize: '0.8rem' }}>
          <Link href={`/workspace/organizations/${params.membershipId}`}>
            &larr; Back to workspace
          </Link>
        </p>
      </main>
    </>
  );
}
