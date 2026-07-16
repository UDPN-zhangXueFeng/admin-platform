import { defineRouting } from 'next-intl/routing';
import { defaultLocale, locales } from './config';

/**
 * next-intl 路由配置
 *
 * - localePrefix: 'always' 表示所有路由都带 locale 前缀（如 /en/user、/zh-CN/user）。
 *   这保证了路由一致性，便于 CDN 缓存和 SEO，也避免了根路径 / 的歧义。
 * - 若未来需要支持无前缀的默认语言路由，可改为 'as-needed'。
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
});
