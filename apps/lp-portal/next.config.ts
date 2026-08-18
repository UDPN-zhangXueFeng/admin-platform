import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

/**
 * Next.js configuration for the lp-portal app shell.
 *
 * CRITICAL: transpilePackages must list every @myorg/* package path so
 * Next.js can compile monorepo libs. Missing entries cause "Cannot find
 * module" or "unexpected token" errors at build time.
 */
const nextConfig: NextConfig = {
  // Docker 部署：产出自包含 standalone 运行产物（.next/standalone），
  // 自动打平 pnpm workspace 的符号链接依赖，免去在镜像内处理 node_modules 软链结构。
  output: 'standalone',

  // 双 dev 实例隔离：第二个实例（如 stub 冒烟 NEXT_LP_DIST_DIR=.next-stub）
  // 指向独立产物目录，避免与常驻 3311 实例争 .next/dev/lock；不设时走
  // Next 缺省 .next，行为不变。
  ...(process.env.NEXT_LP_DIST_DIR ? { distDir: process.env.NEXT_LP_DIST_DIR } : {}),

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
    // ── lp-portal module (this app's own feature + data-access) ──
    '@myorg/modules/lp-portal/feature',
    '@myorg/modules/lp-portal/data-access',
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
   * API proxy — LP 后端 BFF 前缀 `/lp`（工作清单 A2）。
   *
   * lp-client（libs/modules/lp-portal/data-access）以 `/lp` 为 baseURL
   * （源 vite proxy '/lp' → 127.0.0.1:8090 的 Next 等价物；生产由 Nginx
   * 反代同前缀）。目标后端用 NEXT_LP_BACKEND_URL 覆盖（默认 LP 后端
   * 10.0.7.103:8090），destination 保留 /lp 前缀（与源口径一致：全部
   * 接口走 /lp BFF 前缀）。
   */
  async rewrites() {
    const lpBackendUrl =
      process.env.NEXT_LP_BACKEND_URL || 'http://10.0.7.103:8090';

    return [
      {
        source: '/lp/:path*',
        destination: `${lpBackendUrl}/lp/:path*`,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
