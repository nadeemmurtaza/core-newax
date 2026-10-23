import { cn } from '@newaxhq/ui';

/** The parent of a path, one segment up -- the sensible default back
 * target for a page one level deep in a flow (e.g. "/invoices/123" -> "/invoices"). */
export function parentPath(path: string): string {
  const segments = path.split('/').filter((segment) => segment.length > 0);
  if (segments.length <= 1) {
    return '/';
  }
  return `/${segments.slice(0, -1).join('/')}`;
}

export interface BackLinkProps {
  readonly href: string;
  readonly label?: string;
  readonly className?: string;
}

export function BackLink({ href, label = 'Back', className }: BackLinkProps) {
  return (
    <a href={href} className={cn('nx-back-link', className)}>
      <span aria-hidden="true">&larr;</span> {label}
    </a>
  );
}
