type PillTone = 'neutral' | 'positive' | 'warning' | 'negative';

export function StatusPill({ tone = 'neutral', children }: { tone?: PillTone; children: string }) {
  return <span className={`ws-pill ws-pill-${tone}`}>{children}</span>;
}
