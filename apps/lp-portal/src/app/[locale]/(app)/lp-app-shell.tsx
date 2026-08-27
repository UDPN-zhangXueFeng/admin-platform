'use client';

/**
 * LpAppShell —— (app) 路由组的客户端壳（A5 + A4 + A8 + G6）。
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
 *  4. 通知中心接线（G6）：Header 新 trailing 直通槽喂 NotificationBellDrawer
 *     （源 MainLayout 铃铛 + 380px 抽屉；直通链路经共享 AppShell/SidebarLayout
 *     增补的 opt-in trailing prop 落入 header.tsx 既有插槽，不改 header）。
 *  5. bootstrapPending（源 MainLayout v2.1 同族语义）：menuTree 未就绪期间
 *     仅渲染侧栏/内容骨架区（不渲染业务内容、不触发门禁跳转）；会话读取失败
 *     落英文错误态 + Retry（getLpUser 解析已吞错，此态实际难达——兜底而非
 *     新增清场路径）。rootRedirect 落点核验：resolveRootPath 现有链路在本组
 *     `(app)/page.tsx`，全候选未命中落英文占位卡片（源 /placeholder 语义，
 *     UNKNOWN_MENU_PATH 兜底同源）——现状已符合，本壳不重复实现。
 *  6. bootstrapReady 横幅（源 MainLayout，矩阵 §B L40）：会话就绪且
 *     session.bootstrapReady===false 时内容区顶部渲染 amber 警示横幅（固定英文
 *     文案，提示不硬拒）；undefined（旧持久化会话缺字段）不显示。skeleton /
 *     isError 门禁分支保持原样。
 */
import dynamic from 'next/dynamic';
import { useEffect, useMemo } from 'react';

import type { ProjectConfig } from '@myorg/shared/util-config';
import { useRouter } from '@myorg/shared/util-i18n';
import { logoutAndRedirect } from '@myorg/shared/util-auth';
import { AppShell } from '@myorg/shared/ui-layout';
import { Alert, Button, Skeleton } from '@myorg/shared/ui';

import {
  LP_PROJECT_ID,
  clearLpSession,
  useAuthLogoutMutation,
  useLpSessionQuery,
} from '@myorg/modules/lp-portal/data-access';

// 壳层对 feature 库的静态 import 违反 @nx/dependency-checks 懒加载边界，
// 与 profile 页同款 next/dynamic(ssr:false) 拆包（组件本身 client-only）。
const NotificationBellDrawer = dynamic(
  () =>
    import('@myorg/modules/lp-portal/feature').then(
      (m) => m.NotificationBellDrawer,
    ),
  { ssr: false },
);

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
  const {
    data: session,
    isLoading,
    isError,
    refetch,
  } = useLpSessionQuery(LP_PROJECT_ID);

  const noSession = !isLoading && (!session || !session.menuTree?.length);
  const lockedFirstLogin = !isLoading && session?.firstLogin === 0;

  // 源 MainLayout bootstrapPending 横幅（矩阵 §B）：userInfo.bootstrapReady===
  // false → 内容区顶部黄色警示条，提示不硬拒；undefined 不显示（旧持久化会话
  // 无此字段）。amber 族样式沿用域内 ServiceDownAlert 警示横幅先例，不自造色值。
  const bootstrapPending = session?.bootstrapReady === false;

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

  // G6 bootstrapPending 分流：menuTree 未就绪 → 骨架区；会话读取失败 →
  // 英文错误态 + Retry（不清场：noSession 的清会话跳登录语义保持原样，
  // 仅对「读失败」新增兜底，避免瞬时故障误清 cookie 残留恢复链路）。
  if (isLoading) {
    return <ShellPendingSkeleton />;
  }
  if (isError && !session) {
    return <ShellLoadError onRetry={() => void refetch()} />;
  }
  if (noSession || lockedFirstLogin) {
    // 门禁命中（真未登录 / 锁定期）：维持原跳转语义，过渡帧不渲染。
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
      trailing={<NotificationBellDrawer />}
    >
      {bootstrapPending && (
        <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-900">
          Replica initialization in progress; data shown may be stale.
        </Alert>
      )}
      {children}
    </AppShell>
  );
}

/**
 * bootstrapPending 骨架区（源 §B「menuTree 加载完成前仅骨架不渲染菜单」）：
 * 侧栏列 + 内容区占位，不含任何导航文案——loading 数据为空，装饰真菜单
 * 反而误导。纯共享 Skeleton 原语拼装。
 */
function ShellPendingSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <div className="hidden w-64 shrink-0 border-r p-4 md:block">
        <Skeleton className="mb-6 h-8 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Skeleton className="h-14 w-full rounded-none border-b" />
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * 会话/菜单加载失败兜底（G6：英文错误态 + 重试）。getLpUser 已把解析失败
 * 归一为 null（实际难达此态），故同时要求 !session 才展示，避免与下方
 * noSession 清场语义竞争。
 */
function ShellLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-3 rounded-lg border bg-card p-6 text-center shadow-sm">
        <p className="text-base font-semibold">
          Failed to load workspace menus
        </p>
        <p className="text-sm text-muted-foreground">
          Your session could not be read. Nothing was changed — retry to
          continue.
        </p>
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </div>
  );
}
