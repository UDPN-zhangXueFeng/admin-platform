'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';

import { AppShell } from '@myorg/shared/ui-layout';
import type { ProjectConfig } from '@myorg/shared/util-config';
import { logoutAndRedirect } from '@myorg/shared/util-auth';
import { logoutApiInBackground } from '@myorg/modules/td-admin/data-access';

// The feature library is lazy-loaded in this app (the module page registry
// imports it dynamically); the change-password dialog only renders after the
// user opens it, so it stays in its own chunk.
const ChangePasswordDialog = dynamic(
  () =>
    import('@myorg/modules/td-admin/feature').then(
      (m) => m.ChangePasswordDialog,
    ),
  { ssr: false },
);

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
  const [isChangePasswordOpen, setIsChangePasswordOpen] = React.useState(false);

  const handleLogout = React.useCallback(() => {
    // The server-side logout is slow on the live backend (~10s), so it must
    // not delay the redirect: the local session is cleared and the user is
    // sent to the login page immediately, and the server call is fired in the
    // background. The old td-manage project did the same
    // (`src/lib/components/CustomMenus/Header.tsx:76-80`).
    logoutApiInBackground();
    logoutAndRedirect();
  }, []);

  return (
    <AppShell
      config={config}
      onLogout={handleLogout}
      onChangePassword={() => setIsChangePasswordOpen(true)}
      logo={
        <img
          src="/stablecoin/images/logo-icon.svg"
          alt="Kissen"
          className="h-10 w-[84px] shrink-0 min-[1600px]:h-12 min-[1600px]:w-[104px]"
        />
      }
    >
      {children}
      <ChangePasswordDialog
        open={isChangePasswordOpen}
        onOpenChange={setIsChangePasswordOpen}
      />
    </AppShell>
  );
}
