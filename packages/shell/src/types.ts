import type { ReactNode } from 'react';

export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly iconKey?: string | null;
  readonly children?: readonly NavItem[];
}

export interface BreadcrumbItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
}

export interface AppIdentity {
  readonly id: string;
  readonly name: string;
  readonly logo?: ReactNode;
  readonly homeHref: string;
}

export interface SwitcherOption {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly href: string;
}

export interface UserProfile {
  readonly displayName: string;
  readonly email?: string;
  readonly avatarUrl?: string | null;
}

export interface UserMenuAction {
  readonly id: string;
  readonly label: string;
  readonly href?: string;
  readonly onSelect?: () => void;
  readonly destructive?: boolean;
}

export type StatusBannerTone = 'info' | 'warning' | 'critical';

export interface StatusBannerContent {
  readonly id: string;
  readonly tone: StatusBannerTone;
  readonly message: string;
  readonly dismissible: boolean;
}
