'use client';

import Link from 'next/link';
import { TopBar } from './components/top-bar';
import { useCoreSession } from './use-core-session';

/**
 * Screen 4 (Personal / Business chooser) from the design brief.
 *
 * Open question, recorded rather than invented: "Personal Space" (per the
 * brief, "belongs to that user", distinct from any organization) has no
 * backing surface in core-newax today -- apps/api's domain is entirely
 * organization-scoped (memberships, tenants, organizations). "Open
 * Personal" below links to nID's own account page, which is the closest
 * real thing to a personal space today; a dedicated Personal workspace is
 * a separate, larger piece of work.
 */
export default function WorkspaceChooserPage() {
  const session = useCoreSession();

  if (session.kind === 'loading') {
    return (
      <>
        <TopBar />
        <div className="ws-transition">
          <span className="ws-spinner" aria-hidden="true" />
          <span>Loading…</span>
        </div>
      </>
    );
  }

  if (session.kind === 'unauthenticated' || session.kind === 'error') {
    return (
      <>
        <TopBar />
        <main className="ws-page ws-page-narrow">
          <EmptyAuthState {...(session.kind === 'error' ? { message: session.message } : {})} />
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar />
      <main className="ws-page ws-page-narrow">
        <h1>Where would you like to work?</h1>
        <p>Personal and business work stay connected, without mixing data or permissions.</p>

        <div className="ws-choice-grid">
          <div className="ws-choice-card">
            <h3>Personal</h3>
            <p>Your private space.</p>
            <a
              href={process.env.NEXT_PUBLIC_NID_ACCOUNT_URL ?? 'http://localhost:3300/account'}
              className="ws-btn"
            >
              Open Personal
            </a>
          </div>
          <div className="ws-choice-card">
            <h3>Business</h3>
            <p>Organizations you are authorized to use.</p>
            <Link href="/workspace/organizations" className="ws-btn">
              Open Business
            </Link>
          </div>
        </div>

        <p style={{ marginTop: 20, fontSize: '0.8rem' }}>
          You can switch spaces later without signing in again.
        </p>
      </main>
    </>
  );
}

function EmptyAuthState({ message }: { message?: string }) {
  return (
    <div className="ws-card" style={{ textAlign: 'center' }}>
      <h1>Sign in to continue</h1>
      <p>{message ?? 'You need to sign in with your NEWAX ID before choosing a workspace.'}</p>
      <a
        href={process.env.NEXT_PUBLIC_NID_SIGNIN_URL ?? 'http://localhost:3300/signin'}
        className="ws-btn"
      >
        Sign in to NEWAX
      </a>
    </div>
  );
}
