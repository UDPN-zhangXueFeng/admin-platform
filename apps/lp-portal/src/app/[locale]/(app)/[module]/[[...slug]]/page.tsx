'use client';

import { use, useEffect, useMemo } from 'react';
import { useConfig } from '@myorg/shared/util-config';
import { useRouter } from '@myorg/shared/util-i18n';
import type { ComponentType } from 'react';
import {
  LP_PROJECT_ID,
  flattenMenuKeys,
  useLpSessionQuery,
} from '@myorg/modules/lp-portal/data-access';

import { PATH_MENU_KEY } from '@/lib/lp-routes';
import { loadLpPortalModulePage } from './module-page-registry';

/**
 * Maps a route `module` segment that is actually a menu GROUP to the
 * config.modules.enabled key that gates it. Per the lp-portal routing
 * contract (§5.3) only `sys` is a group prefix: `/sys/user`, `/sys/role`,
 * `/sys/menu` resolve to the user / role / menu modules respectively, gated
 * by the `sys` enabled flag. All other modules are top-level.
 */
const GROUP_ENABLED_KEY: Record<string, string> = {
  sys: 'sys',
};

/**
 * Dynamic module route — every lp-portal module page is served from this
 * single catch-all entry.
 *
 * Route examples:
 *   /en-US/pool                 → module=pool,     slug=[]         → list
 *   /en-US/receipt              → module=receipt,  slug=[]         → list
 *   /en-US/sys/user             → module=sys,      slug=[user]     → user/list
 *
 * slug[0] 为 create/edit 时解析为同名页键，其余值解析为 detail（源 11 个
 * 模块均为单页，registry 目前仅注册 list）。
 *
 * The (real) module must be listed in config.modules.enabled (or, for group
 * routes, the group key must be enabled), otherwise a "module not found"
 * placeholder is shown. The actual page component is loaded via
 * loadLpPortalModulePage, which uses next/dynamic with ssr:false.
 *
 * 菜单可见性门禁（A5）：路径经 PATH_MENU_KEY 反查 menuKey，不在会话
 * menuKeys（后端按角色装配的可见菜单全量展开）内 → 403 提示并跳 root，
 * 不渲染业务页——侧栏不可见但 URL 直接可达的页面在此拦截。
 */
export default function ModulePage({
  params,
}: {
  params: Promise<{ locale: string; module: string; slug?: string[] }>;
}) {
  const { module, slug } = use(params);
  const { config } = useConfig();
  const router = useRouter();
  const { data: session, isLoading: sessionLoading } =
    useLpSessionQuery(LP_PROJECT_ID);

  const groupKey = GROUP_ENABLED_KEY[module];
  const isGroup = Boolean(groupKey);
  const realModule = isGroup && slug && slug.length > 0 ? slug[0] : module;
  const realSlug = isGroup ? (slug ? slug.slice(1) : []) : slug;

  // 组路由还原完整路径（/sys/user）以反查 menuKey；根路径（如 /pool）直接拼。
  const fullPath = isGroup ? `/${module}/${slug?.[0] ?? ''}` : `/${module}`;
  const menuKey = PATH_MENU_KEY[fullPath];
  const menuKeys = useMemo(
    () => new Set(session ? flattenMenuKeys(session.menuTree ?? []) : []),
    [session],
  );
  const denied = menuKey != null && !menuKeys.has(menuKey);

  useEffect(() => {
    if (!sessionLoading && denied) router.replace('/');
  }, [sessionLoading, denied, router]);

  const isEnabled = isGroup
    ? config.modules.enabled.includes(groupKey as string)
    : config.modules.enabled.includes(module);

  const pageKey = useMemo(() => {
    if (!realSlug || realSlug.length === 0) return 'list';
    if (realSlug[0] === 'create') return 'create';
    if (realSlug[0] === 'edit') return 'edit';
    return 'detail';
  }, [realSlug]);

  const PageComponent = useMemo(() => {
    if (!isEnabled) return null;
    return loadLpPortalModulePage(realModule, pageKey) as ComponentType<unknown> | null;
  }, [realModule, pageKey, isEnabled]);

  if (sessionLoading || !session) {
    // 会话未决/缺失：LpAppShell 组级门禁接管跳转，此处不渲染业务页。
    return null;
  }
  if (denied) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-lg font-medium text-foreground">无权限访问该页面</p>
        <p className="text-sm">正在返回首页…</p>
      </div>
    );
  }
  if (!isEnabled) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        Module &quot;{module}&quot; is not enabled.
      </div>
    );
  }
  if (!PageComponent) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        Page not found for module &quot;{realModule}&quot; ({pageKey}).
      </div>
    );
  }
  return <PageComponent />;
}
