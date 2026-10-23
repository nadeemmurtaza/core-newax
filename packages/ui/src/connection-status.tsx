import { cn } from './cn';

export type ConnectionState = 'online' | 'offline' | 'reconnecting';

const STATE_CLASS: Record<ConnectionState, string> = {
  online: 'nx-connection-status-online',
  offline: 'nx-connection-status-offline',
  reconnecting: 'nx-connection-status-reconnecting',
};

const STATE_LABEL: Record<ConnectionState, string> = {
  online: 'Connected',
  offline: 'Offline',
  reconnecting: 'Reconnecting…',
};

export interface ConnectionStatusProps {
  readonly state: ConnectionState;
  readonly className?: string;
}

export function ConnectionStatus({ state, className }: ConnectionStatusProps) {
  return (
    <span role="status" className={cn('nx-connection-status', STATE_CLASS[state], className)}>
      {STATE_LABEL[state]}
    </span>
  );
}
