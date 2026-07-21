'use client';

import { use, useMemo } from 'react';
import {
  useConfig,
  loadModulePage as loadLegacyModulePage,
} from '@myorg/shared/util-config';
import type { ComponentType } from 'react';
import {
  loadKeyManagementModulePage,
  loadSpAccessModulePage,
} from './module-page-registry';

const keyManagementPageKeys: Record<string, string> = {
  'key-service-configuration': 'key-service-configuration',
  'key-signed-transactions': 'key-signed-transactions',
  'managed-wallets': 'managed-wallets',
  'user-wallets': 'user-wallets',
  'key-policy-configuration': 'key-policy-configuration',
};

/**
 * key-management 标准路由词（走 legacy registry：签名交易 list/detail 等）。
 * 子页面 slug 既不在 keyManagementPageKeys、也不在此集合时（即未迁移的子模块，
 * 当前 5 子模块已全部迁移完毕），modulePageKey
 * 返回 null → 落到下方的 "Page Not Found" 占位，避免被误当作 detail 渲染成
 * "Transaction record not found"。迁移新子模块时把其 slug 加入 keyManagementPageKeys，
 * 并在 module-page-registry 注册同名 list loader 与 <slug>-detail loader（见下方
 * modulePageKey 对 /<sub>/detail 两段路由的处理）。
 */
const KEY_MANAGEMENT_STANDARD_ROUTES = new Set([
  'detail',
  'create',
  'edit',
  'onboard',
]);

/**
 * Dynamic module route — all module pages are served from this single entry.
 *
 * Route examples:
 *   /en/user           → module=user, slug=[]      → pageKey="list"
 *   /en/user/create    → module=user, slug=["create"] → pageKey="create"
 *   /en/user/123       → module=user, slug=["123"]   → pageKey="detail"
 *   /en/order/456      → module=order, slug=["456"]  → pageKey="detail"
 *
 * The module must be listed in config.modules.enabled, otherwise a 404-like
 * message is shown. The actual page component is loaded via loadModulePage
 * which uses next/dynamic with ssr:false for code splitting.
 */
export default function ModulePage({
  params,
}: {
  params: Promise<{ locale: string; module: string; slug?: string[] }>;
}) {
  const { module, slug } = use(params);
  const { config } = useConfig();

  // sys 分组路由：`/sys/<sub-module>/...` 把第一段 slug 当作子模块名，剩余 slug 作为
  // 该子模块的 slug。例如 /sys/role、/sys/role/create、/sys/role/123 分别解析为 role
  // 模块的 list / create / detail。sys 分组的启用状态对应 config.modules.enabled 的 'system'。
  // 分组模块：第一段 slug 当子模块名，剩余 slug 透传。`/sys/role` → role 模块；
  // `/wallet/wallet-type` → wallet-type 模块。enabled key 见 GROUP_ENABLED_KEY。
  // nav 配置 configs/stablecoin.json 已把 wallet 作分组（3 子项 path 写死 /wallet/<child>）。
  const GROUP_ENABLED_KEY: Record<string, string> = {
    sys: 'system',
    wallet: 'wallet',
    blockchain: 'blockchain',
    mmf: 'mmf',
    'cross-chain': 'cross-chain',
    pledge: 'pledge',
  };
  const groupKey = GROUP_ENABLED_KEY[module];
  const isGroup = Boolean(groupKey);
  // module id 统一归一化为小写：菜单 path `/sys/sysLog`（驼峰）仍命中 registry 的 'syslog'。
  const realModule = (
    isGroup && slug && slug.length > 0 ? slug[0] : module
  ).toLowerCase();
  const realSlug = isGroup ? (slug ? slug.slice(1) : []) : slug;

  const isEnabled = isGroup
    ? config.modules.enabled.includes(groupKey as string)
    : config.modules.enabled.includes(module);

  const pageKey = useMemo(() => {
    if (!realSlug || realSlug.length === 0) return 'list';
    if (realSlug[0] === 'create') return 'create';
    if (realSlug[0] === 'edit') return 'edit';
    // tokenized-deposit 新建页路由名 'onboard'（对齐 overview-shell ONBOARD_ROUTE），
    // 识别为独立 pageKey，否则会落到 detail 误渲染 ViewPage。
    if (realSlug[0] === 'onboard') return 'onboard';
    return 'detail';
  }, [realSlug]);

  const modulePageKey: string | null = (() => {
    if (module !== 'key-management' || !realSlug?.[0]) return pageKey;
    const subSlug = realSlug[0];
    const mapped = keyManagementPageKeys[subSlug];
    if (mapped) {
      // 已迁子模块支持二级路由：/<sub> (list) /<sub>/new /<sub>/edit /<sub>/detail。
      // 现有子模块无 new/edit（realSlug[1] 不会是这些值），行为不变（向后兼容）。
      const sub = realSlug[1];
      if (sub === undefined) return mapped;
      if (sub === 'detail') return `${mapped}-detail`;
      if (sub === 'new' || sub === 'create') return `${mapped}-new`;
      if (sub === 'edit') return `${mapped}-edit`;
      return mapped;
    }
    return KEY_MANAGEMENT_STANDARD_ROUTES.has(subSlug) ? pageKey : null;
  })();

  const PageComponent = useMemo(() => {
    if (!isEnabled) return null;
    if (module === 'sp-access') {
      return loadSpAccessModulePage(pageKey) as ComponentType<unknown> | null;
    }
    if (module === 'key-management' && modulePageKey !== pageKey) {
      // modulePageKey 为 null 表示未迁移的子模块路由 → 返回 null 触发 "Page Not Found"。
      if (!modulePageKey) return null;
      return loadKeyManagementModulePage(
        modulePageKey,
      ) as ComponentType<unknown> | null;
    }
    return loadLegacyModulePage(
      realModule,
      pageKey,
    ) as ComponentType<unknown> | null;
  }, [module, realModule, pageKey, modulePageKey, isEnabled]);

  if (!isEnabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <h2 className="text-2xl font-bold">Module Not Found</h2>
        <p className="text-muted-foreground">
          The module &quot;{module}&quot; is not available in this project.
        </p>
      </div>
    );
  }

  if (!PageComponent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <h2 className="text-2xl font-bold">Page Not Found</h2>
        <p className="text-muted-foreground">
          No page found for module &quot;{module}&quot; with key &quot;{pageKey}
          &quot;.
        </p>
      </div>
    );
  }

  return <PageComponent />;
}
