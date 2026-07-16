'use client';

import { useEffect } from 'react';
import { getStablecoinOptions } from '@myorg/modules/dashboard/data-access';
import { getAccessToken, logoutAndRedirect, useAuth } from '@myorg/shared/util-auth';

const SESSION_POLL_INTERVAL = 10_000;

/**
 * SessionGuard keeps the current session valid by polling a real authenticated API.
 *
 * The chosen endpoint is lightweight and already exists in the live product flow,
 * so this avoids introducing any mock or synthetic "heartbeat" endpoint.
 */
export function SessionGuard() {
  const { isAuthenticated } = useAuth();

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

  return null;
}
