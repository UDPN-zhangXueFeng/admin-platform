import { getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { locales, type Locale } from '@myorg/shared/util-i18n';
import {
  ConfigProvider,
  loadProjectConfig,
  type ModuleMenuItem,
} from '@myorg/shared/util-config';
import { QueryProvider } from '@myorg/shared/data-access-query';
import { AuthProvider } from '@myorg/shared/util-auth';
import { Toaster } from '@myorg/shared/ui';

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

  // Breadcrumb derives ancestor labels from this tree; LpAppShell separately
  // builds the visible sidebar from the authenticated menuTree.
  const systemRouteItems = config.modules.order.filter((item) =>
    item.path?.startsWith('/sys/'),
  );
  const breadcrumbOrder: ModuleMenuItem[] = [];
  let hasSystemGroup = false;
  for (const item of config.modules.order) {
    if (!item.path?.startsWith('/sys/')) {
      breadcrumbOrder.push(item);
      continue;
    }
    if (!hasSystemGroup) {
      breadcrumbOrder.push({
        id: 'sys',
        icon: 'Settings',
        label: 'System Management',
        path: '/sys',
        children: systemRouteItems,
      });
      hasSystemGroup = true;
    }
  }
  const breadcrumbConfig = hasSystemGroup
    ? {
        ...config,
        modules: {
          ...config.modules,
          order: breadcrumbOrder,
        },
      }
    : config;
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <ConfigProvider initialConfig={breadcrumbConfig}>
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </ConfigProvider>
    </NextIntlClientProvider>
  );
}
