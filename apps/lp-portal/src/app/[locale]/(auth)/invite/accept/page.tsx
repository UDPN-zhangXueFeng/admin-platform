'use client';

/**
 * 管理员邀请落地页路由 —— /[locale]/invite/accept（v2.1 a522963）。
 *
 * (auth) 路由组（无 AppShell）。middleware PUBLIC_PATH_PREFIXES 已放行
 * （免登录，鉴权靠 ?token= 一次性 invite token）——与 change-pwd 不同，
 * 此处无会话兜底：页面自身状态机覆盖无 token / 失效 token 的错误态。
 */
import dynamic from 'next/dynamic';

// 与 module-page-registry 的 lp() 同模式懒加载：feature 库已被 registry
// dynamic import，此处静态 import 会违反 @nx/enforce-module-boundaries。
const InviteAcceptPage = dynamic(
  () =>
    import('@myorg/modules/lp-portal/feature').then((m) => ({
      default: m.InviteAcceptPage,
    })),
  { ssr: false },
);

export default function InviteAcceptRoute() {
  return <InviteAcceptPage />;
}
