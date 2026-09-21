import { redirect } from 'next/navigation';

/**
 * Locale 根路由（源 `router/index.ts` MainLayout children
 * `{ path: '', redirect: '/overview' }`，v2.0 8a6034b 起 dashboard 为
 * 默认落地页）。
 *
 * 未入网/实例未激活的锁定态由客户端 SessionGuard 拉回 /onboard（源
 * MainLayout onMounted 的 locked 落地纠正）；登录态由 middleware 兜底：
 * 未登录先跳 /[locale]/login（携带 redirect 回传参数），首登未改密用户
 * 由客户端 SessionGuard 拉回 /change-pwd，本页只负责路径语义。
 */
export default async function LocaleRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/overview`);
}
