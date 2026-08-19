'use client';

import * as React from 'react';
import { AppShell } from '@myorg/shared/ui-layout';
import type { ProjectConfig } from '@myorg/shared/util-config';
import { logoutAndRedirect } from '@myorg/shared/util-auth';
import { logoutApi } from '@myorg/modules/auth/data-access';

/**
 * Admin app shell — wires the admin-only server logout endpoint into the
 * shared Header. The shared Header's default logout is local-only, so apps
 * with a server session (admin rbac) pass onLogout to own the full flow:
 * server logout, then local clear + redirect (errors swallowed so a dead
 * session still logs out locally).
 */
export function AdminAppShell({
  config,
  children,
}: {
  config: ProjectConfig;
  children: React.ReactNode;
}) {
  const handleLogout = React.useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Local logout must still complete even if the server session is
      // already invalid.
    } finally {
      logoutAndRedirect();
    }
  }, []);

  return (
    <AppShell config={config} onLogout={handleLogout}>
      {children}
    </AppShell>
  );
}
