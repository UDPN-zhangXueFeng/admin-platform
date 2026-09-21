'use client';

/**
 * 个人中心路由 —— /[locale]/profile（A8）。
 *
 * (app) 路由组：AppShell 内侧栏/头部照常（源 profile 挂 MainLayout 下）。
 * 静态段 profile 优先于 [module] catch-all。无独立菜单键——登录即可达
 * （源语义）；firstLogin 锁与会话门禁由 LpAppShell 组级承担。
 */
import dynamic from 'next/dynamic';

// 与 module-page-registry 的 lp() 同模式懒加载：feature 库已被 registry
// dynamic import，此处静态 import 会违反 @nx/enforce-module-boundaries。
const ProfilePage = dynamic(
  () =>
    import('@myorg/modules/lp-portal/feature').then((m) => ({
      default: m.ProfilePage,
    })),
  { ssr: false },
);

export default function ProfileRoute() {
  return <ProfilePage />;
}
