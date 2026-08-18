'use client';

/**
 * 首次登录强制改密路由 —— /[locale]/change-pwd（A4）。
 *
 * (auth) 路由组（无 AppShell）。未登录由 middleware 拦截（本路径非公开，
 * 会带 redirect 回跳参数）；此处仅兜底「cookie 残留但本地会话缺失」的
 * 边缘态（middleware 过了、localStorage 没了）→ 回登录页。
 */
import dynamic from 'next/dynamic';
import { useEffect } from 'react';

import { useRouter } from '@myorg/shared/util-i18n';
import {
  LP_PROJECT_ID,
  clearLpSession,
  useLpSessionQuery,
} from '@myorg/modules/lp-portal/data-access';
// 与 module-page-registry 的 lp() 同模式懒加载：feature 库已被 registry
// dynamic import，此处静态 import 会违反 @nx/enforce-module-boundaries。
const ChangePwdPage = dynamic(
  () =>
    import('@myorg/modules/lp-portal/feature').then((m) => ({
      default: m.ChangePwdPage,
    })),
  { ssr: false },
);

export default function ChangePwdRoute() {
  const router = useRouter();
  const { data: session, isLoading } = useLpSessionQuery(LP_PROJECT_ID);

  useEffect(() => {
    if (!isLoading && !session) {
      clearLpSession();
      router.replace('/login');
    }
  }, [isLoading, session, router]);

  if (!session) return null;

  return <ChangePwdPage />;
}
