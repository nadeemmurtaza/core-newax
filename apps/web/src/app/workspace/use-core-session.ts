'use client';

import { useEffect, useState } from 'react';
import { CoreApiUnauthenticatedError, getSession, type CoreSession } from '../../lib/core-api';

type SessionState =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; session: CoreSession };

/** Shared by every /workspace page that needs to know who's signed in. */
export function useCoreSession(): SessionState {
  const [state, setState] = useState<SessionState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((session) => {
        if (!cancelled) {
          setState({ kind: 'ready', session });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        if (err instanceof CoreApiUnauthenticatedError) {
          setState({ kind: 'unauthenticated' });
        } else {
          setState({
            kind: 'error',
            message: err instanceof Error ? err.message : 'Could not check your session.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
