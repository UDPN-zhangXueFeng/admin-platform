/**
 * Reconciliation 模块 TanStack Query key 工厂。
 *
 * 始终通过这些助手生成 key，避免内联字符串数组导致缓存失效不一致。
 * 涵盖 real-time（token 列表 / token 详情 / tx 列表 / investigation / recon-log）+
 * reserve（asset 列表 / asset 详情 / reserve 列表 / investigation / recon-log）+
 * 跨域 leaf-accounts。
 */
export const reconciliationKeys = {
  all: ['reconciliation'] as const,

  // ── Real-time (Token) 域 ────────────────────────────────────────────────────
  tokenList: (params: unknown) =>
    [...reconciliationKeys.all, 'real-time', 'token-list', params] as const,
  tokenBasicDetail: (tokenId: number) =>
    [...reconciliationKeys.all, 'real-time', 'token-basic-detail', tokenId] as const,
  txList: (params: unknown) =>
    [...reconciliationKeys.all, 'real-time', 'tx-list', params] as const,
  txInvestigation: (params: unknown) =>
    [...reconciliationKeys.all, 'real-time', 'tx-investigation', params] as const,
  txReconLog: (reconciliationTxId: number) =>
    [
      ...reconciliationKeys.all,
      'real-time',
      'tx-recon-log',
      reconciliationTxId,
    ] as const,

  // ── 跨域共享（末级科目，reserve 也调） ─────────────────────────────────────
  leafAccounts: (financeBookId: number) =>
    [...reconciliationKeys.all, 'leaf-accounts', financeBookId] as const,

  // ── Reserve 域 ──────────────────────────────────────────────────────────────
  reserveAssetList: (params: unknown) =>
    [...reconciliationKeys.all, 'reserve', 'asset-list', params] as const,
  reserveBasicDetail: (reserveAccountId: number) =>
    [
      ...reconciliationKeys.all,
      'reserve',
      'basic-detail',
      reserveAccountId,
    ] as const,
  reserveList: (params: unknown) =>
    [...reconciliationKeys.all, 'reserve', 'list', params] as const,
  reserveInvestigation: (params: unknown) =>
    [...reconciliationKeys.all, 'reserve', 'investigation', params] as const,
  reserveReconLog: (reconciliationReserveId: number) =>
    [
      ...reconciliationKeys.all,
      'reserve',
      'recon-log',
      reconciliationReserveId,
    ] as const,
} as const;
