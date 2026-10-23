import { cn } from './cn';
import { buildPaginationWindow } from './pagination-window';

export interface PaginationProps {
  readonly currentPage: number;
  readonly totalPages: number;
  readonly onPageChange: (page: number) => void;
  readonly siblingCount?: number;
  readonly className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  className,
}: PaginationProps) {
  const tokens = buildPaginationWindow(currentPage, totalPages, siblingCount);

  return (
    <nav aria-label="Pagination" className={cn('nx-pagination', className)}>
      <button
        type="button"
        className="nx-pagination-prev"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Previous page"
      >
        Previous
      </button>

      <ul className="nx-pagination-list">
        {tokens.map((token, index) =>
          token === 'ellipsis' ? (
            <li key={`ellipsis-${index}`} className="nx-pagination-ellipsis" aria-hidden="true">
              &hellip;
            </li>
          ) : (
            <li key={token}>
              <button
                type="button"
                className={cn(
                  'nx-pagination-page',
                  token === currentPage && 'nx-pagination-page-current',
                )}
                aria-current={token === currentPage ? 'page' : undefined}
                onClick={() => onPageChange(token)}
              >
                {token}
              </button>
            </li>
          ),
        )}
      </ul>

      <button
        type="button"
        className="nx-pagination-next"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Next page"
      >
        Next
      </button>
    </nav>
  );
}
