import {
  apiClient,
  type ApiRequestConfig,
} from '@myorg/shared/data-access-api';
import type {
  AuthorizationRecordItem,
  BlockchainEnableOption,
  BlockchainOption,
  CrossChainTxDetail,
  CrossChainTxItem,
  CrossChainTxListFilters,
  CrossChainTxListParams,
  CrossChainTxListResponse,
  CurrencyPairOption,
  EmailOption,
  EndpointIdOption,
  FxRateDetailItem,
  FxRateDetailParams,
  FxRateDetailResponse,
  FxRateItem,
  FxRateListParams,
  FxRateListResponse,
  LiquidityPoolBasicInfo,
  LiquidityPoolEditDetail,
  LiquidityPoolEditReq,
  LiquidityPoolItem,
  LiquidityPoolListParams,
  LiquidityPoolListResponse,
  LiquidityPoolAuthListResponse,
  LiquidityPoolOpRecordListResponse,
  LiquidityPoolReauthorizeReq,
  LiquidityPoolSaveReq,
  LiquidityPoolTokenOption,
  LiquidityPoolTransferOutReq,
  LiquidityPoolTxListResponse,
  OperationRecordItem,
  RdBridgeBlockchainOption,
  RdBridgeDetail,
  RdBridgeEditReq,
  RdBridgeItem,
  RdBridgeListParams,
  RdBridgeListResponse,
  RdBridgeRecordDetail,
  RdBridgeRecordItem,
  RdBridgeRecordListResponse,
  RdBridgeSaveReq,
  RdBridgeUpdateReq,
  ReceiveTokenOption,
  ResultPageInfo,
  SendTokenOption,
  TokenPairDetail,
  TokenPairEditReq,
  TokenPairItem,
  TokenPairListParams,
  TokenPairListResponse,
  TokenPairRecordItem,
  TokenPairRecordListResponse,
  TokenPairSaveReq,
  TokenPairUpdateReq,
  TokenOption,
  TransactionRecordItem,
  TransactionTreeNode,
  WalletKeystoreData,
  WalletKeystoreReq,
} from './cross-chain.model';

/**
 * Cross-Chain 模块 API（33 个 endpoint）。
 *
 * endpoint 前缀分两类：
 * - `/api/manage/v1/`（cross / crossChain / common / util 域，绝大多数接口）
 * - `/api/fx/v1/rate/*`（fx-rate 子模块专用前缀，与 manage 不同，勿混）
 *
 * `apiClient` 自动解包 `{ code, message, data }` 信封。
 * 列表 API 注入字符串 `id`（= String(主键)）满足 DataTable `{ id: string }` 契约。
 *
 * 硬约束（cc-4 summary）：
 * - ① 全部 list 请求体使用 `pageNum`/`pageSize`（非 page），对齐 RBAC/sys 域后端约定。
 * - ② 3 个动态拼接 URL（getReceiveToken / getEndpointId / getLiquidityPool）尾部斜杠后拼动态 id，GET。
 * - ③ fx-rate 三个接口（currency/pair/list、rate/list、rate/detail）前缀是 `/api/fx/v1/`（非 manage）。
 * - ④ 三个链下拉勿混：
 *     - rd-bridge 用 cross/chain/getBlockChainList（{ blockChainId, blockChainName, unit }）
 *     - cct / lp 用 common/blockchain/list（{ key, value, status }）
 *     - token-pair 用 common/blockchain/enableList（{ key, value }，仅启用链）
 * - ⑤ getLiquidityPoolEmailList 纠正源码函数名拼写错误 `getLiquidityPoolEmailListtApi`（Listt 多一个 t）。
 */

// ── 常量：endpoint URL ──

// cross-chain-transactions（cross 域）
const CROSS_TX_LIST_URL = '/api/manage/v1/cross/transactions/listPage';
const CROSS_TX_DETAIL_URL = '/api/manage/v1/cross/transactions/detail';
const CROSS_TX_TREE_URL = '/api/manage/v1/cross/transactions/tree/details';

// fx-rate（fx 域，前缀不同于 manage）
const FX_CURRENCY_PAIR_LIST_URL = '/api/fx/v1/rate/currency/pair/list';
const FX_RATE_LIST_URL = '/api/fx/v1/rate/list';
const FX_RATE_DETAIL_URL = '/api/fx/v1/rate/detail';

// liquidity-pool（cross/liquidityPool 域）
const LP_LIST_URL = '/api/manage/v1/cross/liquidityPool/listPage';
const LP_BASIC_INFORMATION_URL =
  '/api/manage/v1/cross/liquidityPool/details/basicInformation';
const LP_TRANSACTIONS_URL =
  '/api/manage/v1/cross/liquidityPool/details/transactions';
const LP_AUTHORIZATION_URL =
  '/api/manage/v1/cross/liquidityPool/details/authorization';
const LP_OPERATION_RECORDS_URL =
  '/api/manage/v1/cross/liquidityPool/details/operationRecords';
const LP_DETAILS_URL = '/api/manage/v1/cross/liquidityPool/details';
const LP_NEW_URL = '/api/manage/v1/cross/liquidityPool/new';
const LP_EDIT_URL = '/api/manage/v1/cross/liquidityPool/edit';
const LP_REAUTHORIZE_URL = '/api/manage/v1/cross/liquidityPool/reauthorize';
const LP_TRANSFER_OUT_URL = '/api/manage/v1/cross/liquidityPool/transferOut';
const LP_NEW_TOKEN_LIST_URL = '/api/manage/v1/cross/liquidityPool/new/tokenList';
const LP_NEW_EMAIL_LIST_URL = '/api/manage/v1/cross/liquidityPool/new/emailList';

// rd-bridge（cross/chain 域）
const RD_BRIDGE_LIST_URL = '/api/manage/v1/cross/chain/getCrossChainList';
const RD_BRIDGE_DETAIL_URL = '/api/manage/v1/cross/chain/getCrossChainDetail';
const RD_BRIDGE_RECORD_LIST_URL =
  '/api/manage/v1/cross/chain/getCrossChainRecordList';
const RD_BRIDGE_RECORD_DETAIL_URL =
  '/api/manage/v1/cross/chain/getCrossChainRecordDetail';
const RD_BRIDGE_BLOCKCHAIN_LIST_URL =
  '/api/manage/v1/cross/chain/getBlockChainList';
const RD_BRIDGE_ALL_USER_EMAIL_URL =
  '/api/manage/v1/cross/chain/getAllUserEmailList';
const RD_BRIDGE_SAVE_URL = '/api/manage/v1/cross/chain/save';
const RD_BRIDGE_EDIT_URL = '/api/manage/v1/cross/chain/edit';
const RD_BRIDGE_UPDATE_URL = '/api/manage/v1/cross/chain/update';

// token-pair（crossChain/tokenPair 域）
const TOKEN_PAIR_LIST_URL =
  '/api/manage/v1/crossChain/tokenPair/queryTokenPairList';
const TOKEN_PAIR_DETAIL_URL =
  '/api/manage/v1/crossChain/tokenPair/getTokenPairDetail';
const TOKEN_PAIR_OPERATION_RECORDS_URL =
  '/api/manage/v1/crossChain/tokenPair/queryOperationRecords';
const TOKEN_PAIR_SEND_TOKEN_URL =
  '/api/manage/v1/crossChain/tokenPair/getSendToken';
const TOKEN_PAIR_SAVE_URL = '/api/manage/v1/crossChain/tokenPair/save';
const TOKEN_PAIR_EDIT_URL = '/api/manage/v1/crossChain/tokenPair/edit';
const TOKEN_PAIR_UPDATE_URL = '/api/manage/v1/crossChain/tokenPair/update';

// 公共下拉（common 域）
const COMMON_BLOCKCHAIN_LIST_URL = '/api/manage/v1/common/blockchain/list';
const COMMON_BLOCKCHAIN_ENABLE_LIST_URL =
  '/api/manage/v1/common/blockchain/enableList';
const COMMON_STABLECOIN_SEARCHES_URL =
  '/api/manage/v1/common/stablecoin/enabled/searches';

// 钱包生成（util 域）
const WALLET_KEYSTORE_URL = '/api/manage/v1/util/wallet/keystore';

// ── 中间类型：后端列表行（无 id）──
type CrossChainTxItemApi = Omit<CrossChainTxItem, 'id'>;
type FxRateItemApi = Omit<FxRateItem, 'id'>;
type FxRateDetailItemApi = Omit<FxRateDetailItem, 'id'>;
type LiquidityPoolItemApi = Omit<LiquidityPoolItem, 'id'>;
type TransactionRecordItemApi = Omit<TransactionRecordItem, 'id'>;
type AuthorizationRecordItemApi = Omit<AuthorizationRecordItem, 'id'>;
type OperationRecordItemApi = Omit<OperationRecordItem, 'id'>;
type RdBridgeItemApi = Omit<RdBridgeItem, 'id'>;
type RdBridgeRecordItemApi = Omit<RdBridgeRecordItem, 'id'>;
type TokenPairItemApi = Omit<TokenPairItem, 'id'>;
type TokenPairRecordItemApi = Omit<TokenPairRecordItem, 'id'>;

interface ListResponseApi<TRow> {
  page?: ResultPageInfo;
  rows?: TRow[];
}

/** 列表请求体（对齐 td-manage useCustomTable 后端契约：data + page 包裹）。 */
interface ListRequestBody<TFilters> {
  data: TFilters;
  page: { pageNum: number; pageSize: number };
}

// ======================================================================
// 1. 列表 API（11 个）
// ======================================================================

/**
 * 跨链交易分页列表查询。
 * 请求体使用 pageNum/pageSize（非 page）。
 */
export async function getCrossChainTxList(
  params: CrossChainTxListParams,
  config?: ApiRequestConfig,
): Promise<CrossChainTxListResponse> {
  const res = await apiClient.post<ListResponseApi<CrossChainTxItemApi>>(
    CROSS_TX_LIST_URL,
    {
      data: params.filters ?? {},
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    } satisfies ListRequestBody<CrossChainTxListFilters>,
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): CrossChainTxItem => ({
        ...r,
        id: String(r.transferId ?? ''),
      }),
    ),
  };
}

/**
 * 汇率分页列表查询。
 * 前缀 `/api/fx/v1/`（非 manage），请求体 pageNum/pageSize。
 */
export async function getFxRateList(
  params: FxRateListParams,
  config?: ApiRequestConfig,
): Promise<FxRateListResponse> {
  const res = await apiClient.post<ListResponseApi<FxRateItemApi>>(
    FX_RATE_LIST_URL,
    {
      data: params.filters ?? {},
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    } satisfies ListRequestBody<FxRateListParams['filters']>,
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): FxRateItem => ({
        ...r,
        id: String(r.rateId ?? ''),
      }),
    ),
  };
}

/**
 * 汇率详情页历史汇率分页列表查询（详情页用列表接口，initialValues 带 rateId）。
 * 前缀 `/api/fx/v1/`，请求体 pageNum/pageSize。
 *
 * 注意：fx-rate 的 updateTime 是字符串（需 Number() 转），其他模块 number。
 * 此处仅做透传，转换在消费层处理。
 */
export async function getFxRateDetailList(
  params: FxRateDetailParams,
  config?: ApiRequestConfig,
): Promise<FxRateDetailResponse> {
  const res = await apiClient.post<ListResponseApi<FxRateDetailItemApi>>(
    FX_RATE_DETAIL_URL,
    {
      rateId: params.rateId,
      startTime: params.startTime,
      endTime: params.endTime,
      page: { pageNum: params.pageNum ?? 1, pageSize: params.pageSize ?? 10 },
    },
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): FxRateDetailItem => ({
        ...r,
        id: String(r.rateRecordId ?? ''),
      }),
    ),
  };
}

/**
 * 流动性池分页列表查询。
 * 请求体 pageNum/pageSize。
 */
export async function getLiquidityPoolList(
  params: LiquidityPoolListParams,
  config?: ApiRequestConfig,
): Promise<LiquidityPoolListResponse> {
  const res = await apiClient.post<ListResponseApi<LiquidityPoolItemApi>>(
    LP_LIST_URL,
    {
      data: params.filters ?? {},
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    } satisfies ListRequestBody<LiquidityPoolListParams['filters']>,
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): LiquidityPoolItem => ({
        ...r,
        id: String(r.liquidityPoolId ?? ''),
      }),
    ),
  };
}

/**
 * 流动性池详情 - transactions 子表分页列表查询。
 * 请求体 pageNum/pageSize，initialValues 带 liquidityPoolId。
 */
export async function getLiquidityPoolTransactions(
  filters: {
    liquidityPoolId: number;
    pageNum: number;
    pageSize: number;
    [key: string]: unknown;
  },
  config?: ApiRequestConfig,
): Promise<LiquidityPoolTxListResponse> {
  const res = await apiClient.post<ListResponseApi<TransactionRecordItemApi>>(
    LP_TRANSACTIONS_URL,
    {
      data: filters,
      page: { pageNum: filters.pageNum, pageSize: filters.pageSize },
    },
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): TransactionRecordItem => ({
        ...r,
        id: String(r.transactionId ?? ''),
      }),
    ),
  };
}

/**
 * 流动性池详情 - authorization 子表分页列表查询。
 * 请求体 pageNum/pageSize，initialValues 带 liquidityPoolId。
 */
export async function getLiquidityPoolAuthorization(
  filters: {
    liquidityPoolId: number;
    pageNum: number;
    pageSize: number;
    [key: string]: unknown;
  },
  config?: ApiRequestConfig,
): Promise<LiquidityPoolAuthListResponse> {
  const res = await apiClient.post<ListResponseApi<AuthorizationRecordItemApi>>(
    LP_AUTHORIZATION_URL,
    {
      data: filters,
      page: { pageNum: filters.pageNum, pageSize: filters.pageSize },
    },
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): AuthorizationRecordItem => ({
        ...r,
        id: String(r.recordId ?? ''),
      }),
    ),
  };
}

/**
 * 流动性池详情 - operationRecords 子表分页列表查询。
 * 请求体 pageNum/pageSize，initialValues 带 liquidityPoolId。
 */
export async function getLiquidityPoolOpRecords(
  filters: {
    liquidityPoolId: number;
    pageNum: number;
    pageSize: number;
    [key: string]: unknown;
  },
  config?: ApiRequestConfig,
): Promise<LiquidityPoolOpRecordListResponse> {
  const res = await apiClient.post<ListResponseApi<OperationRecordItemApi>>(
    LP_OPERATION_RECORDS_URL,
    {
      data: filters,
      page: { pageNum: filters.pageNum, pageSize: filters.pageSize },
    },
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): OperationRecordItem => ({
        ...r,
        id: String(r.recordId ?? ''),
      }),
    ),
  };
}

/**
 * RD-Bridge 分页列表查询。
 * 请求体 pageNum/pageSize。
 */
export async function getRdBridgeList(
  params: RdBridgeListParams,
  config?: ApiRequestConfig,
): Promise<RdBridgeListResponse> {
  const res = await apiClient.post<ListResponseApi<RdBridgeItemApi>>(
    RD_BRIDGE_LIST_URL,
    {
      data: params.filters ?? {},
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    } satisfies ListRequestBody<RdBridgeListParams['filters']>,
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): RdBridgeItem => ({
        ...r,
        id: String(r.crossChainId ?? ''),
      }),
    ),
  };
}

/**
 * RD-Bridge 详情 - 操作记录子表分页列表查询。
 * 请求体 pageNum/pageSize，initialValues 带 crossChainId。
 */
export async function getRdBridgeRecordList(
  filters: {
    crossChainId: number;
    pageNum: number;
    pageSize: number;
    [key: string]: unknown;
  },
  config?: ApiRequestConfig,
): Promise<RdBridgeRecordListResponse> {
  const res = await apiClient.post<ListResponseApi<RdBridgeRecordItemApi>>(
    RD_BRIDGE_RECORD_LIST_URL,
    {
      data: filters,
      page: { pageNum: filters.pageNum, pageSize: filters.pageSize },
    },
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): RdBridgeRecordItem => ({
        ...r,
        id: String(r.crossChainRecordId ?? ''),
      }),
    ),
  };
}

/**
 * 代币对分页列表查询。
 * 请求体 pageNum/pageSize。
 */
export async function getTokenPairList(
  params: TokenPairListParams,
  config?: ApiRequestConfig,
): Promise<TokenPairListResponse> {
  const res = await apiClient.post<ListResponseApi<TokenPairItemApi>>(
    TOKEN_PAIR_LIST_URL,
    {
      data: params.filters ?? {},
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    } satisfies ListRequestBody<TokenPairListParams['filters']>,
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): TokenPairItem => ({
        ...r,
        id: String(r.tokenCrossChainId ?? ''),
      }),
    ),
  };
}

/**
 * 代币对详情 - 操作记录子表分页列表查询。
 * 请求体 pageNum/pageSize，initialValues 带 tokenCrossChainId。
 */
export async function getTokenPairOperationRecords(
  filters: {
    tokenCrossChainId: number;
    pageNum: number;
    pageSize: number;
    [key: string]: unknown;
  },
  config?: ApiRequestConfig,
): Promise<TokenPairRecordListResponse> {
  const res = await apiClient.post<ListResponseApi<TokenPairRecordItemApi>>(
    TOKEN_PAIR_OPERATION_RECORDS_URL,
    {
      data: filters,
      page: { pageNum: filters.pageNum, pageSize: filters.pageSize },
    },
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): TokenPairRecordItem => ({
        ...r,
        id: String(r.recordId ?? ''),
      }),
    ),
  };
}

// ======================================================================
// 2. 详情 API（7 个）
// ======================================================================

/**
 * 跨链交易详情查询（顶部信息区 8 字段）。
 */
export async function getCrossChainTxDetail(
  transferId: number | string,
  config?: ApiRequestConfig,
): Promise<CrossChainTxDetail | undefined> {
  const data = await apiClient.post<CrossChainTxDetail | null>(
    CROSS_TX_DETAIL_URL,
    { transferId },
    config,
  );
  return data ?? undefined;
}

/**
 * 跨链交易 Steps 时间线节点查询（按 transferId 拉节点数组）。
 * tokenPair/tree/details 返回节点数组（按 index 0/1/2/3+ 分支渲染）。
 */
export async function getCrossChainTxTreeDetails(
  transferId: number | string,
  config?: ApiRequestConfig,
): Promise<TransactionTreeNode[]> {
  const data = await apiClient.post<TransactionTreeNode[] | null>(
    CROSS_TX_TREE_URL,
    { transferId },
    config,
  );
  return data ?? [];
}

/**
 * 流动性池基本信息查询（详情页 Tab1 两段 Descriptions）。
 */
export async function getLiquidityPoolBasicInfo(
  liquidityPoolId: number | string,
  config?: ApiRequestConfig,
): Promise<LiquidityPoolBasicInfo | undefined> {
  const data = await apiClient.post<LiquidityPoolBasicInfo | null>(
    LP_BASIC_INFORMATION_URL,
    { liquidityPoolId },
    config,
  );
  return data ?? undefined;
}

/**
 * 流动性池完整详情查询（编辑页回填用，含 keystore/threshold/emailRecipients）。
 */
export async function getLiquidityPoolDetails(
  liquidityPoolId: number | string,
  config?: ApiRequestConfig,
): Promise<LiquidityPoolEditDetail | undefined> {
  const data = await apiClient.post<LiquidityPoolEditDetail | null>(
    LP_DETAILS_URL,
    { liquidityPoolId },
    config,
  );
  return data ?? undefined;
}

/**
 * RD-Bridge 详情查询（详情页 + 编辑页回填共用同一 endpoint，去重 1 个）。
 */
export async function getRdBridgeDetail(
  crossChainId: number | string,
  config?: ApiRequestConfig,
): Promise<RdBridgeDetail | undefined> {
  const data = await apiClient.post<RdBridgeDetail | null>(
    RD_BRIDGE_DETAIL_URL,
    { crossChainId },
    config,
  );
  return data ?? undefined;
}

/**
 * RD-Bridge 操作记录 Drawer 详情查询（getCrossChainRecordDetail，4 组信息）。
 */
export async function getRdBridgeRecordDetail(
  crossChainRecordId: number | string,
  config?: ApiRequestConfig,
): Promise<RdBridgeRecordDetail | undefined> {
  const data = await apiClient.post<RdBridgeRecordDetail | null>(
    RD_BRIDGE_RECORD_DETAIL_URL,
    { crossChainRecordId },
    config,
  );
  return data ?? undefined;
}

/**
 * 代币对详情查询（详情页 + 编辑页回填共用同一 endpoint，去重 1 个）。
 */
export async function getTokenPairDetail(
  tokenCrossChainId: number | string,
  config?: ApiRequestConfig,
): Promise<TokenPairDetail | undefined> {
  const data = await apiClient.post<TokenPairDetail | null>(
    TOKEN_PAIR_DETAIL_URL,
    { tokenCrossChainId },
    config,
  );
  return data ?? undefined;
}

// ======================================================================
// 3. 写操作 / 子查询 API（14 个 + 公共下拉）
// ======================================================================

// ── RD-Bridge 写操作（3 个：save/edit/update）──

/** 新增 RD-Bridge（注册）。 */
export function saveRdBridge(
  dto: RdBridgeSaveReq,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(RD_BRIDGE_SAVE_URL, dto, config);
}

/**
 * 编辑 RD-Bridge（剔除 endpointId/blockchainId，仅可改合约地址/监控/邮箱）。
 */
export function editRdBridge(
  dto: RdBridgeEditReq,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(RD_BRIDGE_EDIT_URL, dto, config);
}

/**
 * 更新 RD-Bridge 状态（启用 status:35 / 禁用 status:50，含 remarks）。
 */
export function updateRdBridge(
  dto: RdBridgeUpdateReq,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(RD_BRIDGE_UPDATE_URL, dto, config);
}

// ── Liquidity-Pool 写操作（5 个：save/edit/reauthorize/transferOut/generateWallet）──

/** 新增流动性池（keystorePassword 提交前由调用方 AES 加密）。 */
export function saveLiquidityPool(
  dto: LiquidityPoolSaveReq,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(LP_NEW_URL, dto, config);
}

/**
 * 编辑流动性池（剔除 tokenId；keystorePassword 未改则原样传，否则调用方 AES 加密）。
 */
export function editLiquidityPool(
  dto: LiquidityPoolEditReq,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(LP_EDIT_URL, dto, config);
}

/**
 * 流动性池重新授权（reauthorize，传 liquidityPoolId + deductibleAmount）。
 */
export function reauthorizeLiquidityPool(
  dto: LiquidityPoolReauthorizeReq,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(LP_REAUTHORIZE_URL, dto, config);
}

/**
 * 流动性池转出（transferOut，传 amount + receiverWalletAddress + keystorePassword(加密)）。
 */
export function transferOutLiquidityPool(
  dto: LiquidityPoolTransferOutReq,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(LP_TRANSFER_OUT_URL, dto, config);
}

/**
 * 生成钱包（wallet/keystore，来自 common.ts）。
 * chainType：blockName==='Aptos'?'aptos':'evm'，password 提交前由调用方 AES 加密。
 * 返回 keystore + walletAddress 回填表单。
 */
export async function generateWalletKeystore(
  dto: WalletKeystoreReq,
  config?: ApiRequestConfig,
): Promise<WalletKeystoreData | undefined> {
  const data = await apiClient.post<WalletKeystoreData | null>(
    WALLET_KEYSTORE_URL,
    dto,
    config,
  );
  return data ?? undefined;
}

// ── Token-Pair 写操作（3 个：save/edit/update）──

/**
 * 新增代币对（send/receive 全字段，crossChainFee 小数位校验）。
 */
export function saveTokenPair(
  dto: TokenPairSaveReq,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(TOKEN_PAIR_SAVE_URL, dto, config);
}

/**
 * 编辑代币对（编辑态仅 crossChainFee 可改）。
 */
export function editTokenPair(
  dto: TokenPairEditReq,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(TOKEN_PAIR_EDIT_URL, dto, config);
}

/**
 * 更新代币对状态（启用 status:35 / 禁用 status:50，与列表显示 1/3/5/10 不同语义）。
 */
export function updateTokenPair(
  dto: TokenPairUpdateReq,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(TOKEN_PAIR_UPDATE_URL, dto, config);
}

// ── 动态拼接 URL（3 个：getReceiveToken / getEndpointId / getLiquidityPool）──
// 模板字符串尾部斜杠后拼动态 id，GET。脚本静态扫描只抓到带尾斜杠片段，需补全拼接规则。

/**
 * 按 stablecoinId(tokenId) 拉目标链可选代币列表（动态 URL）。
 *
 * token-pair/edit 核心联动：sendToken 切换时触发，含竞态保护（latestSendTokenIdRef）。
 * 成功后自动选中 receiveToken[0] 填充 receive 全字段。
 *
 * @param tokenId - sendToken 的 stablecoinId
 */
export function getReceiveToken(
  tokenId: number | string,
  config?: ApiRequestConfig,
): Promise<ReceiveTokenOption[]> {
  return apiClient.get<ReceiveTokenOption[]>(
    `/api/manage/v1/crossChain/tokenPair/getReceiveToken/${tokenId}`,
    config,
  );
}

/**
 * 按 blockchainId 拉 endpointId（动态 URL，GET）。
 *
 * 源码 cross-chain.ts 封装存在但 token-pair/edit 当前未 import，预留。
 */
export function getEndpointId(
  blockchainId: number | string,
  config?: ApiRequestConfig,
): Promise<EndpointIdOption[]> {
  return apiClient.get<EndpointIdOption[]>(
    `/api/manage/v1/crossChain/tokenPair/getEndpointId/${blockchainId}`,
    config,
  );
}

/**
 * 按 tokenId 拉流动性池（动态 URL，GET）。
 *
 * 源码 cross-chain.ts 封装存在但 token-pair/edit 当前未 import，预留。
 */
export function getLiquidityPool(
  tokenId: number | string,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.get(
    `/api/manage/v1/crossChain/tokenPair/getLiquidityPool/${tokenId}`,
    config,
  );
}

// ======================================================================
// 4. 公共下拉数据源（含 getSendToken / getTokenList / getEmailList / getBlockChainList）
// ======================================================================

/**
 * 货币对下拉（fx-rate 列表用，currency/pair/list，fx 域前缀）。
 * 返回 { rateId, sendCurrencySymbol, receiveCurrencySymbol }。
 */
export function getCurrencyPairList(
  config?: ApiRequestConfig,
): Promise<CurrencyPairOption[]> {
  return apiClient.get<CurrencyPairOption[]>(FX_CURRENCY_PAIR_LIST_URL, config);
}

/**
 * 区块链下拉（cct / lp 用，common/blockchain/list）。
 * { key, value, status }，status===1 可选否则 disabled。
 */
export function getCommonBlockchainList(
  config?: ApiRequestConfig,
): Promise<BlockchainOption[]> {
  return apiClient.post<BlockchainOption[]>(
    COMMON_BLOCKCHAIN_LIST_URL,
    {},
    config,
  );
}

/**
 * 区块链启用列表下拉（token-pair 用，common/blockchain/enableList）。
 * { key, value }（仅启用链，无 status 字段）。与 common/blockchain/list 不同接口。
 */
export function getCommonBlockchainEnableList(
  config?: ApiRequestConfig,
): Promise<BlockchainEnableOption[]> {
  return apiClient.post<BlockchainEnableOption[]>(
    COMMON_BLOCKCHAIN_ENABLE_LIST_URL,
    {},
    config,
  );
}

/**
 * 稳定币 / Token 下拉（cct / lp / tp 用，common/stablecoin/enabled/searches）。
 * { stablecoinId, name }。
 */
export function getStablecoinSearches(
  config?: ApiRequestConfig,
): Promise<TokenOption[]> {
  return apiClient.post<TokenOption[]>(
    COMMON_STABLECOIN_SEARCHES_URL,
    {},
    config,
  );
}

/**
 * RD-Bridge 链下拉（cross/chain/getBlockChainList，与 common/blockchain/list 不同）。
 * { blockChainId, blockChainName, unit }。新增态默认选首项设 symbol。
 */
export function getRdBridgeBlockchainList(
  config?: ApiRequestConfig,
): Promise<RdBridgeBlockchainOption[]> {
  return apiClient.post<RdBridgeBlockchainOption[]>(
    RD_BRIDGE_BLOCKCHAIN_LIST_URL,
    {},
    config,
  );
}

/**
 * RD-Bridge 全员邮箱列表（cross/chain/getAllUserEmailList）。
 * 「使用全员邮箱」勾选时拉取并填 notifyEmail（编辑页用）。
 */
export function getRdBridgeAllUserEmailList(
  config?: ApiRequestConfig,
): Promise<EmailOption[]> {
  return apiClient.post<EmailOption[]>(RD_BRIDGE_ALL_USER_EMAIL_URL, {}, config);
}

/**
 * 流动性池 token 下拉（liquidityPool/new/tokenList，新增态 tokenId Select）。
 * { tokenId, tokenName, symbol, decimalPrecision, blockName }。编辑态默认选中首个。
 */
export function getLiquidityPoolTokenList(
  config?: ApiRequestConfig,
): Promise<LiquidityPoolTokenOption[]> {
  return apiClient.post<LiquidityPoolTokenOption[]>(
    LP_NEW_TOKEN_LIST_URL,
    {},
    config,
  );
}

/**
 * 流动性池全员邮箱列表（liquidityPool/new/emailList）。
 *
 * 纠正源码函数名拼写错误 `getLiquidityPoolEmailListtApi`（Listt 多一个 t）。
 * endpoint 不变。「使用全员邮箱」勾选时拉取并填 emailRecipients。
 */
export function getLiquidityPoolEmailList(
  config?: ApiRequestConfig,
): Promise<EmailOption[]> {
  return apiClient.get<EmailOption[]>(LP_NEW_EMAIL_LIST_URL, config);
}

/**
 * 发送 Token 下拉（tokenPair/getSendToken，新增态 sendToken Select）。
 * 返回完整字段用于联动填充（endpointId/crossChainAddress/liquidityPoolWalletAddress 等）。
 */
export function getSendTokenList(
  config?: ApiRequestConfig,
): Promise<SendTokenOption[]> {
  return apiClient.post<SendTokenOption[]>(
    TOKEN_PAIR_SEND_TOKEN_URL,
    {},
    config,
  );
}
