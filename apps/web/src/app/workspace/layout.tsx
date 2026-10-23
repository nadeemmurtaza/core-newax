import type { ReactNode } from 'react';
import './workspace.css';

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <div className="ws">{children}</div>;
}
