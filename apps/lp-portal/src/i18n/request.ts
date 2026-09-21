/**
 * next-intl server configuration entry point.
 *
 * next-intl requires a configuration file at a known path relative to the
 * project root. This file mirrors the shared i18n request config defined in
 * @myorg/shared/util-i18n-messages so that all locale / message logic stays
 * centralized in the monorepo shared layer.
 */
import { getRequestConfig } from 'next-intl/server';
import { mergeMessages } from '@myorg/shared/util-i18n-messages';
import { loadProjectConfig } from '@myorg/shared/util-config';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) || 'en-US';

  const config = await loadProjectConfig();
  const projectId = config.project.id;
  const enabledModules = config.modules.enabled;

  const messages = await mergeMessages(locale, projectId, enabledModules);

  return {
    locale,
    messages,
  };
});
