'use client';

import { useEffect, useMemo } from 'react';

import { useRouter } from '@myorg/shared/util-i18n';
import {
  LP_PROJECT_ID,
  flattenMenuKeys,
  useLpSessionQuery,
} from '@myorg/modules/lp-portal/data-access';

import { resolveRootPath } from '@/lib/lp-routes';

/**
 * Root landing —— /[locale] 落点探测（A5，源 router rootRedirect 1:1）。
 *
 * 登录后/访问根路径时，按 ROOT_CANDIDATES 顺序取第一个用户持有权限的
 * 菜单键并 replace 过去；11 个候选全未命中 → 「功能建设中」占位（源
 * /placeholder 语义）。
 *
 * firstLogin===0 的锁由 LpAppShell（本路由的组布局）承担——锁定期本页不
 * 渲染、effect 不触发，不存在抢跳。
 */
export default function RootLandingPage() {
  const router = useRouter();
  const { data: session, isLoading } = useLpSessionQuery(LP_PROJECT_ID);

  const landingPath = useMemo(() => {
    if (!session?.menuTree?.length) return null;
    return resolveRootPath(new Set(flattenMenuKeys(session.menuTree)));
  }, [session]);

  useEffect(() => {
    if (!isLoading && landingPath) {
      router.replace(landingPath);
    }
  }, [isLoading, landingPath, router]);

  if (isLoading || landingPath) return null; // 探测中 / 跳转中

  // 全候选未命中：占位（源 /placeholder el-empty 文案）
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-muted-foreground">
      <p className="text-lg font-medium text-foreground">Feature under construction</p>
      <p className="text-sm">This feature will be available in a future release</p>
    </div>
  );
}
