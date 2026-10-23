'use client';

import { useSearchParams } from 'next/navigation';
import { TopBar } from '../components/top-bar';

const REASON_COPY: Record<string, string> = {
  'session-expired': 'Your session has expired. Sign in again to continue.',
  'no-session': 'You need to sign in with your NEWAX ID to view this.',
  'access-expired': 'Your access to this organization has expired.',
  'access-revoked': 'Your access to this organization has been removed.',
};

/**
 * Extra screen #1 (unauthorized / expired access) added alongside the
 * brief's 8 core screens. Every /workspace page routes here instead of
 * silently rendering an error when the session or organization context is
 * invalid -- matching the brief's "remain in or return to a safe state"
 * rule for screen 6, generalized into one reusable page rather than a
 * copy of the same message on every screen.
 */
export default function UnauthorizedPage() {
  const params = useSearchParams();
  const reason = params.get('reason');
  const message = (reason && REASON_COPY[reason]) ?? 'You don’t have access to this.';

  return (
    <>
      <TopBar />
      <main className="ws-page ws-page-narrow">
        <div className="ws-card" style={{ textAlign: 'center' }}>
          <h1>Access unavailable</h1>
          <p>{message}</p>
          <a
            href={process.env.NEXT_PUBLIC_NID_SIGNIN_URL ?? 'http://localhost:3300/signin'}
            className="ws-btn"
          >
            Sign in to NEWAX
          </a>
        </div>
      </main>
    </>
  );
}
