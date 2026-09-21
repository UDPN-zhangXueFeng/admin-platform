import type {
  CrossChainTxListParams,
  FxRateDetailParams,
  FxRateListParams,
  LiquidityPoolListParams,
  RdBridgeListParams,
  TokenPairListParams,
} from '../cross-chain.model';

/**
 * Cross-Chain TanStack Query key 工厂（按 5 子模块分 key）。
 *
 * 对齐 blockchain / mmf 模式：{@code as const} 元组，函数形式返回。
 *
 * 子模块：
 * - crossChainTx（跨链交易记录）
 * - fxRate（汇率）
 * - liquidityPool（流动性池，含 3 子表 transactions/authorization/operationRecords）
 * - rdBridge（RD-Bridge 跨链桥配置，含操作记录）
 * - tokenPair（代币对，含操作记录 + 3 动态 URL）
 *
 * 注意：列表 key 含完整 params（含 pageNum/pageSize/filters），保证筛选条件变化重新查询。
 */
export const crossChainKeys = {
  all: ['cross-chain'] as const,

  // ── 1. cross-chain-transactions（跨链交易记录）──
  crossChainTx: () => [...crossChainKeys.all, 'cross-chain-transactions'] as const,
  crossChainTxList: (params: CrossChainTxListParams) =>
    [...crossChainKeys.crossChainTx(), 'list', params] as const,
  crossChainTxDetail: (transferId: number | string) =>
    [...crossChainKeys.crossChainTx(), 'detail', transferId] as const,
  crossChainTxTree: (transferId: number | string) =>
    [...crossChainKeys.crossChainTx(), 'tree', transferId] as const,

  // ── 2. fx-rate（汇率）──
  fxRate: () => [...crossChainKeys.all, 'fx-rate'] as const,
  fxRateList: (params: FxRateListParams) =>
    [...crossChainKeys.fxRate(), 'list', params] as const,
  fxRateDetailList: (params: FxRateDetailParams) =>
    [...crossChainKeys.fxRate(), 'detail-list', params] as const,

  // ── 3. liquidity-pool（流动性池）──
  liquidityPool: () => [...crossChainKeys.all, 'liquidity-pool'] as const,
  liquidityPoolList: (params: LiquidityPoolListParams) =>
    [...crossChainKeys.liquidityPool(), 'list', params] as const,
  liquidityPoolBasicInfo: (liquidityPoolId: number | string) =>
    [...crossChainKeys.liquidityPool(), 'basic-info', liquidityPoolId] as const,
  liquidityPoolDetails: (liquidityPoolId: number | string) =>
    [...crossChainKeys.liquidityPool(), 'details', liquidityPoolId] as const,
  // 流动性池详情 3 子表（view.tsx 3 个 useCustomTable）
  liquidityPoolTransactions: (params: {
    liquidityPoolId: number | string;
    pageNum: number;
    pageSize: number;
    [key: string]: unknown;
  }) =>
    [...crossChainKeys.liquidityPool(), 'transactions', params] as const,
  liquidityPoolAuthorization: (params: {
    liquidityPoolId: number | string;
    pageNum: number;
    pageSize: number;
    [key: string]: unknown;
  }) =>
    [...crossChainKeys.liquidityPool(), 'authorization', params] as const,
  liquidityPoolOpRecords: (params: {
    liquidityPoolId: number | string;
    pageNum: number;
    pageSize: number;
    [key: string]: unknown;
  }) =>
    [...crossChainKeys.liquidityPool(), 'operation-records', params] as const,

  // ── 4. rd-bridge（RD-Bridge 跨链桥配置）──
  rdBridge: () => [...crossChainKeys.all, 'rd-bridge'] as const,
  rdBridgeList: (params: RdBridgeListParams) =>
    [...crossChainKeys.rdBridge(), 'list', params] as const,
  rdBridgeDetail: (crossChainId: number | string) =>
    [...crossChainKeys.rdBridge(), 'detail', crossChainId] as const,
  rdBridgeRecordList: (params: {
    crossChainId: number | string;
    pageNum: number;
    pageSize: number;
    [key: string]: unknown;
  }) => [...crossChainKeys.rdBridge(), 'records', params] as const,
  rdBridgeRecordDetail: (crossChainRecordId: number | string) =>
    [...crossChainKeys.rdBridge(), 'record-detail', crossChainRecordId] as const,

  // ── 5. token-pair（代币对）──
  tokenPair: () => [...crossChainKeys.all, 'token-pair'] as const,
  tokenPairList: (params: TokenPairListParams) =>
    [...crossChainKeys.tokenPair(), 'list', params] as const,
  tokenPairDetail: (tokenCrossChainId: number | string) =>
    [...crossChainKeys.tokenPair(), 'detail', tokenCrossChainId] as const,
  tokenPairOperationRecords: (params: {
    tokenCrossChainId: number | string;
    pageNum: number;
    pageSize: number;
    [key: string]: unknown;
  }) => [...crossChainKeys.tokenPair(), 'records', params] as const,
  // token-pair 编辑页动态 URL（sendToken 联动）
  tokenPairReceiveToken: (tokenId: number | string) =>
    [...crossChainKeys.tokenPair(), 'receive-token', tokenId] as const,
  tokenPairEndpointId: (blockchainId: number | string) =>
    [...crossChainKeys.tokenPair(), 'endpoint-id', blockchainId] as const,
  tokenPairLiquidityPool: (tokenId: number | string) =>
    [...crossChainKeys.tokenPair(), 'liquidity-pool', tokenId] as const,

  // ── 公共下拉（多子模块共用）──
  // 三类链下拉接口不同，分别建 key 避免缓存污染：
  //   commonBlockchainList（cct/lp）、commonBlockchainEnableList（tp）、rdBridgeBlockchainList（rb）
  commonBlockchainDropdown: () =>
    [...crossChainKeys.all, 'common-blockchain-dropdown'] as const,
  commonBlockchainEnableDropdown: () =>
    [...crossChainKeys.all, 'common-blockchain-enable-dropdown'] as const,
  stablecoinDropdown: () =>
    [...crossChainKeys.all, 'stablecoin-dropdown'] as const,
  rdBridgeBlockchainDropdown: () =>
    [...crossChainKeys.all, 'rd-bridge-blockchain-dropdown'] as const,
  rdBridgeAllUserEmailDropdown: () =>
    [...crossChainKeys.all, 'rd-bridge-all-user-email-dropdown'] as const,
  liquidityPoolTokenDropdown: () =>
    [...crossChainKeys.all, 'liquidity-pool-token-dropdown'] as const,
  liquidityPoolEmailDropdown: () =>
    [...crossChainKeys.all, 'liquidity-pool-email-dropdown'] as const,
  currencyPairDropdown: () =>
    [...crossChainKeys.all, 'currency-pair-dropdown'] as const,
  sendTokenDropdown: () =>
    [...crossChainKeys.all, 'send-token-dropdown'] as const,
} as const;
