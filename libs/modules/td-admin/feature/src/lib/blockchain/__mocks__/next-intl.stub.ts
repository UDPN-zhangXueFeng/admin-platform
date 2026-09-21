/**
 * CJS stub for `next-intl` so the BlockchainStatusBadge spec runs under @swc/jest.
 *
 * Why: next-intl ships pure ESM (`"type": "module"`, main `dist/esm/...`).
 * @swc/jest cannot transform ESM from node_modules, so importing the real
 * `useTranslations` crashes the spec. Jest's moduleNameMapper swaps it for this
 * CommonJS stub. The `useTranslations(namespace)` call returns a translator
 * that echoes the resolved key (namespace + '.' + key), which is enough to
 * assert the badge builds the correct i18n label/color key per kind+status.
 *
 * Note: blockchain node 色值走 i18n key `common_task_status_color_${status}`，
 * stub 回显 `modules.blockchain.common_task_status_color_${status}` —— 与文案 key
 * 同样落入 modules.blockchain 命名空间，spec 据此断言 tone class。
 */
export function useTranslations(namespace: string) {
  return function t(key: string): string {
    return `${namespace}.${key}`;
  };
}
