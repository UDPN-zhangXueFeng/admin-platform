/**
 * CJS stub for `next-intl` so the MmfStatusBadge spec runs under @swc/jest.
 *
 * Why: next-intl ships pure ESM (`"type": "module"`, main `dist/esm/...`).
 * @swc/jest cannot transform ESM from node_modules, so importing the real
 * `useTranslations` crashes the spec. Jest's moduleNameMapper swaps it for this
 * CommonJS stub. The `useTranslations(namespace)` call returns a translator
 * that echoes the resolved key (namespace + '.' + key), which is enough to
 * assert the badge builds the correct i18n label key per kind+status.
 */
export function useTranslations(namespace: string) {
  return function t(key: string): string {
    return `${namespace}.${key}`;
  };
}
