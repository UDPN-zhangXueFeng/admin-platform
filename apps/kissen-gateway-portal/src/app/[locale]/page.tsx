import { redirect } from 'next/navigation';

/**
 * Locale 根路由（源 `router/index.ts` MainLayout children
 * `{ path: '', redirect: '/onboard' }`）。
 *
 * 源项目无 dashboard 页，'/' 的唯一去向即入网申请列表；本页对
 * /[locale] 做等价 redirect。登录态由 middleware 兜底：未登录先跳
 * /[locale]/login（携带 redirect 回传参数），首登未改密用户由客户端
 * SessionGuard 拉回 /change-pwd，本页只负责路径语义。
 */
export default async function LocaleRootPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/onboard`);
}
