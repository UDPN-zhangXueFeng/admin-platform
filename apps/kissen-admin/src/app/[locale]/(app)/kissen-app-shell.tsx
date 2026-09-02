'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';

import { AppShell } from '@myorg/shared/ui-layout';
import type { ProjectConfig } from '@myorg/shared/util-config';
import { useAuth, logoutAndRedirect } from '@myorg/shared/util-auth';
import {
  useUserLogoutMutation,
  type MenuTreeRespVO,
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
const ThemeSwitcher = dynamic(
  () =>
    import('@myorg/modules/kissen-admin/feature').then(
      (m) => m.ThemeSwitcher,
    ),
  { ssr: false },
);
/**
 * App shell wrapper with kissen-admin's project-specific interactions.
 *
 * - Sidebar is driven by the per-user backend menuTree (源 MainLayout 消费
 *   store.menuTree)：登录响应的 menuTree 存进 user 快照，此处映射为
 *   ProjectConfig.modules.order 注入 AppShell。分组=有 children 的节点，
 *   叶子路由取 menuUrl；label 取 menuNameEn（零 CJK），未实现 key 走
 *   registry 的 placeholder 兜底。静态 configs 树仅作无会话/SSR 首帧兜底。
 * - Self-service change-password dialog (源 `views/login/change-pwd.vue`)
 *   wired to the shared Header's "Change Password" menu item.
 * - Project-owned logout: POST /rbac/logout on the kissen gateway
 *   (源 store/user.ts:33-35 先调 rbac.logout() 再 clear())，然后本地清
 *   会话并回登录页。
 * - ThemeSwitcher 经 next/dynamic(ssr:false) 挂 Header trailing 槽（LP 同款
 *   拆包模式；组件 client-only）。
 */

/** menuKey → Lucide 图标名（后端 icon 字段恒为空，沿用原静态树的图标）。 */
const MENU_ICON_BY_KEY: Record<string, string> = {
  workbench: 'Odometer',
  approval: 'Stamp',
  onboard: 'OfficeBuilding',
  'bank:onboard': 'OfficeBuilding',
  'bank:instance': 'Network',
  'token:manage': 'Coins',
  lp: 'Users',
  'lp:onboard': 'Users',
  'lp:currencypair': 'ArrowLeftRight',
  'liquidity:pool': 'Droplets',
  fxmgmt: 'Money',
  'fx-rate:pair': 'ArrowLeftRight',
  'transfer:tx': 'ArrowLeftRight',
  settle: 'CalendarClock',
  'settle:order': 'FileText',
  'settle:cycle': 'CalendarRange',
  system: 'Settings',
  'rbac:user:manage': 'User',
  'rbac:role:manage': 'ShieldCheck',
  'rbac:menu:manage': 'ListTree',
  'workflow:config': 'GitBranch',
  'system:log': 'ScrollText',
};

/**
 * menuTree → AppShell 侧栏项（源 MainLayout.vue:137 遍历 store.menuTree）。
 * 过滤隐藏项（visible=1）与按钮节点（menuType=4），同级按 orderNum 稳定排序。
 */
function toModuleItems(tree: MenuTreeRespVO[]): ProjectConfig['modules']['order'] {
  return [...tree]
    .filter((n) => n.visible === 0 && n.menuType !== 4)
    .sort((a, b) => a.orderNum - b.orderNum)
    .map((n) => {
      const icon = MENU_ICON_BY_KEY[n.menuKey] ?? 'Box';
      const label = n.menuNameEn?.trim() || n.menuKey;
      const children = toModuleItems(n.children ?? []);
      if (children.length > 0) return { id: n.menuKey, icon, label, children };
      return {
        id: n.menuKey,
        icon,
        label,
        path: n.menuUrl || `/${n.menuKey}`,
      };
    });
}
export function KissenAppShell({
  config,
  children,
}: {
  config: ProjectConfig;
  children: React.ReactNode;
}) {
  const [pwdOpen, setPwdOpen] = React.useState(false);
  const logoutMutation = useUserLogoutMutation();
  const { user } = useAuth();

  // 源 MainLayout 消费 store.menuTree：有会话菜单树时以后端为准覆写静态
  // configs 菜单（无树——SSR 首帧/会话缺失——回退静态树）。
  const shellConfig = React.useMemo<ProjectConfig>(() => {
    const tree = (user as { menuTree?: MenuTreeRespVO[] } | null)?.menuTree;
    if (!tree || tree.length === 0) return config;
    return {
      ...config,
      modules: { ...config.modules, order: toModuleItems(tree) },
    };
  }, [config, user]);

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
      config={shellConfig}
      onChangePassword={() => setPwdOpen(true)}
      onLogout={handleLogout}
      hideManageAccount
      trailing={<ThemeSwitcher themes={config.theme.themes} />}
    >
      {children}
      <ChangePasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />
    </AppShell>
  );
}
