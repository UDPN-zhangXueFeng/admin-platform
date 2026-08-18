'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';

import { AppShell } from '@myorg/shared/ui-layout';
import type {
  ModuleMenuItem,
  ProjectConfig,
} from '@myorg/shared/util-config';
import { logoutAndRedirect } from '@myorg/shared/util-auth';
import {
  KISSEN_GATEWAY_PROJECT_ID,
  clearGatewaySession,
  filterMenuTree,
  getGatewayToken,
  getGatewayUser,
  useAuthLogoutMutation,
  useMenuTreeQuery,
  type MenuTree,
} from '@myorg/modules/kissen-gateway/data-access';

// feature 库在本 app 内为 lazy-loaded（module-page-registry 动态导入），
// 边界规则禁止静态导入 —— 改密弹窗仅在交互后渲染，走动态分片。
const ChangePasswordDialog = dynamic(
  () =>
    import('@myorg/modules/kissen-gateway/feature').then(
      (m) => m.ChangePasswordDialog,
    ),
  { ssr: false },
);

/**
 * 菜单键 → 页面路径映射（源 `router/index.ts` MENU_ROUTE_MAP 9 项原样照搬；
 * 映射值随目标 App Router 路由重排更新：源 /business/currency-pair|lp|rate
 * → /market/*，源 /tx/list → /tx，其余路径两侧一致）。
 * 侧栏过滤用它把「过滤后菜单树的 menuKey」折算成允许路径集合。
 */
const MENU_ROUTE_MAP: Record<string, string> = {
  'bank:user:manage': '/system/user',
  'bank:role:manage': '/system/role',
  'bank:menu:manage': '/system/menu',
  'bank:log:view': '/system/log',
  'bank:onboard:submit': '/onboard',
  'bank:currencypair:view': '/market/currencypair',
  'bank:lp:view': '/market/lp',
  'bank:rate:view': '/market/rate',
  'bank:tx:view': '/tx',
};

/**
 * 收集过滤后菜单树中可导航节点的允许路径（源 MainLayout navNodes 语义：
 * 跳过 menuType=4 按钮与 visible=1 隐藏节点，其子树亦不渲染）。
 */
function collectAllowedPaths(nodes: MenuTree[], allowed: Set<string>): void {
  for (const node of nodes) {
    if (node.menuType === 4 || node.visible === 1) continue;
    const path = MENU_ROUTE_MAP[node.menuKey];
    if (path) allowed.add(path);
    if (node.children?.length) collectAllowedPaths(node.children, allowed);
  }
}

/**
 * 过滤 AppShell 菜单项：叶子项解析路径（path ?? /{id}，与 sidebar-layout
 * 的取值规则一致）命中允许集合才保留；父项按任一子项保留才保留（递归）。
 */
function filterModuleItems(
  items: ModuleMenuItem[],
  allowedPaths: Set<string>,
): ModuleMenuItem[] {
  const result: ModuleMenuItem[] = [];
  for (const item of items) {
    if (item.children?.length) {
      const children = filterModuleItems(item.children, allowedPaths);
      if (children.length > 0) result.push({ ...item, children });
    } else if (allowedPaths.has(item.path ?? `/${item.id}`)) {
      result.push(item);
    }
  }
  return result;
}

/**
 * App shell wrapper — kissen-gateway 门户的项目级壳（源 `layout/MainLayout.vue`）。
 *
 * - 顶栏「修改密码」→ 自助改密弹窗（源 dropdown command="pwd"）。
 * - 登出（源 command="logout"：先 POST /logout 再清本地会话回登录页）；
 *   服务端失败也必须完成本地登出（源 store.logout try/finally 语义）。
 * - 侧栏菜单权限过滤（源 MainLayout onMounted loadMenuTree + store
 *   filterTree）：GET /menu/tree 按会话 menuKeys 过滤 → MENU_ROUTE_MAP
 *   折算允许路径 → 过滤 config 菜单项。树未成功加载（加载中/失败）时
 *   保持全量菜单（源 loadMenuTree catch 语义）；登录/登出在本 app 均以
 *   整页跳转收尾，会话 menuKeys 挂载时读取一次即可。
 */
export function KissenAppShell({
  config,
  children,
}: {
  config: ProjectConfig;
  children: React.ReactNode;
}) {
  const [pwdOpen, setPwdOpen] = React.useState(false);
  const logoutMutation = useAuthLogoutMutation();

  const [sessionMenuKeys] = React.useState<Set<string>>(
    () => new Set(getGatewayUser()?.menuKeys ?? []),
  );
  const [hasSession] = React.useState(() => getGatewayToken() !== null);
  const menuTreeQuery = useMenuTreeQuery(KISSEN_GATEWAY_PROJECT_ID, hasSession);

  const filteredConfig = React.useMemo<ProjectConfig>(() => {
    if (!menuTreeQuery.data) return config;
    const allowedPaths = new Set<string>();
    collectAllowedPaths(
      filterMenuTree(menuTreeQuery.data, sessionMenuKeys),
      allowedPaths,
    );
    return {
      ...config,
      modules: {
        ...config.modules,
        order: filterModuleItems(config.modules.order, allowedPaths),
      },
    };
  }, [config, menuTreeQuery.data, sessionMenuKeys]);

  const handleLogout = React.useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // 服务端会话可能已失效：本地登出必须照常完成（源 finally clear()）。
    } finally {
      clearGatewaySession();
      logoutAndRedirect();
    }
  }, [logoutMutation]);

  return (
    <AppShell
      config={filteredConfig}
      onChangePassword={() => setPwdOpen(true)}
      onLogout={handleLogout}
    >
      {children}
      <ChangePasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />
    </AppShell>
  );
}
