/*
 * @Author: UDPN-zhangXueFeng 84691916+UDPN-zhangXueFeng@users.noreply.github.com
 * @Date: 2026-06-11 11:09:57
 * @LastEditors: UDPN-zhangXueFeng 84691916+UDPN-zhangXueFeng@users.noreply.github.com
 * @LastEditTime: 2026-06-11 14:54:00
 * @FilePath: /admin-platform/apps/admin/src/app/[locale]/layout.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { ConfigProvider } from '@myorg/shared/util-config';
import { QueryProvider } from '@myorg/shared/data-access-query';
import { AuthProvider } from '@myorg/shared/util-auth';
import { loadProjectConfig } from '@myorg/shared/util-config';
import { locales, type Locale } from '@myorg/shared/util-i18n';
import { SessionGuard } from '@/providers/session-guard';

/**
 * Locale Layout — provides shared context for all locale-scoped routes.
 *
 * Provider nesting order (outer → inner):
 *  1. NextIntlClientProvider — i18n messages for client components
 *  2. ConfigProvider — project config context
 *  3. QueryProvider — TanStack Query (needs config for projectId-based keys)
 *  4. AuthProvider — auth state
 *
 * Route-specific layout (AppShell vs. auth) is handled by (app)/layout.tsx
 * and (auth)/layout.tsx respectively.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  const config = await loadProjectConfig();
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <ConfigProvider initialConfig={config}>
        <QueryProvider>
          <AuthProvider>
            <SessionGuard />
            {children}
          </AuthProvider>
        </QueryProvider>
      </ConfigProvider>
    </NextIntlClientProvider>
  );
}
