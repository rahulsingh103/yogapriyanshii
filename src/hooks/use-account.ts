import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { AccountView } from '../types';

// Not a secret, only "this browser logged in before". With no hint, an anonymous visit makes no
// account request at all.
const HINT = 'yp_has_session';

const hasHint = () => {
  try {
    return window.localStorage.getItem(HINT) === '1';
  } catch {
    return false;
  }
};

const setHint = (on: boolean) => {
  try {
    if (on) window.localStorage.setItem(HINT, '1');
    else window.localStorage.removeItem(HINT);
  } catch {
    // Storage blocked: the header just shows Log in after a reload.
  }
};

/** A slow answer stops holding the header back after this; a late account still swaps in. */
const CHECK_TIMEOUT_MS = 4000;

/** `checking`: a hint exists and /me hasn't answered, so the header keeps its slots empty. */
export function useAccount() {
  const [account, setAccountState] = useState<AccountView | null>(null);
  const [checking, setChecking] = useState(hasHint);
  // Logged in or out in the sheet already: a late /me answer is older news and is ignored.
  const changedRef = useRef(false);

  useEffect(() => {
    if (!hasHint()) return;
    let live = true;
    const timeout = window.setTimeout(() => setChecking(false), CHECK_TIMEOUT_MS);
    api.getAccount().then(
      (res) => {
        if (!live || changedRef.current) return;
        setAccountState(res.account);
        if (!res.account) setHint(false);
        setChecking(false);
      },
      () => {
        // Any failure shows Log in and Sign up. The hint stays, so the next load checks again.
        if (live) setChecking(false);
      }
    );
    return () => {
      live = false;
      window.clearTimeout(timeout);
    };
  }, []);

  const setAccount = useCallback((next: AccountView | null) => {
    changedRef.current = true;
    setChecking(false);
    setAccountState(next);
    setHint(next !== null);
  }, []);

  return { account, checking, setAccount };
}
