/**
 * LP 门户菜单键 → 目标路由契约（源 `router/index.ts` MENU_ROUTE_MAP /
 * ROOT_CANDIDATES 的目标端适配，A5）。
 *
 * 侧栏装配、root 落点探测、无权限直接访问拦截共用本表，禁止各处散落
 * 字面量。路径必须能被 `(app)/[module]/[[...slug]]` 注册表解析（module 段
 * 或 sys 组解析后的 realModule）。
 */

import type { ModuleMenuItem } from '@myorg/shared/util-config';
import type { MenuTreeRespVO } from '@myorg/modules/lp-portal/data-access';

/**
 * menuKey → 目标路径（源路径 → 注册表适配）。
 * 适配点：源 /system/*→/sys/*；lp:log → /syslog（注册表 syslog 模块，非 /sys/log）。
 * v2.3（上游 e591f85）：新增 lp:dashboard；lp:rate / lp:receipt 退役。
 * v2.4（上游 6c49396）：lp:settle → /split-settle（合并页）；lp:split /
 * lp:preauth 退役（三页并为「分成与结算」单页）。
 */
export const MENU_ROUTE_MAP: Record<string, string> = {
  'lp:dashboard': '/dashboard',
  'lp:pool': '/pool',
  'lp:token': '/token',
  'lp:pair': '/pair',
  'lp:txflow': '/tx-flow',
  'lp:settle': '/split-settle',
  'lp:user': '/sys/user',
  'lp:role': '/sys/role',
  'lp:menu': '/sys/menu',
  'lp:log': '/syslog',
};

/**
 * 反查表：目标路径 → menuKey，供 `[module]` 页对直接访问做菜单可见性拦截
 * （A5：菜单不可见的页直接访问需拒绝）。
 */
export const PATH_MENU_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(MENU_ROUTE_MAP).map(([key, path]) => [path, key]),
);

/**
 * root 落点候选（源 ROOT_CANDIDATES 顺序 1:1——业务优先级即缺省首页）。
 * v2.3：登录默认落 Dashboard，无 dashboard 权限按业务顺序回退。
 */
export const ROOT_CANDIDATES: readonly string[] = [
  'lp:dashboard',
  'lp:pool',
  'lp:pair',
  'lp:txflow',
  'lp:settle',
  'lp:token',
  'lp:user',
  'lp:role',
  'lp:menu',
  'lp:log',
];

/**
 * 按候选顺序取第一个持有权限（menuKeys 含该键）的路径。
 * 全部未命中 → null（调用方落「功能建设中」占位，源 /placeholder 语义）。
 */
export function resolveRootPath(menuKeys: ReadonlySet<string>): string | null {
  for (const key of ROOT_CANDIDATES) {
    if (menuKeys.has(key)) return MENU_ROUTE_MAP[key];
  }
  return null;
}

/**
 * menuKey → lucide 图标名（源 MainLayout MENU_ICONS 的 Element Plus 图标
 * 到 lucide 的等价映射；未命中回退 'Menu'，源 fallback 语义）。
 * v2.3：splitsettle/system；dashboard=LayoutDashboard；token=Coins(Coin)；
 * rate/receipt/market/business 键移除。v2.4：settle=CircleDollarSign；
 * split/preauth 键随页面退役移除。f0d5b6f：liquidity 组键移除
 * （池/代币直挂业务组，源 MainLayout 同批去组）。
 */
export const MENU_ICONS: Record<string, string> = {
  splitsettle: 'CircleDollarSign',
  system: 'Settings',
  'lp:dashboard': 'LayoutDashboard',
  'lp:pool': 'WalletCards',
  'lp:token': 'Coins',
  'lp:pair': 'ArrowLeftRight',
  'lp:txflow': 'ListChecks',
  'lp:settle': 'CircleDollarSign',
  'lp:user': 'UsersRound',
  'lp:role': 'ShieldCheck',
  'lp:menu': 'Menu',
  'lp:log': 'ScrollText',
};

/** 未知菜单键的落点（源 /placeholder 占位语义，由 catch-all 页兜底渲染）。 */
export const UNKNOWN_MENU_PATH = '/placeholder';

export function buildLpSidebarOrder(menuTree: MenuTreeRespVO[]): ModuleMenuItem[] {
  // id 必须全局唯一：直接用完整 path。此前取 path 首段（'/sys/user'→'sys'）
  // 会让 /sys/* 兄弟项在 Sidebar 的 React key 上互撞（开发态重复 key 告警，
  // 折叠态展开状态也会串台）。
  const toItems = (nodes: MenuTreeRespVO[]): ModuleMenuItem[] =>
    nodes
      .filter((n) => n.menuType !== 4 && n.visible !== 1)
      .sort((a, b) => (a.orderNum ?? 0) - (b.orderNum ?? 0))
      .map((node) => {
        const label = node.menuNameEn?.trim() || node.menuName;
        const icon = MENU_ICONS[node.menuKey] ?? 'Menu';
        const children = toItems(node.children ?? []);
        if (children.length > 0) {
          const firstPath =
            children.find((c) => c.path)?.path ?? UNKNOWN_MENU_PATH;
          return { id: firstPath, icon, label, children };
        }
        const path = MENU_ROUTE_MAP[node.menuKey] ?? UNKNOWN_MENU_PATH;
        return { id: path, icon, label, path };
      });

  return toItems(menuTree);
}
