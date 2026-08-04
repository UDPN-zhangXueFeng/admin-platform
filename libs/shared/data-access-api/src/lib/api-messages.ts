import apiMessages from '@myorg/shared/util-i18n-messages/api-msg';

/**
 * Static message map for backend MSG_xx_xxxx codes.
 *
 * The axios interceptor runs outside React, so it cannot use next-intl hooks.
 * This module provides a static (compile-time) English message map that works
 * anywhere, including in the interceptor.
 */
const messageMap: Record<string, string> = apiMessages;

/**
 * Resolve a backend MSG code to a human-readable message.
 *
 * Returns the original code if no mapping exists, so the UI can still display
 * something meaningful rather than an empty string.
 *
 * @param code - MSG code from `response.data.message`, e.g. "MSG_02_1000"
 * @returns Human-readable message or the code itself as fallback
 */
export function getMessage(code: string | undefined): string {
  if (!code) return '';
  return messageMap[code] ?? code;
}
