import { cn } from './cn';

export type AvatarSize = 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<AvatarSize, string> = {
  sm: 'nx-avatar-sm',
  md: 'nx-avatar-md',
  lg: 'nx-avatar-lg',
};

export function avatarClassName(size: AvatarSize = 'md', className?: string): string {
  return cn('nx-avatar', SIZE_CLASS[size], className);
}

export interface AvatarProps {
  readonly name: string;
  readonly imageUrl?: string | null;
  readonly size?: AvatarSize;
  readonly className?: string;
}

export function Avatar({ name, imageUrl, size = 'md', className }: AvatarProps) {
  return imageUrl ? (
    <img src={imageUrl} alt="" className={avatarClassName(size, className)} />
  ) : (
    <span className={avatarClassName(size, className)} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export interface AvatarGroupProps {
  readonly avatars: readonly AvatarProps[];
  readonly max?: number;
  readonly className?: string;
}

export function AvatarGroup({ avatars, max = 4, className }: AvatarGroupProps) {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - visible.length;

  return (
    <div className={cn('nx-avatar-group', className)}>
      {visible.map((avatar, index) => (
        <Avatar key={`${avatar.name}-${index}`} {...avatar} />
      ))}
      {overflow > 0 ? <span className="nx-avatar-group-overflow">+{overflow}</span> : null}
    </div>
  );
}
