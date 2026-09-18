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
    // ── modules（td-admin 合并库：feature + data-access）──
    '@myorg/modules/td-admin/feature',
    '@myorg/modules/td-admin/data-access',
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
        source: `${agentPrefix}/api/manage/v1/wallets/user/list`,
        destination: '/api/admin-proxy/user-wallets',
      },
      {
        source: `${agentPrefix}/api/manage/v1/signed/transaction/keyServices`,
        destination: '/api/admin-proxy/key-service-platforms',
      },
      {
        source: `${agentPrefix}/:path*`,
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
