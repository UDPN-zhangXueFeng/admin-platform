'use client';

import * as React from 'react';

import { usePathname, useRouter } from '@myorg/shared/util-i18n';
import {
  GATEWAY_TOKEN_COOKIE,
  getGatewayToken,
  isFirstLogin,
} from '@myorg/modules/kissen-gateway/data-access';

/**
 * 客户端会话守卫（源 `router/index.ts` beforeEach 的首登封锁分支）。
 *
 * middleware 只能读 cookie、无法读 localStorage 里的 userInfo，因此
 * firstLogin 判定放在客户端（会话门面 getGatewayToken/isFirstLogin）：
 * - 已登录且 firstLogin === 0（未改密）：访问除 /change-pwd 外任何页面
 *   （含 /login）一律 replace 到 /change-pwd —— 对应源 beforeEach
 *   `store.firstLogin && to.path !== '/change-pwd'` + /login 分流语义。
 * - 未登录：middleware cookie 守卫负责，此处不重复处理。
 *
 * 防循环约束：仅当 middleware 认可的会话 cookie 也在时才执行封锁。
 * cookie 过期而 localStorage 残留时（7 天 Max-Age），封锁跳转会被
 * middleware 弹回 /login 形成循环；此时放行让用户自然回到登录页。
 *
 * 登录页首登弹窗不受影响：守卫仅在 pathname 变化时重判，登录成功后
 * 停留在 /login 弹出强制改密框（源 login/index.vue 行为，无路由跳转）。
 */
export function SessionGuard() {
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    if (!getGatewayToken()) return; // 无本地会话：交给 middleware
    if (!hasGatewaySessionCookie()) return; // cookie 缺失：见上方防循环说明
    if (!isFirstLogin()) return; // 非首登（firstLogin !== 0）：无封锁
    if (pathname === '/change-pwd') return; // 改密页放行
    router.replace('/change-pwd'); // 首登封锁：任何页面拉回改密（含 /login）
  }, [pathname, router]);

  return null;
}

/** middleware 读取的会话 cookie（kissen_gateway_token）是否存在。 */
function hasGatewaySessionCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .some((entry) => entry.trim().startsWith(`${GATEWAY_TOKEN_COOKIE}=`));
}
