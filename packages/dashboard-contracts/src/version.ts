/**
 * The dashboard contract's own version -- distinct from LAYOUT_SCHEMA_VERSION
 * (layout.ts), which only versions the stored-layout shape. This versions
 * the whole registration/widget/adapter contract a service codes against.
 * Bump on any breaking change to ServiceRegistration, WidgetDefinition, or
 * WidgetDataAdapterRef's required fields.
 */
export const DASHBOARD_CONTRACT_VERSION = '1.0.0' as const;

interface SemVer {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

function parseSemVer(version: string): SemVer | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * A service registered against `serviceVersion` is compatible with the
 * shell's `shellVersion` only when the major version matches -- Core may
 * ignore fields it doesn't understand yet (additive minor/patch changes),
 * but a major bump signals a required-field change the service must
 * update for, so the shell should refuse to render it rather than guess.
 */
export function isContractCompatible(shellVersion: string, serviceVersion: string): boolean {
  const shell = parseSemVer(shellVersion);
  const service = parseSemVer(serviceVersion);
  if (!shell || !service) {
    return false;
  }
  return shell.major === service.major;
}
