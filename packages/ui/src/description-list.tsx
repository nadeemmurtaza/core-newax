import { cn } from './cn';

export interface KeyValuePair {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

export interface DescriptionListProps {
  readonly items: readonly KeyValuePair[];
  readonly className?: string;
}

export function DescriptionList({ items, className }: DescriptionListProps) {
  return (
    <dl className={cn('nx-description-list', className)}>
      {items.map((item) => (
        <div key={item.key} className="nx-description-list-row">
          <dt className="nx-description-list-label">{item.label}</dt>
          <dd className="nx-description-list-value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
