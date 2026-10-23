import type { BreadcrumbItem } from './types';

function humanizeSegment(segment: string): string {
  return segment
    .split('-')
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Builds a breadcrumb trail from a path, one item per segment, each href
 * accumulating the segments before it. `labels` overrides a segment's
 * humanized default (e.g. a dynamic id segment like "a1b2c3" that needs
 * the record's real name instead of being title-cased literally).
 */
export function buildBreadcrumbsFromPath(
  path: string,
  labels: Readonly<Record<string, string>> = {},
): readonly BreadcrumbItem[] {
  const segments = path.split('/').filter((segment) => segment.length > 0);

  let href = '';
  return segments.map((segment) => {
    href = `${href}/${segment}`;
    return {
      id: segment,
      label: labels[segment] ?? humanizeSegment(segment),
      href,
    };
  });
}
