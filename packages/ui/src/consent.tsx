import type { ReactNode } from 'react';
import { cn } from './cn';
import { Button } from './button';
import { Switch } from './switch';

/**
 * Presentation only -- these components display choices and whatever
 * policy text/category list the app supplies. They decide nothing about
 * which cookies run, what counts as valid consent, or what the legal
 * text says; a dedicated consent-management layer (not this package)
 * records preferences and enforces them. A banner that looks right but
 * doesn't block non-essential scripts until the user has actually
 * consented is a liability, not a feature of this component.
 */
export interface CookieConsentBannerProps {
  readonly message: string;
  readonly onAcceptAll: () => void;
  readonly onRejectNonEssential: () => void;
  readonly onCustomize: () => void;
  readonly className?: string;
}

export function CookieConsentBanner({
  message,
  onAcceptAll,
  onRejectNonEssential,
  onCustomize,
  className,
}: CookieConsentBannerProps) {
  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className={cn('nx-cookie-consent-banner', className)}
    >
      <p className="nx-cookie-consent-message">{message}</p>
      <div className="nx-cookie-consent-actions">
        <Button variant="ghost" onClick={onCustomize}>
          Customize
        </Button>
        <Button variant="secondary" onClick={onRejectNonEssential}>
          Reject non-essential
        </Button>
        <Button variant="primary" onClick={onAcceptAll}>
          Accept all
        </Button>
      </div>
    </div>
  );
}

export interface LegalNoticeProps {
  readonly title: string;
  readonly body: ReactNode;
  readonly href?: string;
  readonly className?: string;
}

/** Shared shape for PrivacyNotice/TermsNotice/LegalDisclosure -- the
 * actual legal text and URL are the app's (or legal team's) to supply. */
export function LegalNotice({ title, body, href, className }: LegalNoticeProps) {
  return (
    <section className={cn('nx-legal-notice', className)}>
      <h2 className="nx-legal-notice-title">{title}</h2>
      <div className="nx-legal-notice-body">{body}</div>
      {href ? (
        <a href={href} className="nx-legal-notice-link">
          Read the full policy
        </a>
      ) : null}
    </section>
  );
}

export interface PolicyUpdateBannerProps {
  readonly message: string;
  readonly href: string;
  readonly onDismiss: () => void;
  readonly className?: string;
}

export function PolicyUpdateBanner({
  message,
  href,
  onDismiss,
  className,
}: PolicyUpdateBannerProps) {
  return (
    <div role="status" className={cn('nx-policy-update-banner', className)}>
      <p>{message}</p>
      <a href={href}>Review changes</a>
      <button type="button" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

export interface ConsentCategory {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly required: boolean;
}

export interface ConsentPreferenceDialogProps {
  readonly categories: readonly ConsentCategory[];
  readonly selected: ReadonlySet<string>;
  readonly onToggleCategory: (categoryId: string, enabled: boolean) => void;
  readonly onSave: () => void;
  readonly className?: string;
}

export function ConsentPreferenceDialog({
  categories,
  selected,
  onToggleCategory,
  onSave,
  className,
}: ConsentPreferenceDialogProps) {
  return (
    <div className={cn('nx-consent-preferences', className)}>
      <ul className="nx-consent-category-list">
        {categories.map((category) => (
          <li key={category.id} className="nx-consent-category">
            <div className="nx-consent-category-text">
              <p className="nx-consent-category-label">{category.label}</p>
              <p className="nx-consent-category-description">{category.description}</p>
            </div>
            <Switch
              checked={category.required || selected.has(category.id)}
              onCheckedChange={(enabled) => onToggleCategory(category.id, enabled)}
              disabled={category.required}
              aria-label={category.label}
            />
          </li>
        ))}
      </ul>
      <Button variant="primary" onClick={onSave}>
        Save preferences
      </Button>
    </div>
  );
}

export interface ConsentStatusProps {
  readonly category: string;
  readonly granted: boolean;
  readonly className?: string;
}

export function ConsentStatus({ category, granted, className }: ConsentStatusProps) {
  return (
    <span
      className={cn(
        'nx-consent-status',
        granted ? 'nx-consent-status-granted' : 'nx-consent-status-denied',
        className,
      )}
    >
      {category}: {granted ? 'Granted' : 'Denied'}
    </span>
  );
}
