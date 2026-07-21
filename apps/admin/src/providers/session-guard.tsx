'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getStablecoinOptions } from '@myorg/modules/dashboard/data-access';
import { logoutApi } from '@myorg/modules/auth/data-access';
import { useFeatures } from '@myorg/shared/util-config';
import {
  getAccessToken,
  logoutAndRedirect,
  useAuth,
} from '@myorg/shared/util-auth';
import {
  hasExceededInactivityTimeout,
  INACTIVITY_TIMEOUT_MS,
  isInactivityLogoutEnabled,
  LAST_ACTIVITY_STORAGE_KEY,
  readLastActivityAt,
  writeLastActivityAt,
} from './session-guard.utils';

const SESSION_POLL_INTERVAL = 10_000;
const ACTIVITY_EVENTS = [
  'pointerdown',
  'keydown',
  'touchstart',
  'scroll',
] as const;
const ACTIVITY_PERSIST_INTERVAL_MS = 1_000;

/**
 * SessionGuard keeps the current session valid by polling a real authenticated API.
 *
 * The chosen endpoint is lightweight and already exists in the live product flow,
 * so this avoids introducing any mock or synthetic "heartbeat" endpoint.
 */
export function SessionGuard() {
  const { isAuthenticated } = useAuth();
  const { inactivityLogout } = useFeatures();
  const isInactivityLogoutActive = isInactivityLogoutEnabled(inactivityLogout);
  const isLogoutInProgressRef = useRef(false);

  const handleInactivityLogout = useCallback(async () => {
    if (isLogoutInProgressRef.current) return;

    isLogoutInProgressRef.current = true;
    try {
      await logoutApi();
    } catch {
      // Local cleanup must still happen when the server session has already expired.
    } finally {
      logoutAndRedirect();
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    let stopped = false;

    const verifySession = async () => {
      if (stopped) return;

      const token = getAccessToken();
      if (!token) {
        logoutAndRedirect();
        return;
      }

      try {
        await getStablecoinOptions();
      } catch {
        if (!getAccessToken()) {
          logoutAndRedirect();
        }
      }
    };

    void verifySession();
    const timer = window.setInterval(() => {
      void verifySession();
    }, SESSION_POLL_INTERVAL);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !isInactivityLogoutActive) return;

    const storedLastActivityAt = readLastActivityAt();
    let lastActivityAt = storedLastActivityAt ?? Date.now();
    let lastPersistedActivityAt = lastActivityAt;
    let timeoutId: number | undefined;

    if (storedLastActivityAt === null) {
      writeLastActivityAt(lastActivityAt);
    }

    const clearTimeout = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    };

    const scheduleTimeout = () => {
      clearTimeout();
      const remaining = INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivityAt);
      if (remaining <= 0) {
        void handleInactivityLogout();
        return;
      }
      timeoutId = window.setTimeout(checkInactivity, remaining);
    };

    const checkInactivity = () => {
      if (hasExceededInactivityTimeout(lastActivityAt)) {
        void handleInactivityLogout();
        return;
      }
      scheduleTimeout();
    };

    const recordActivity = () => {
      const now = Date.now();
      lastActivityAt = now;

      if (now - lastPersistedActivityAt >= ACTIVITY_PERSIST_INTERVAL_MS) {
        lastPersistedActivityAt = now;
        writeLastActivityAt(now);
        scheduleTimeout();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkInactivity();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LAST_ACTIVITY_STORAGE_KEY) return;

      const sharedLastActivityAt = readLastActivityAt();
      if (sharedLastActivityAt === null) {
        if (!getAccessToken()) logoutAndRedirect();
        return;
      }

      lastActivityAt = sharedLastActivityAt;
      lastPersistedActivityAt = sharedLastActivityAt;
      scheduleTimeout();
    };

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, { passive: true });
    });
    window.addEventListener('focus', checkInactivity);
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    scheduleTimeout();

    return () => {
      clearTimeout();
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity);
      });
      window.removeEventListener('focus', checkInactivity);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleInactivityLogout, isAuthenticated, isInactivityLogoutActive]);

  return null;
}
