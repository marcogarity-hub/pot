'use client';

import { useEffect, useState } from 'react';

export type Me = { email: string; wallet_address: string };

/** The signed-in user's email and wallet, or null when signed out. */
export function useMe(): { me: Me | null; loading: boolean } {
  const [state, setState] = useState<{ me: Me | null; loading: boolean }>({ me: null, loading: true });
  useEffect(() => {
    let cancelled = false;
    fetch('/api/wallet/me')
      .then(async res => (res.ok ? ((await res.json()) as Me) : null))
      .catch(() => null)
      .then(me => { if (!cancelled) setState({ me, loading: false }); });
    return () => { cancelled = true; };
  }, []);
  return state;
}
