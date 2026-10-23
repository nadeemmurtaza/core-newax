export function Alert({ tone = 'error', children }: { tone?: 'error' | 'info'; children: string }) {
  return (
    <p className={`ws-alert ws-alert-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      {children}
    </p>
  );
}
