'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Alert } from '../../../../../components/alert';
import { EmptyState } from '../../../../../components/empty-state';
import { StatusPill } from '../../../../../components/status-pill';
import { TopBar } from '../../../../../components/top-bar';
import { useCoreSession } from '../../../../../use-core-session';
import {
  CoreApiError,
  CoreApiUnauthenticatedError,
  getBrandCatalogue,
  type CatalogueCategory,
  type ServiceAvailability,
} from '../../../../../../../lib/core-api';

type CatState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; categories: CatalogueCategory[] };

const STATUS_COPY: Record<
  ServiceAvailability,
  { label: string; tone: 'positive' | 'warning' | 'neutral' | 'negative' }
> = {
  active: { label: 'Active', tone: 'positive' },
  available: { label: 'Available', tone: 'neutral' },
  setup_required: { label: 'Setup required', tone: 'warning' },
  unavailable: { label: 'Unavailable', tone: 'negative' },
};

/** CORE-SVC-02 (Service Catalogue): the full, searchable, categorized list. */
export default function ServiceCataloguePage() {
  const router = useRouter();
  const params = useParams<{ membershipId: string; brandId: string }>();
  const session = useCoreSession();
  const [state, setState] = useState<CatState>({ kind: 'loading' });
  const [query, setQuery] = useState('');

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
          message: err instanceof CoreApiError ? err.message : 'Could not load the catalogue.',
        });
      });
  }, [session.kind, params.membershipId, params.brandId, router]);

  const filteredCategories = useMemo(() => {
    if (state.kind !== 'ready') {
      return [];
    }
    const q = query.trim().toLowerCase();
    if (!q) {
      return state.categories;
    }
    return state.categories
      .map((c) => ({
        ...c,
        services: c.services.filter((s) => s.displayName.toLowerCase().includes(q)),
      }))
      .filter((c) => c.services.length > 0);
  }, [state, query]);

  if (session.kind === 'loading' || state.kind === 'loading') {
    return (
      <>
        <TopBar contextLabel="Business" />
        <div className="ws-transition">
          <span className="ws-spinner" aria-hidden="true" />
          <span>Loading catalogue…</span>
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
        <h1>Service catalogue</h1>
        <p>Search or browse every service available to this brand.</p>

        <input
          type="search"
          className="ws-search"
          placeholder="Search services…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search services"
        />

        {session.kind === 'error' || state.kind === 'error' ? (
          <Alert>
            {session.kind === 'error' ? session.message : (state as { message: string }).message}
          </Alert>
        ) : state.kind === 'ready' && state.categories.length === 0 ? (
          <EmptyState>
            No services are enabled for this brand yet. An authorized admin can turn services on
            from brand configuration.
          </EmptyState>
        ) : filteredCategories.length === 0 ? (
          <EmptyState>No services match &quot;{query}&quot;.</EmptyState>
        ) : (
          filteredCategories.map((category) => (
            <section key={category.id} style={{ marginTop: 24 }}>
              <h2>
                <Link href={`${base}/catalogue/${category.id}`}>{category.label}</Link>
              </h2>
              <div className="ws-org-list">
                {category.services.map((service) => {
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
            </section>
          ))
        )}

        <p style={{ marginTop: 20, fontSize: '0.8rem' }}>
          <Link href={base}>&larr; Back to brand overview</Link>
        </p>
      </main>
    </>
  );
}
