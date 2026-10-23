import { cn } from './cn';

export interface DividerProps {
  readonly orientation?: 'horizontal' | 'vertical';
  readonly className?: string;
}

export function Divider({ orientation = 'horizontal', className }: DividerProps) {
  return (
    <hr
      className={cn('nx-divider', orientation === 'vertical' && 'nx-divider-vertical', className)}
      aria-orientation={orientation}
    />
  );
}
