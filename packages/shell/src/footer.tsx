import type { ReactNode } from 'react';
import { cn } from '@newaxhq/ui';

export interface FooterProps {
  readonly children?: ReactNode;
  readonly className?: string;
}

export function Footer({ children, className }: FooterProps) {
  return <footer className={cn('nx-footer', className)}>{children}</footer>;
}
