// cross-chain data-access barrel.
//
// 命名空间路径：@myorg/modules/cross-chain/data-access
// 5 子模块（cross-chain-transactions / fx-rate / liquidity-pool / rd-bridge / token-pair）共用
// model + api + keys（cc-4），queries/mutations hooks 在 cc-5 填充。

// ── model（cc-2）──
export type {
  ResultPageInfo,
  ApiResponse,
  // 通用下拉选项
  BlockchainOption,
  BlockchainEnableOption,
  TokenOption,
  LiquidityPoolTokenOption,
  RdBridgeBlockchainOption,
  CurrencyPairOption,
  EndpointIdOption,
  EmailOption,
  SendTokenOption,
  ReceiveTokenOption,
  // 1. cross-chain-transactions
  CrossChainTxItem,
  CrossChainTxListFilters,
  CrossChainTxListParams,
  CrossChainTxListResponse,
  CrossChainTxDetail,
  TransactionTreeNode,
  // 2. fx-rate
  FxRateItem,
  FxRateListFilters,
  FxRateListParams,
  FxRateListResponse,
  FxRateDetailItem,
  FxRateDetailParams,
  FxRateDetailResponse,
  FxRateDetail,
  // 3. liquidity-pool
  LiquidityPoolItem,
  LiquidityPoolListFilters,
  LiquidityPoolListParams,
  LiquidityPoolListResponse,
  LiquidityPoolBasicInfo,
  LiquidityPoolDetail,
  TransactionRecordItem,
  LiquidityPoolTxListFilters,
  LiquidityPoolTxListResponse,
  AuthorizationRecordItem,
  LiquidityPoolAuthListFilters,
  LiquidityPoolAuthListResponse,
  OperationRecordItem,
  LiquidityPoolOpRecordListFilters,
  LiquidityPoolOpRecordListResponse,
  LiquidityPoolEditForm,
  LiquidityPoolEditDetail,
  LiquidityPoolReauthorizeReq,
  LiquidityPoolTransferOutReq,
  LiquidityPoolSaveReq,
  LiquidityPoolEditReq,
  WalletKeystoreReq,
  WalletKeystoreData,
  // 4. rd-bridge
  RdBridgeItem,
  RdBridgeListFilters,
  RdBridgeListParams,
  RdBridgeListResponse,
  RdBridgeDetail,
  RdBridgeRecordItem,
  RdBridgeRecordListFilters,
  RdBridgeRecordListResponse,
  RdBridgeRecordDetail,
  RdBridgeEditForm,
  RdBridgeSaveReq,
  RdBridgeEditReq,
  RdBridgeUpdateReq,
  // 5. token-pair
  TokenPairItem,
  TokenPairListFilters,
  TokenPairListParams,
  TokenPairListResponse,
  TokenPairDetail,
  TokenPairRecordItem,
  TokenPairRecordListFilters,
  TokenPairRecordListResponse,
  TokenPairEditForm,
  TokenPairSaveReq,
  TokenPairEditReq,
  TokenPairUpdateReq,
} from './lib/cross-chain.model';

// ── api（cc-4，33 endpoint）──
export {
  // 列表（11）
  getCrossChainTxList,
  getFxRateList,
  getFxRateDetailList,
  getLiquidityPoolList,
  getLiquidityPoolTransactions,
  getLiquidityPoolAuthorization,
  getLiquidityPoolOpRecords,
  getRdBridgeList,
  getRdBridgeRecordList,
  getTokenPairList,
  getTokenPairOperationRecords,
  // 详情（7）
  getCrossChainTxDetail,
  getCrossChainTxTreeDetails,
  getLiquidityPoolBasicInfo,
  getLiquidityPoolDetails,
  getRdBridgeDetail,
  getRdBridgeRecordDetail,
  getTokenPairDetail,
  // 写操作（11）
  saveRdBridge,
  editRdBridge,
  updateRdBridge,
  saveLiquidityPool,
  editLiquidityPool,
  reauthorizeLiquidityPool,
  transferOutLiquidityPool,
  generateWalletKeystore,
  saveTokenPair,
  editTokenPair,
  updateTokenPair,
  // 动态拼接 URL（3，GET）
  getReceiveToken,
  getEndpointId,
  getLiquidityPool,
  // 公共下拉（含子查询）
  getCurrencyPairList,
  getCommonBlockchainList,
  getCommonBlockchainEnableList,
  getStablecoinSearches,
  getRdBridgeBlockchainList,
  getRdBridgeAllUserEmailList,
  getLiquidityPoolTokenList,
  getLiquidityPoolEmailList,
  getSendTokenList,
} from './lib/cross-chain.api';

// ── keys（cc-4，按 5 子模块分 key）──
export { crossChainKeys } from './lib/+queries/cross-chain.keys';

// ── queries（cc-5，TanStack Query hooks）──
export {
  // 1. cross-chain-transactions
  useCrossChainTxListQuery,
  useCrossChainTxDetailQuery,
  useCrossChainTxTreeQuery,
  // 2. fx-rate
  useFxRateListQuery,
  useFxRateDetailListQuery,
  // 3. liquidity-pool
  useLiquidityPoolListQuery,
  useLiquidityPoolBasicInfoQuery,
  useLiquidityPoolDetailsQuery,
  useLiquidityPoolTransactionsQuery,
  useLiquidityPoolAuthorizationQuery,
  useLiquidityPoolOpRecordsQuery,
  // 4. rd-bridge
  useRdBridgeListQuery,
  useRdBridgeDetailQuery,
  useRdBridgeRecordListQuery,
  useRdBridgeRecordDetailQuery,
  // 5. token-pair
  useTokenPairListQuery,
  useTokenPairDetailQuery,
  useTokenPairOperationRecordsQuery,
  // 6. 公共下拉
  useBlockchainListQuery,
  useBlockchainEnableListQuery,
  useStablecoinSearchesQuery,
  useRdBridgeBlockchainListQuery,
  useRdBridgeAllUserEmailListQuery,
  useLiquidityPoolTokenListQuery,
  useLiquidityPoolEmailListQuery,
  useCurrencyPairListQuery,
  useSendTokenListQuery,
} from './lib/+queries/cross-chain.queries';

// ── mutations（cc-5，TanStack Query 写操作 hooks）──
export {
  // rd-bridge
  useSaveRdBridgeMutation,
  useEditRdBridgeMutation,
  useUpdateRdBridgeMutation,
  // liquidity-pool
  useSaveLiquidityPoolMutation,
  useEditLiquidityPoolMutation,
  useReauthorizeLiquidityPoolMutation,
  useTransferOutLiquidityPoolMutation,
  useGenerateWalletKeystoreMutation,
  // token-pair
  useSaveTokenPairMutation,
  useEditTokenPairMutation,
  useUpdateTokenPairMutation,
} from './lib/+queries/cross-chain.mutations';
