export interface SkipLinkProps {
  readonly targetId: string;
}

/** Visually hidden until focused -- the first focusable element on the
 * page, so keyboard users can jump past header/nav straight to content. */
export function SkipLink({ targetId }: SkipLinkProps) {
  return (
    <a href={`#${targetId}`} className="nx-skip-link">
      Skip to content
    </a>
  );
}
