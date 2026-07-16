/**
 * CJS stub for `next-intl` so the CrossChainStatusBadge spec runs under @swc/jest.
 *
 * Why: next-intl ships pure ESM (`"type": "module"`, main `dist/esm/...`).
 * @swc/jest cannot transform ESM from node_modules, so importing the real
 * `useTranslations` crashes the spec. Jest's moduleNameMapper swaps it for this
 * CommonJS stub. The `useTranslations(namespace)` call returns a translator
 * that echoes the resolved key (namespace + '.' + key), which is enough to
 * assert the badge builds the correct i18n label key per kind + status.
 *
 * Note: cross-chain 色值走各子模块常量（antd 色名），不依赖 i18n 返回色名；
 * 文案 key 走 stub 回显 `modules.cross-chain.<prefix><status>`，spec 据此断言。
 */
export function useTranslations(namespace: string) {
  return function t(key: string): string {
    return `${namespace}.${key}`;
  };
}
