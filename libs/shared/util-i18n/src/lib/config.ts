/**
 * i18n 配置常量与类型
 *
 * 集中管理所有 locale 相关常量，避免魔法字符串散落在各个文件中。
 * 当需要新增语言时，只需修改此文件一处。
 */

export const locales = ['en-US', 'zh-CN'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en-US';
