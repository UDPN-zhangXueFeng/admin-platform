'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

/**
 * Module page registry for kissen-gateway-portal.
 *
 * Maps module id + page key → a dynamic import loader from the
 * `@myorg/modules/kissen-gateway/feature` package. All page components are
 * loaded client-side only (ssr: false) via next/dynamic.
 *
 * Page keys per contract §5.2 (✓ = registered):
 *   overview     : list （GW-14 新增，/overview）
 *   onboard      : list, create, edit, detail
 *   token        : list （GW-14 新增，/token/manage 两段路径经 page.tsx 推导为 'list'）
 *   fx           : list （GW-14 新增，/fx）
 *   tx           : list, detail
 *   user         : list, create, edit, detail
 *   role         : list, create, edit, detail
 *   menu         : list
 *   log          : list
 *   bank         : list（GW-14 新增 BankQueryListPage，/bank/query 两段
 *                  路径经 page.tsx 推导为 'list'；源 bank/info 孤儿页随
 *                  上游删除，不再注册）
 *   ui           : list （T4 新增，源 views/system/ui.vue 的 el-empty 空占位页；
 *                  上游权限键 bank:ui:setting → /system/ui，经组路由推导为
 *                  ('ui','list')）
 */
type PageLoader = () => Promise<{ default: ComponentType<unknown> }>;

/**
 * 合法 React 组件判定：函数组件直接放行，forwardRef/memo 等 `$$typeof`
 * 包装对象亦视为可渲染。
 */
function isValidPageComponent(value: unknown): boolean {
  if (typeof value === 'function') return true;
  return typeof value === 'object' && value !== null && '$$typeof' in value;
}

/**
 * 按导出名取组件（索引访问天然绕过编译期属性校验）。缺导出时此前会以
 * `{ default: undefined }` resolve，渲染期抛 Element type is invalid ——
 * 崩溃而非走加载失败兜底。现显式校验并 reject：交由 next/dynamic 的
 * loadable 失败态兜底（dev 显示错误、prod 渲染空内容，壳层不崩、不白屏），
 * TokenListPage/FxListPage/BankQueryListPage 等尚未落地的导出由此保持可
 * 兜底。命名属性访问的条目受 TS 属性检查约束，无此风险。
 */
function featurePage(name: string): PageLoader {
  return () =>
    import('@myorg/modules/kissen-gateway/feature').then((m) => {
      const Comp = (m as unknown as Record<string, unknown>)[name];
      if (!isValidPageComponent(Comp)) {
        throw new Error(
          `[kissen-gateway] feature export "${name}" is missing or not a component`,
        );
      }
      return { default: Comp as ComponentType<unknown> };
    });
}


const pages: Record<string, Record<string, PageLoader>> = {
  overview: {
    // T5 OverviewListPage（源 views/overview/index.vue）
    list: featurePage('OverviewListPage'),
  },
  onboard: {
    list: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.OnboardListPage as unknown as ComponentType<unknown>,
      })),
    create: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.OnboardFormPage as unknown as ComponentType<unknown>,
      })),
    edit: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.OnboardFormPage as unknown as ComponentType<unknown>,
      })),
    detail: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.OnboardDetailPage as unknown as ComponentType<unknown>,
      })),
  },
  tx: {
    list: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.TxListPage as unknown as ComponentType<unknown>,
      })),
    detail: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.TxDetailPage as unknown as ComponentType<unknown>,
      })),
  },
  token: {
    // T6 TokenListPage（源 views/token/manage.vue；/token/manage → 'list'）
    list: featurePage('TokenListPage'),
    // eafcab0 TokenDetailPage（源 views/token/detail.vue；/token/manage/detail → 'detail'）
    detail: featurePage('TokenDetailPage'),
  },
  fx: {
    // T7 FxListPage（源 views/fx/index.vue）
    list: featurePage('FxListPage'),
    // eafcab0 FxDetailPage（源 views/fx/detail.vue；/fx/detail → 'detail'）
    detail: featurePage('FxDetailPage'),
  },
  user: {
    list: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.UserListPage as unknown as ComponentType<unknown>,
      })),
    create: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.UserFormPage as unknown as ComponentType<unknown>,
      })),
    edit: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.UserFormPage as unknown as ComponentType<unknown>,
      })),
    detail: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.UserDetailPage as unknown as ComponentType<unknown>,
      })),
  },
  role: {
    list: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.RoleListPage as unknown as ComponentType<unknown>,
      })),
    create: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.RoleFormPage as unknown as ComponentType<unknown>,
      })),
    edit: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.RoleFormPage as unknown as ComponentType<unknown>,
      })),
    detail: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.RoleDetailPage as unknown as ComponentType<unknown>,
      })),
  },
  menu: {
    list: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.MenuListPage as unknown as ComponentType<unknown>,
      })),
  },
  log: {
    list: () =>
      import('@myorg/modules/kissen-gateway/feature').then((m) => ({
        default: m.LogListPage as unknown as ComponentType<unknown>,
      })),
  },
  ui: {
    // T4 SystemUiPage（源 views/system/ui.vue 的 el-empty 占位页；上游权限键
    // bank:ui:setting。组路由 /system/ui 推导：realModule='ui'，无余下 slug →
    // pageKey='list'，与 user/role/menu/log 同一推导路径）
    list: featurePage('SystemUiPage'),
  },
  bank: {
    // T8 BankQueryListPage（源 views/bank/query.vue；/bank/query → 'list'）。
    // 源 bank/info 孤儿页已被上游删除（O-8 被 HEAD 演进推翻），不再注册。
    list: featurePage('BankQueryListPage'),
    // eafcab0 BankQueryDetailPage（源 views/bank/query-detail.vue；
    // /bank/query/detail → 'detail'）
    detail: featurePage('BankQueryDetailPage'),
  },
};

/**
 * Resolve a (module id, page key) pair to a lazily-loaded page component.
 * Returns null when no loader is registered, so the caller can render a
 * "Page Not Found" placeholder instead of throwing.
 */
export function loadKissenGatewayModulePage(
  moduleId: string,
  pageKey: string,
): ComponentType<unknown> | null {
  const loader = pages[moduleId]?.[pageKey];
  if (!loader) return null;
  return dynamic(() => loader(), { ssr: false }) as unknown as ComponentType<unknown>;
}
