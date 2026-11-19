export const LOGIN_SWEEP_STORAGE_KEY = 'admin-platform:header-sweep-on-login';

/** Best-effort mark that the next app-shell mount should play one sweep. */
export function markHeaderSweepOnLogin(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(LOGIN_SWEEP_STORAGE_KEY, '1');
  } catch {
    // Storage unavailable — skip the one-shot effect.
  }
}

/** Reads and clears the pending marker. */
export function consumeHeaderSweepOnLogin(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const isPending =
      window.sessionStorage.getItem(LOGIN_SWEEP_STORAGE_KEY) === '1';
    if (!isPending) return false;
    window.sessionStorage.removeItem(LOGIN_SWEEP_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
