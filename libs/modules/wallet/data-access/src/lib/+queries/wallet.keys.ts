/**
 * Wallet 模块 TanStack Query key 工厂。
 *
 * 始终通过这些助手生成 key，避免内联字符串数组导致缓存失效不一致。
 * 涵盖 operational-wallet / user-wallet / wallet-type(含 mff) 三子模块。
 */
export const walletKeys = {
  all: ['wallet'] as const,

  // ── 公共下拉 ──
  options: () => [...walletKeys.all, 'options'] as const,
  stablecoins: () => [...walletKeys.options(), 'stablecoins'] as const,
  blockchains: () => [...walletKeys.options(), 'blockchains'] as const,
  tokenTypes: () => [...walletKeys.options(), 'tokenTypes'] as const,

  // ── operational-wallet ──
  operationalWallets: (params: unknown) =>
    [...walletKeys.all, 'operational-wallets', 'list', params] as const,
  operationalWalletDetail: (ruleWalletId: number) =>
    [...walletKeys.all, 'operational-wallets', 'detail', ruleWalletId] as const,
  operationalTx: (ruleWalletId: number, page: unknown) =>
    [...walletKeys.all, 'operational-wallets', 'tx', ruleWalletId, page] as const,
  operationalOpRecord: (ruleWalletId: number, page: unknown) =>
    [
      ...walletKeys.all,
      'operational-wallets',
      'opRecord',
      ruleWalletId,
      page,
    ] as const,

  // ── user-wallet ──
  userWallets: (params: unknown) =>
    [...walletKeys.all, 'user-wallets', 'list', params] as const,
  userWalletDetail: (walletId: number) =>
    [...walletKeys.all, 'user-wallets', 'detail', walletId] as const,
  userTx: (walletId: number, page: unknown) =>
    [...walletKeys.all, 'user-wallets', 'tx', walletId, page] as const,
  userOpRecord: (walletId: number, page: unknown) =>
    [...walletKeys.all, 'user-wallets', 'opRecord', walletId, page] as const,
  userAccrual: (walletId: number, page: unknown) =>
    [...walletKeys.all, 'user-wallets', 'accrual', walletId, page] as const,
  userDistribute: (walletId: number, page: unknown) =>
    [...walletKeys.all, 'user-wallets', 'distribute', walletId, page] as const,
  userAuthorization: (walletId: number, page: unknown) =>
    [...walletKeys.all, 'user-wallets', 'authorization', walletId, page] as const,
  userAuthorized: (walletId: number, page: unknown) =>
    [...walletKeys.all, 'user-wallets', 'authorized', walletId, page] as const,
  availableWalletTypes: (walletId: number) =>
    [...walletKeys.all, 'user-wallets', 'availableTypes', walletId] as const,

  // ── wallet-type ──
  walletTypeCards: (stablecoinId: number) =>
    [...walletKeys.all, 'wallet-type', 'cards', stablecoinId] as const,
  walletTypeTable: (stablecoinId: number, page: unknown) =>
    [...walletKeys.all, 'wallet-type', 'table', stablecoinId, page] as const,
  walletTypeDetail: (ruleId: number) =>
    [...walletKeys.all, 'wallet-type', 'detail', ruleId] as const,
  accountTypes: (stablecoinId: number) =>
    [...walletKeys.all, 'wallet-type', 'accountTypes', stablecoinId] as const,
  interestPolicy: (input: unknown) =>
    [...walletKeys.all, 'wallet-type', 'interestPolicy', input] as const,
  balanceCalc: (input: unknown) =>
    [...walletKeys.all, 'wallet-type', 'balanceCalc', input] as const,
  earningsCalc: (input: unknown) =>
    [...walletKeys.all, 'wallet-type', 'earningsCalc', input] as const,
  accumulatedEarnings: (ruleId: number) =>
    [...walletKeys.all, 'wallet-type', 'accumulatedEarnings', ruleId] as const,
  dividendSummary: (billCode: string) =>
    [...walletKeys.all, 'wallet-type', 'dividendSummary', billCode] as const,
  dailyYield: (ruleId: number, page: unknown) =>
    [...walletKeys.all, 'wallet-type', 'dailyYield', ruleId, page] as const,
  dividendRecords: (billCode: string, page: unknown) =>
    [...walletKeys.all, 'wallet-type', 'dividendRecords', billCode, page] as const,
} as const;
