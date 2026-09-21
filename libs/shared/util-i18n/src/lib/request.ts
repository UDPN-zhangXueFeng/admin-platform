import { getRequestConfig } from 'next-intl/server';
import { mergeMessages } from '@myorg/shared/util-i18n-messages';

/**
 * next-intl 服务端请求配置
 *
 * 在 Next.js App Router 的 Server Components 中使用。
 * 每次请求时根据当前 locale 和项目配置合并翻译消息，
 * 仅加载启用的模块翻译，避免未启用模块的翻译被打包/加载。
 *
 * 注意：
 * - projectId 和 enabledModules 可从 cookie、header 或外部配置系统传入。
 * - 此处使用环境变量作为默认回退，保持与构建时配置一致。
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;

  const projectId = process.env.NX_PROJECT_ID || 'ecommerce';

  // enabledModules 默认包含 user 和 order，与 configs/ecommerce.json 的默认值对齐。
  // 实际运行时可通过请求上下文或配置系统动态传入。
  const enabledModules = ['user', 'order'];

  const messages = await mergeMessages(locale, projectId, enabledModules);

  return {
    locale,
    messages,
  };
});
