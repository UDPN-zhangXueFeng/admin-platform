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
 * 适配点：源 /pair-pool→/pair、/source-receipt→/receipt、/system/*→/sys/*；
 * lp:log → /syslog（注册表 syslog 模块，非 /sys/log）。
 * 三键 lp:token / lp:preauth / lp:split：目标路径与源一致，无适配点。
 */
export const MENU_ROUTE_MAP: Record<string, string> = {
  'lp:pool': '/pool',
  'lp:token': '/token',
  'lp:rate': '/rate',
  'lp:pair': '/pair',
  'lp:split': '/split',
  'lp:txflow': '/tx-flow',
  'lp:preauth': '/preauth',
  'lp:settle': '/settle',
  'lp:receipt': '/receipt',
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
 */
export const ROOT_CANDIDATES: readonly string[] = [
  'lp:token',
  'lp:pool',
  'lp:preauth',
  'lp:rate',
  'lp:pair',
  'lp:split',
  'lp:txflow',
  'lp:settle',
  'lp:receipt',
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
 * 侧栏英文 label 映射（menuKey → 文案）。
 * 后端 menuTree.menuName 为中文，约束①要求用户可见文案零 CJK：
 * 叶子 label 与各页面 h1 对齐；未知键回退后端 menuName。
 */
export const MENU_LABELS: Record<string, string> = {
  'lp:dashboard': 'Dashboard',
  liquidity: 'Liquidity',
  'lp:pool': 'Liquidity Pools',
  'lp:preauth': 'Pre-authorization Monitoring',
  'lp:token': 'Token Overview',
  'lp:pair': 'Token Pairs',
  'lp:txflow': 'Transaction Flow',
  splitsettle: 'Splits & Settlement',
  'lp:split': 'My Split',
  'lp:settle': 'Settlement',
  system: 'System',
  'lp:user': 'User Management',
  'lp:role': 'Roles & Permissions',
  'lp:menu': 'Menu Management',
  'lp:log': 'Operation Log',
};
/**
 * menuKey → lucide 图标名（源 MainLayout MENU_ICONS 的 Element Plus 图标
 * 到 lucide 的等价映射；未命中回退 'Menu'，源 fallback 语义）。
 */
export const MENU_ICONS: Record<string, string> = {
  // 源分组图标（menuType=2 一级菜单）
  liquidity: 'Wallet',
  market: 'Coins',
  business: 'BarChart3',
  system: 'Settings',
  // 源叶子图标（menuType=3 二级菜单）
  'lp:pool': 'Wallet',
  'lp:token': 'Coins',
  'lp:rate': 'TrendingUp',
  'lp:pair': 'ArrowLeftRight',
  'lp:split': 'PieChart',
  'lp:txflow': 'List',
  'lp:preauth': 'LockKeyhole',
  'lp:settle': 'CreditCard',
  'lp:receipt': 'Ticket',
  'lp:user': 'Users',
  'lp:role': 'ShieldCheck',
  'lp:menu': 'Menu',
  'lp:log': 'FileText',
};

/** 未知菜单键的落点（源 /placeholder 占位语义，由 catch-all 页兜底渲染）。 */
export const UNKNOWN_MENU_PATH = '/placeholder';

export function buildLpSidebarOrder(menuTree: MenuTreeRespVO[]): ModuleMenuItem[] {
  const idFromPath = (path: string): string => path.split('/')[1] ?? path;

  const toItems = (nodes: MenuTreeRespVO[]): ModuleMenuItem[] =>
    nodes
      .filter((n) => n.menuType !== 4 && n.visible !== 1)
      .sort((a, b) => (a.orderNum ?? 0) - (b.orderNum ?? 0))
      .map((node) => {
        const label = MENU_LABELS[node.menuKey] ?? node.menuName;
        const icon = MENU_ICONS[node.menuKey] ?? 'Menu';
        const children = toItems(node.children ?? []);
        if (children.length > 0) {
          const firstPath =
            children.find((c) => c.path)?.path ?? UNKNOWN_MENU_PATH;
          return { id: idFromPath(firstPath), icon, label, children };
        }
        const path = MENU_ROUTE_MAP[node.menuKey] ?? UNKNOWN_MENU_PATH;
        return { id: idFromPath(path), icon, label, path };
      });

  return toItems(menuTree);
}
