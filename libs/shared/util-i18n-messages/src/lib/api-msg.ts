import enUSApiMsg from './en-US/api-msg.json';

/**
 * Static English message map for backend MSG_xx_xxxx codes.
 *
 * Dedicated entry (`@myorg/shared/util-i18n-messages/api-msg`) for consumers
 * that run outside React and cannot use next-intl hooks — e.g. the axios
 * interceptor in `shared/data-access-api`. Keeping it a separate entry point
 * avoids pulling the full i18n message graph into those consumers' bundles.
 */
const apiMessages: Record<string, string> = enUSApiMsg;

export default apiMessages;
