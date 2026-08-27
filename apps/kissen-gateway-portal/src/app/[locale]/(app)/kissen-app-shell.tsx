'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';

import { AppShell } from '@myorg/shared/ui-layout';
import type {
  ModuleMenuItem,
  ProjectConfig,
} from '@myorg/shared/util-config';
import { logoutAndRedirect } from '@myorg/shared/util-auth';
import { useRouter } from '@myorg/shared/util-i18n';
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
 * 收集过滤后菜单树中可导航节点的允许路径与排序号（源 MainLayout navNodes
 * 语义：跳过 menuType=4 按钮与 visible=1 隐藏节点，其子树亦不渲染）。
 *
 * 排序号（§7#16，源树逐层 orderNum 升序遍历序）：叶子记录复合键
 * `父组 orderNum × SPAN + 叶 orderNum`，父组间次序由父节点 orderNum
 * 决定（如 bank:system=100 整组排在 onboard=5 / tx=9 之后）；无父组
 * 或父组缺 orderNum 时退化为叶自身 orderNum。SPAN 取 10000（组内
 * orderNum 上限远低于此）。
 */
const MENU_ORDER_SPAN = 10000;

function collectAllowedPaths(
  nodes: MenuTree[],
  allowed: Set<string>,
  order: Map<string, number> = new Map(),
  groupOrder?: number,
): void {
  for (const node of nodes) {
    if (node.menuType === 4 || node.visible === 1) continue;
    const path = MENU_ROUTE_MAP[node.menuKey];
    if (path && !order.has(path)) {
      allowed.add(path);
      const leaf = node.orderNum;
      if (groupOrder != null && leaf != null) {
        order.set(path, groupOrder * MENU_ORDER_SPAN + leaf);
      } else if (leaf != null || groupOrder != null) {
        order.set(path, (groupOrder ?? leaf) as number);
      }
    } else if (path) {
      allowed.add(path);
    }
    if (node.children?.length) {
      collectAllowedPaths(
        node.children,
        allowed,
        order,
        node.orderNum ?? groupOrder,
      );
    }
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
 * 按服务端 orderNum 重排侧栏项（源 MainLayout navNodes sort((a,b)=>
 * a.orderNum-b.orderNum) 升序，§7#16）。父项取其可见子项的最小
 * orderNum；无服务端排序号的项保持 config 原相对位置（等价于源侧
 * undefined 比较被稳定排序忽略的语义）。
 */
function itemOrder(
  item: ModuleMenuItem,
  orderMap: Map<string, number>,
): number | undefined {
  if (item.children?.length) {
    let min: number | undefined;
    for (const child of item.children) {
      const o = itemOrder(child, orderMap);
      if (o != null && (min == null || o < min)) min = o;
    }
    return min;
  }
  return orderMap.get(item.path ?? `/${item.id}`);
}

function sortModuleItems(
  items: ModuleMenuItem[],
  orderMap: Map<string, number>,
): ModuleMenuItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const oa = itemOrder(a.item, orderMap);
      const ob = itemOrder(b.item, orderMap);
      if (oa == null || ob == null) return a.index - b.index;
      return oa - ob || a.index - b.index;
    })
    .map(({ item }) =>
      item.children?.length
        ? { ...item, children: sortModuleItems(item.children, orderMap) }
        : item,
    );
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
 * - 侧栏折叠持久化（A-1）：localStorage key 沿用源 MainLayout 的
 *   'bankgw.nav.collapsed'（初始读 ==='1'，toggle 写 '1'/'0'）。
 * - 侧栏宽度对齐源口径：展开 224px / 收起 68px（源 el-aside :width）。
 * - 品牌区点击回门户首页（源 brand @click router.push('/')）；用户菜单
 *   仅「Change Password / Log Out」两项（源 dropdown 无账号管理项）。
 */
export function KissenAppShell({
  config,
  children,
}: {
  config: ProjectConfig;
  children: React.ReactNode;
}) {
  const router = useRouter();
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
    const orderMap = new Map<string, number>();
    collectAllowedPaths(
      filterMenuTree(menuTreeQuery.data, sessionMenuKeys),
      allowedPaths,
      orderMap,
    );
    return {
      ...config,
      modules: {
        ...config.modules,
        order: sortModuleItems(
          filterModuleItems(config.modules.order, allowedPaths),
          orderMap,
        ),
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

  // 源 MainLayout.vue 品牌区 title「回到门户首页」，点击回门户首页。
  const handleBrandClick = React.useCallback(() => {
    router.push('/');
  }, [router]);

  return (
    <AppShell
      config={filteredConfig}
      onChangePassword={() => setPwdOpen(true)}
      onLogout={handleLogout}
      onBrandClick={handleBrandClick}
      hideManageAccount
      persistKey="bankgw.nav.collapsed"
      sidebarWidths={{
        expanded: 'w-[224px] min-[1600px]:w-[224px]',
        collapsed: 'w-[68px] min-[1600px]:w-[68px]',
      }}
    >
      {children}
      <ChangePasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />
    </AppShell>
  );
}
