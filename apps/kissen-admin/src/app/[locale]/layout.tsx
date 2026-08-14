import { getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { ConfigProvider } from '@myorg/shared/util-config';
import { QueryProvider } from '@myorg/shared/data-access-query';
import { AuthProvider } from '@myorg/shared/util-auth';
import { Toaster } from '@myorg/shared/ui';
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
 * SessionGuard is a no-op in mock mode (see providers/session-guard.tsx).
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
            {/* 全局 toast 出口（sonner）——useToast 命令式调用需要此挂载点，
                对应源项目全局可用的 ElMessage。 */}
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </ConfigProvider>
    </NextIntlClientProvider>
  );
}
