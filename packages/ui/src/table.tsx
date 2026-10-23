import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from './cn';

/** Primitives, not a data-table framework -- sorting/filtering/virtualization
 * are per-app concerns. These wrap the native table elements so every app
 * gets the same class hooks instead of each one styling <table> by hand. */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('nx-table', className)} {...props} />;
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('nx-table-head', className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('nx-table-body', className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('nx-table-row', className)} {...props} />;
}

export function TableHeaderCell({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('nx-table-header-cell', className)} {...props} />;
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('nx-table-cell', className)} {...props} />;
}
