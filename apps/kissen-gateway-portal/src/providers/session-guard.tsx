'use client';

import * as React from 'react';

import { usePathname, useRouter } from '@myorg/shared/util-i18n';
import {
  GATEWAY_TOKEN_COOKIE,
  getGatewayToken,
  isFirstLogin,
  useGatewayHasSession,
  useGatewayLockState,
} from '@myorg/modules/kissen-gateway/data-access';

/**
 * 锁定期的放行路径：入网信息页本身 + 认证页。源 MainLayout 仅对默认
 * 落地页 '/overview' 做 replace('/onboard') 纠正；目标口径更宽——
 * 「除入网/认证外受锁页一律拉回 /onboard」（'/' 落地已改 /overview，
 * 见文档 01 §7-31）。
 */
const LOCK_ALLOWED_PATHS = new Set(['/onboard', '/login', '/change-pwd']);

/**
 * 客户端会话守卫（源 `router/index.ts` beforeEach 的首登封锁分支 +
 * `layout/MainLayout.vue` onMounted 的 locked 落地纠正）。
 *
 * middleware 只能读 cookie、无法读 localStorage 里的 userInfo，因此
 * firstLogin 判定放在客户端（会话门面 getGatewayToken/isFirstLogin）：
 * - 已登录且 firstLogin === 0（未改密）：访问除 /change-pwd 外任何页面
 *   （含 /login）一律 replace 到 /change-pwd —— 对应源 beforeEach
 *   `store.firstLogin && to.path !== '/change-pwd'` + /login 分流语义。
 * - 未登录：middleware cookie 守卫负责，此处不重复处理。
 *
 * 入网/激活双门控（源 MainLayout `locked && route.path === '/overview'
 * → router.replace('/onboard')`）：挂载即拉取 onboarded/instanceActive
 * （null=未知不锁，防上行失败误锁）；locked 且当前不在放行路径时
 * replace 到 /onboard。请求失败不弹错、不阻断导航。
 *
 * 防循环约束：仅当 middleware 认可的会话 cookie 也在时才执行封锁。
 * cookie 过期而 localStorage 残留时（7 天 Max-Age），封锁跳转会被
 * middleware 弹回 /login 形成循环；此时放行让用户自然回到登录页。
 *
 * 登录页首登弹窗不受影响：守卫仅随 pathname/会话变化重判，登录成功
 * 后停留在 /login 弹出强制改密框（源 login/index.vue 行为，无路由跳转）。
 */
export function SessionGuard() {
  const pathname = usePathname();
  const router = useRouter();
  // 响应式会话标志（挂载后登录写入 token 也即时感知；源 locked 为
  // computed，天然覆盖「先深链后登录」的 SPA 跳转不重挂载场景）。
  const hasSession = useGatewayHasSession();
  // 双门控：null=未知不锁；失败态在 hook 内部消化（不上弹、不阻断导航）。
  const { locked } = useGatewayLockState(hasSession);

  React.useEffect(() => {
    if (!getGatewayToken()) return; // 无本地会话：交给 middleware
    if (!hasGatewaySessionCookie()) return; // cookie 缺失：见上方防循环说明
    if (!isFirstLogin()) return; // 非首登（firstLogin !== 0）：无封锁
    if (pathname === '/change-pwd') return; // 改密页放行
    router.replace('/change-pwd'); // 首登封锁：任何页面拉回改密（含 /login）
  }, [pathname, router]);

  React.useEffect(() => {
    // 首登封锁优先（改密页放行，不受 locked 影响）。
    if (!getGatewayToken()) return;
    if (!hasGatewaySessionCookie()) return;
    if (isFirstLogin()) return;
    if (!locked) return; // null=未知不锁（防上行失败误锁门户）
    if (LOCK_ALLOWED_PATHS.has(pathname)) return;
    router.replace('/onboard'); // 受锁页拉回入网信息（源 /overview 纠正口径）
  }, [locked, pathname, router]);

  return null;
}

/** middleware 读取的会话 cookie（kissen_gateway_token）是否存在。 */
function hasGatewaySessionCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split(';')
    .some((entry) => entry.trim().startsWith(`${GATEWAY_TOKEN_COOKIE}=`));
}
