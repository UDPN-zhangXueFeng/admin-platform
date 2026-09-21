import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

/**
 * Next.js configuration for the kissen-admin app shell.
 *
 * CRITICAL: transpilePackages must list every @myorg/* package this app
 * imports (shared libs + the kissen-admin module) so Next.js can compile
 * monorepo libs. Missing entries cause "Cannot find module" or
 * "unexpected token" errors at build time.
 */
const nextConfig: NextConfig = {
  // Docker 部署：产出自包含 standalone 运行产物（.next/standalone），
  // 自动打平 pnpm workspace 的符号链接依赖，免去在镜像内处理 node_modules 软链结构。
  output: 'standalone',

  transpilePackages: [
    // ── kissen-admin module ──
    '@myorg/modules/kissen-admin/feature',
    '@myorg/modules/kissen-admin/data-access',
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
   * API proxy — rewrites /v1/* requests to the kissen backend.
   *
   * The client-side axios instance (kissen-client.ts) uses '/v1' as baseURL,
   * matching the source app (vite proxies '/v1' → http://127.0.0.1:9000 and
   * the production Nginx reverse proxy keeps the /v1 prefix). The rewrite
   * therefore preserves the /v1 prefix on the destination.
   *
   * Override the backend origin with NEXT_SERVICE_SERVER_URL_KISSEN
   * (defaults to the source dev backend at 127.0.0.1:9000).
   */
  async rewrites() {
    const kissenBackend =
      process.env.NEXT_SERVICE_SERVER_URL_KISSEN || 'http://127.0.0.1:9000';

    return [
      {
        source: '/v1/:path*',
        destination: `${kissenBackend}/v1/:path*`,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
