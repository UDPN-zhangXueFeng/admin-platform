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
import { AppearanceSync } from '@/providers/appearance-sync';
import { BrandProvider } from '@/providers/brand-provider';

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
            {/* 防闪补偿：React 19 hydration 会剥掉防闪脚本写在 <html> 上的
                .dark / data-theme，mount 时重放（见 providers/appearance-sync） */}
            <AppearanceSync />
            {/* 品牌应用（title + 主色 CSS 变量，源 store/brand.ts 启动加载） */}
            <BrandProvider />
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
