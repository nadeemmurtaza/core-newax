import Link from 'next/link';

interface TopBarProps {
  /** e.g. "Business" or "Personal" -- omit before a context is chosen. */
  contextLabel?: string;
  contextHref?: string;
  /** The active organization's display name -- omit outside an organization. */
  organizationLabel?: string;
  organizationHref?: string;
}

/**
 * The global context switcher the brief calls for ("Keep active
 * organization name visible in the shell"), shared by every /workspace
 * screen -- one component, not a copy per page.
 */
export function TopBar({
  contextLabel,
  contextHref = '/workspace',
  organizationLabel,
  organizationHref = '/workspace/organizations',
}: TopBarProps) {
  return (
    <header className="ws-topbar">
      <div className="ws-topbar-left">
        <Link href="/workspace" className="ws-wordmark">
          NEWAX
        </Link>
        {contextLabel && (
          <>
            <span className="ws-crumb" aria-hidden="true">
              /
            </span>
            <Link href={contextHref} className="ws-switcher">
              {contextLabel} ▾
            </Link>
          </>
        )}
        {organizationLabel && (
          <Link href={organizationHref} className="ws-switcher" title={organizationLabel}>
            {organizationLabel} ▾
          </Link>
        )}
      </div>
      <div className="ws-topbar-right">
        <a
          href={process.env.NEXT_PUBLIC_NID_ACCOUNT_URL ?? 'http://localhost:3300/account'}
          className="ws-profile-link"
          aria-label="Your NEWAX account"
        >
          ●
        </a>
      </div>
    </header>
  );
}
