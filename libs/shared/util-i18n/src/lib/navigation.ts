import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * 类型安全的 i18n 导航工具
 *
 * 通过 createNavigation 基于 routing 配置生成：
 * - Link: 自动补全 href 和 locale 的 Next.js Link 封装
 * - redirect: 服务端/客户端重定向，自动处理 locale
 * - usePathname: 返回不含 locale 前缀的 pathname
 * - useRouter: 类型安全的 router，push/replace 自动携带 locale
 *
 * 所有模块统一使用这些导出，禁止直接使用 next/navigation 或 next/link
 * 以避免 locale 前缀丢失或类型不匹配。
 */
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
