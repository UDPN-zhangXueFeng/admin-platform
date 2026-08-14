'use client';

import * as React from 'react';

import { AppShell } from '@myorg/shared/ui-layout';
import type { ProjectConfig } from '@myorg/shared/util-config';
import { ChangePasswordDialog } from '@myorg/modules/kissen-admin/feature';

/**
 * App shell wrapper with kissen-admin's project-specific interactions.
 *
 * Adds the self-service change-password dialog (源 `views/login/change-pwd.vue`)
 * to the shared Header's "Change Password" menu item. State is kept here
 * (client component) so the server-component AppLayout stays data-only.
 */
export function KissenAppShell({
  config,
  children,
}: {
  config: ProjectConfig;
  children: React.ReactNode;
}) {
  const [pwdOpen, setPwdOpen] = React.useState(false);

  return (
    <AppShell config={config} onChangePassword={() => setPwdOpen(true)}>
      {children}
      <ChangePasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />
    </AppShell>
  );
}
