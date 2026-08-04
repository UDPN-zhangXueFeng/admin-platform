import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

/**
 * Next.js configuration for the admin app shell.
 *
 * CRITICAL: transpilePackages must list every @myorg/* package path so
 * Next.js can compile monorepo libs. Missing entries cause "Cannot find
 * module" or "unexpected token" errors at build time.
 */
const nextConfig: NextConfig = {
  // Docker 部署：产出自包含 standalone 运行产物（.next/standalone），
  // 自动打平 pnpm workspace 的符号链接依赖，免去在镜像内处理 node_modules 软链结构。
  output: 'standalone',

  transpilePackages: [
    // ── modules (feature / ui / data-access / util) ──
    '@myorg/modules/user/feature',
    '@myorg/modules/user/ui',
    '@myorg/modules/user/data-access',
    '@myorg/modules/user/util',
    '@myorg/modules/order/feature',
    '@myorg/modules/order/ui',
    '@myorg/modules/order/data-access',
    '@myorg/modules/order/util',
    '@myorg/modules/inventory/feature',
    '@myorg/modules/inventory/ui',
    '@myorg/modules/inventory/data-access',
    '@myorg/modules/inventory/util',
    '@myorg/modules/report/feature',
    '@myorg/modules/report/ui',
    '@myorg/modules/report/data-access',
    '@myorg/modules/report/util',
    '@myorg/modules/setting/feature',
    '@myorg/modules/setting/ui',
    '@myorg/modules/setting/data-access',
    '@myorg/modules/setting/util',
    '@myorg/modules/notification/feature',
    '@myorg/modules/notification/ui',
    '@myorg/modules/notification/data-access',
    '@myorg/modules/notification/util',
    // ── auth module ──
    '@myorg/modules/auth/feature',
    '@myorg/modules/auth/ui',
    '@myorg/modules/auth/data-access',
    '@myorg/modules/auth/util',
    // ── dashboard module ──
    '@myorg/modules/dashboard/data-access',
    // ── key-management module ──
    '@myorg/modules/key-management/feature',
    '@myorg/modules/key-management/ui',
    '@myorg/modules/key-management/data-access',
    '@myorg/modules/key-management/util',
    // ── account-manage module ──
    '@myorg/modules/account-manage/feature',
    '@myorg/modules/account-manage/ui',
    '@myorg/modules/account-manage/data-access',
    '@myorg/modules/account-manage/util',
    // ── sp-access module ──
    '@myorg/modules/sp-access/feature',
    '@myorg/modules/sp-access/data-access',
    '@myorg/modules/sp-access/util',
    // ── travel-rule module ──
    '@myorg/modules/travel-rule/feature',
    '@myorg/modules/travel-rule/ui',
    '@myorg/modules/travel-rule/data-access',
    '@myorg/modules/travel-rule/util',
    // ── shared ──
    '@myorg/shared/ui',
    '@myorg/shared/ui-forms',
    '@myorg/shared/ui-layout',
    '@myorg/shared/ui-charts',
    '@myorg/shared/data-access-api',
    '@myorg/shared/data-access-query',
    '@myorg/shared/util-config',
    '@myorg/shared/util-i18n',
    '@myorg/shared/util-i18n-messages',
    '@myorg/shared/util-state',
    '@myorg/shared/util-auth',
    '@myorg/shared/util-classnames',
    '@myorg/shared/design-tokens',
    '@myorg/shared/model',
    '@myorg/shared/util-dates',
    '@myorg/shared/util-formatting',
    '@myorg/shared/util-testing',
  ],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  /**
   * API proxy — rewrites /aps/* requests to the RBAC backend.
   *
   * This mirrors td-manage's rewrite configuration. The client-side
   * axios instance uses `/aps` as baseURL (relative path), and Next.js
   * proxies these requests to the actual backend defined by
   * NEXT_SERVICE_SERVER_URL in .env.local.
   */
  async rewrites() {
    const backendUrl = process.env.NEXT_SERVICE_SERVER_URL || 'http://10.0.48.123:30001/';
    const agentPrefix = process.env.NEXT_PUBLIC_API_BASE_URL || '/aps';

    return [
      {
        source: `${agentPrefix}/:path*`,
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
