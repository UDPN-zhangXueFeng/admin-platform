'use client';

/**
 * LpAppShell —— (app) 路由组的客户端壳（A5 + A4 + A8）。
 *
 * 职责（取代静态 config.modules.order 装配侧栏）：
 *  1. 会话门禁（渲染级，非仅重定向）：
 *     - 未登录（cookie 残留但本地会话缺失）或 menuTree 为空 → 清会话并回
 *       登录页（先 clearLpSession 再跳，防 cookie 残留引发 middleware↔shell
 *       重定向循环）；
 *     - firstLogin===0 → 锁定期不渲染业务内容，强制跳 /change-pwd（A4 三处
 *       协作的客户端锁；middleware 只读 cookie，读不到 localStorage 的
 *       firstLogin）。
 *  2. 侧栏由登录响应 menuTree 装配（buildLpSidebarOrder），AppShell 组件
 *     复用不变——仅换 config.modules.order 数据源。
 *  3. Header 接线（A8）：Change Password → /profile（个人中心，含改密表单，
 *     源 profile 语义）；Log Out → try{await logout}finally 清会话回登录
 *     （源 store.logout 1:1，logoutAndRedirect 处理 locale 前缀 + 共享
 *     storage 清理）。
 */
import { useEffect, useMemo } from 'react';

import type { ProjectConfig } from '@myorg/shared/util-config';
import { useRouter } from '@myorg/shared/util-i18n';
import { logoutAndRedirect } from '@myorg/shared/util-auth';
import { AppShell } from '@myorg/shared/ui-layout';
import {
  LP_PROJECT_ID,
  clearLpSession,
  useAuthLogoutMutation,
  useLpSessionQuery,
} from '@myorg/modules/lp-portal/data-access';

import { buildLpSidebarOrder } from '@/lib/lp-routes';

export function LpAppShell({
  config,
  children,
}: {
  config: ProjectConfig;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const logoutMutation = useAuthLogoutMutation(LP_PROJECT_ID);
  const { data: session, isLoading } = useLpSessionQuery(LP_PROJECT_ID);

  const noSession = !isLoading && (!session || !session.menuTree?.length);
  const lockedFirstLogin = !isLoading && session?.firstLogin === 0;

  useEffect(() => {
    if (isLoading) return;
    if (noSession) {
      clearLpSession();
      router.replace('/login');
      return;
    }
    if (lockedFirstLogin) {
      router.replace('/change-pwd');
    }
  }, [isLoading, noSession, lockedFirstLogin, router]);

  // menuTree 驱动的派生 config：仅替换 modules.order，其余（layout、i18n 等）
  // 保持 configs/lp-portal.json 供给。
  const derivedConfig = useMemo<ProjectConfig>(() => {
    if (!session?.menuTree?.length) return config;
    return {
      ...config,
      modules: {
        ...config.modules,
        order: buildLpSidebarOrder(session.menuTree),
      },
    };
  }, [config, session]);

  // 门禁未决/命中期间不渲染业务内容（锁是渲染级的，避免子页 effect 抢跳）。
  if (isLoading || noSession || lockedFirstLogin) {
    return null;
  }

  return (
    <AppShell
      config={derivedConfig}
      onChangePassword={() => router.push('/profile')}
      onLogout={async () => {
        try {
          await logoutMutation.mutateAsync();
        } finally {
          logoutAndRedirect();
        }
      }}
    >
      {children}
    </AppShell>
  );
}
