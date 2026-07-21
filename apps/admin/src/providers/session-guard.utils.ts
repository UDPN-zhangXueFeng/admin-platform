export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
export const LAST_ACTIVITY_STORAGE_KEY = 'admin_platform_last_activity_at';

/** Development must never enforce inactivity logout, even when config is enabled. */
export function isInactivityLogoutEnabled(
  isConfigured: boolean,
  nodeEnv = process.env.NODE_ENV,
): boolean {
  return isConfigured && nodeEnv !== 'development';
}

/** Wall-clock comparison keeps timeout correct after background timer throttling or sleep. */
export function hasExceededInactivityTimeout(
  lastActivityAt: number,
  now = Date.now(),
): boolean {
  return now - lastActivityAt >= INACTIVITY_TIMEOUT_MS;
}

export function readLastActivityAt(): number | null {
  try {
    const value = window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
    const timestamp = Number(value);
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
  } catch {
    return null;
  }
}

export function writeLastActivityAt(timestamp: number): void {
  try {
    window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(timestamp));
  } catch {
    // A storage failure must not prevent the current tab from enforcing timeout.
  }
}
