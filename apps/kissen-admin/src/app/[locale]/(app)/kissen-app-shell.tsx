'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';

import { AppShell } from '@myorg/shared/ui-layout';
import type { ProjectConfig } from '@myorg/shared/util-config';
import { logoutAndRedirect } from '@myorg/shared/util-auth';
import {
  useUserLogoutMutation,
} from '@myorg/modules/kissen-admin/data-access';

// feature 库在本 app 内为 lazy-loaded（module-page-registry 动态导入），
// 边界规则禁止静态导入 —— 改密弹窗仅在交互后渲染，走动态分片。
const ChangePasswordDialog = dynamic(
  () =>
    import('@myorg/modules/kissen-admin/feature').then(
      (m) => m.ChangePasswordDialog,
    ),
  { ssr: false },
);

/**
 * App shell wrapper with kissen-admin's project-specific interactions.
 *
 * - Self-service change-password dialog (源 `views/login/change-pwd.vue`)
 *   wired to the shared Header's "Change Password" menu item.
 * - Project-owned logout: POST /rbac/logout on the kissen gateway
 *   (源 store/user.ts:33-35 先调 rbac.logout() 再 clear())，然后本地清
 *   会话并回登录页。
 *
 * Menu-level permission filtering is intentionally NOT applied: the source
 * sidebar is driven by the per-user backend menuTree (menuUrl), whose values
 * cannot be mapped to the static config paths offline — filtering on assumed
 * keys would blank the sidebar for regular users. Menu visibility therefore
 * remains config-driven, with backend 403 as the enforcement boundary
 * (documented as an accepted architectural divergence).
 */
export function KissenAppShell({
  config,
  children,
}: {
  config: ProjectConfig;
  children: React.ReactNode;
}) {
  const [pwdOpen, setPwdOpen] = React.useState(false);
  const logoutMutation = useUserLogoutMutation();

  const handleLogout = React.useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // 本地登出必须完成，即使服务端会话已失效。
    } finally {
      logoutAndRedirect();
    }
  }, [logoutMutation]);

  return (
    <AppShell
      config={config}
      onChangePassword={() => setPwdOpen(true)}
      onLogout={handleLogout}
    >
      {children}
      <ChangePasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />
    </AppShell>
  );
}
