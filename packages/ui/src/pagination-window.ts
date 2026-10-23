export type PaginationToken = number | 'ellipsis';

/**
 * Computes which page numbers to show -- first, last, the current page's
 * neighbors, and "ellipsis" for the gaps -- instead of rendering every
 * page, which is unusable past a handful of pages.
 */
export function buildPaginationWindow(
  currentPage: number,
  totalPages: number,
  siblingCount = 1,
): readonly PaginationToken[] {
  if (totalPages <= 0) {
    return [];
  }

  const windowSize = siblingCount * 2 + 5; // first, last, current, 2 ellipses
  if (totalPages <= windowSize) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const left = Math.max(currentPage - siblingCount, 2);
  const right = Math.min(currentPage + siblingCount, totalPages - 1);

  const tokens: PaginationToken[] = [1];
  if (left > 2) {
    tokens.push('ellipsis');
  }
  for (let page = left; page <= right; page += 1) {
    tokens.push(page);
  }
  if (right < totalPages - 1) {
    tokens.push('ellipsis');
  }
  tokens.push(totalPages);

  return tokens;
}
