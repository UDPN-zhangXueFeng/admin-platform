import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

/**
 * Next.js configuration for the kissen-gateway-portal app shell.
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
    // ── kissen-gateway module (this app's feature + data-access) ──
    '@myorg/modules/kissen-gateway/feature',
    '@myorg/modules/kissen-gateway/data-access',
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
   * API proxy — rewrites /kissen-api/* requests to the gateway backend.
   *
   * The client axios baseURL is `/kissen-api/bankgw/portal` (env
   * NEXT_PUBLIC_API_BASE_URL). The proxy strips only the `/kissen-api`
   * prefix, so the backend receives `/bankgw/portal/...` verbatim; the
   * public brand endpoint (`/kissen-api/bankgw/brand`) matches the same
   * rule and reaches `/bankgw/brand`. Backend origin comes from
   * NEXT_SERVICE_SERVER_URL in .env.local.
   */
  async rewrites() {
    const backendUrl = process.env.NEXT_SERVICE_SERVER_URL || 'http://localhost:8080';

    return [
      {
        source: '/kissen-api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
