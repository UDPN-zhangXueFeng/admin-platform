import { loadProjectConfig } from '@myorg/shared/util-config';

import { LpAppShell } from './lp-app-shell';

/**
 * App Layout — wraps authenticated routes with LpAppShell (sidebar + header).
 *
 * LpAppShell（客户端）在此接管 AppShell 装配：侧栏由登录响应 menuTree
 * 驱动（A5），并承担会话门禁 / firstLogin 锁 / Header 登出接线。config
 * 仍在此加载一次（服务端），避免子路由重复请求。
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await loadProjectConfig();

  return <LpAppShell config={config}>{children}</LpAppShell>;
}
