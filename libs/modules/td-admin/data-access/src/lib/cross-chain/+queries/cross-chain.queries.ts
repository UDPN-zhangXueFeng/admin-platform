'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getCommonBlockchainEnableList,
  getCommonBlockchainList,
  getCrossChainTxDetail,
  getCrossChainTxList,
  getCrossChainTxTreeDetails,
  getCurrencyPairList,
  getFxRateDetailList,
  getFxRateList,
  getLiquidityPoolAuthorization,
  getLiquidityPoolBasicInfo,
  getLiquidityPoolDetails,
  getLiquidityPoolEmailList,
  getLiquidityPoolList,
  getLiquidityPoolOpRecords,
  getLiquidityPoolTokenList,
  getLiquidityPoolTransactions,
  getRdBridgeAllUserEmailList,
  getRdBridgeBlockchainList,
  getRdBridgeDetail,
  getRdBridgeList,
  getRdBridgeRecordDetail,
  getRdBridgeRecordList,
  getSendTokenList,
  getStablecoinSearches,
  getTokenPairDetail,
  getTokenPairList,
  getTokenPairOperationRecords,
} from '../cross-chain.api';
import type {
  BlockchainEnableOption,
  BlockchainOption,
  CrossChainTxDetail,
  CrossChainTxListParams,
  CrossChainTxListResponse,
  CurrencyPairOption,
  FxRateDetailParams,
  FxRateDetailResponse,
  FxRateListParams,
  FxRateListResponse,
  LiquidityPoolAuthListResponse,
  LiquidityPoolBasicInfo,
  LiquidityPoolEditDetail,
  LiquidityPoolListParams,
  LiquidityPoolListResponse,
  LiquidityPoolOpRecordListResponse,
  LiquidityPoolTokenOption,
  LiquidityPoolTxListResponse,
  RdBridgeBlockchainOption,
  RdBridgeDetail,
  RdBridgeListParams,
  RdBridgeListResponse,
  RdBridgeRecordDetail,
  RdBridgeRecordListResponse,
  SendTokenOption,
  TokenOption,
  TokenPairDetail,
  TokenPairListParams,
  TokenPairListResponse,
  TokenPairRecordListResponse,
  TransactionTreeNode,
} from '../cross-chain.model';
import { crossChainKeys } from './cross-chain.keys';

/**
 * Cross-Chain TanStack Query hooks（只读查询）。
 *
 * 对齐 blockchain 模块模式：
 * - 列表查询用 `placeholderData: keepPreviousData` 避免翻页闪白。
 * - 详情/树用 `enabled` 守卫，id 为空时不发起请求。
 * - 下拉用 `staleTime: 5 分钟` 减少重复请求 + `select` 过滤非数组/null。
 * - 子表分页列表（liquidity-pool/rd-bridge/token-pair 详情 Tab 内嵌列表）
 *   同样走列表模式：pageNum/pageSize 请求体 + keepPreviousData。
 */

/** 过滤下拉数据：后端可能返回非数组或含 null 项，统一在 query 层过滤。 */
function filterDropdown<T>(data: unknown): T[] {
  return Array.isArray(data) ? data.filter((o): o is T => o != null) : [];
}

// ======================================================================
// 1. cross-chain-transactions（跨链交易记录）
// ======================================================================

/** 跨链交易列表查询。 */
export function useCrossChainTxListQuery(params: CrossChainTxListParams) {
  return useQuery<CrossChainTxListResponse>({
    queryKey: crossChainKeys.crossChainTxList(params),
    queryFn: ({ signal }) => getCrossChainTxList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** 跨链交易详情查询。transferId 缺失时不发起。 */
export function useCrossChainTxDetailQuery(
  transferId: number | string | undefined,
  enabled = true,
) {
  return useQuery<CrossChainTxDetail | undefined>({
    queryKey: crossChainKeys.crossChainTxDetail(transferId ?? ''),
    queryFn: ({ signal }) =>
      getCrossChainTxDetail(transferId as number | string, { signal }),
    enabled: transferId != null && transferId !== '' && enabled,
  });
}

/** 跨链交易 Steps 时间线节点查询。transferId 缺失时不发起。 */
export function useCrossChainTxTreeQuery(
  transferId: number | string | undefined,
  enabled = true,
) {
  return useQuery<TransactionTreeNode[]>({
    queryKey: crossChainKeys.crossChainTxTree(transferId ?? ''),
    queryFn: ({ signal }) =>
      getCrossChainTxTreeDetails(transferId as number | string, { signal }),
    enabled: transferId != null && transferId !== '' && enabled,
  });
}

// ======================================================================
// 2. fx-rate（汇率）
// ======================================================================

/** 汇率列表查询。 */
export function useFxRateListQuery(params: FxRateListParams) {
  return useQuery<FxRateListResponse>({
    queryKey: crossChainKeys.fxRateList(params),
    queryFn: ({ signal }) => getFxRateList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/**
 * 汇率详情页历史汇率分页列表查询（非 Descriptions，用 DataTable 呈现）。
 *
 * fx-rate 详情页特殊：用列表接口呈现历史汇率，initialValues 带 rateId。
 * rateId 缺失时不发起。
 */
export function useFxRateDetailListQuery(
  params: FxRateDetailParams | undefined,
  enabled = true,
) {
  return useQuery<FxRateDetailResponse>({
    queryKey: crossChainKeys.fxRateDetailList(params as FxRateDetailParams),
    queryFn: ({ signal }) =>
      getFxRateDetailList(params as FxRateDetailParams, { signal }),
    // rateId 为 number 类型；params 缺失或 rateId 非法（NaN）时不发起。
    enabled:
      enabled && params != null && params.rateId != null && !Number.isNaN(params.rateId),
    placeholderData: keepPreviousData,
  });
}

// ======================================================================
// 3. liquidity-pool（流动性池）
// ======================================================================

/** 流动性池列表查询。 */
export function useLiquidityPoolListQuery(params: LiquidityPoolListParams) {
  return useQuery<LiquidityPoolListResponse>({
    queryKey: crossChainKeys.liquidityPoolList(params),
    queryFn: ({ signal }) => getLiquidityPoolList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** 流动性池基本信息查询（详情页 Tab1）。liquidityPoolId 缺失时不发起。 */
export function useLiquidityPoolBasicInfoQuery(
  liquidityPoolId: number | string | undefined,
  enabled = true,
) {
  return useQuery<LiquidityPoolBasicInfo | undefined>({
    queryKey: crossChainKeys.liquidityPoolBasicInfo(liquidityPoolId ?? ''),
    queryFn: ({ signal }) =>
      getLiquidityPoolBasicInfo(liquidityPoolId as number | string, { signal }),
    enabled: liquidityPoolId != null && liquidityPoolId !== '' && enabled,
  });
}

/** 流动性池完整详情查询（编辑页回填用）。liquidityPoolId 缺失时不发起。 */
export function useLiquidityPoolDetailsQuery(
  liquidityPoolId: number | string | undefined,
  enabled = true,
) {
  return useQuery<LiquidityPoolEditDetail | undefined>({
    queryKey: crossChainKeys.liquidityPoolDetails(liquidityPoolId ?? ''),
    queryFn: ({ signal }) =>
      getLiquidityPoolDetails(liquidityPoolId as number | string, { signal }),
    enabled: liquidityPoolId != null && liquidityPoolId !== '' && enabled,
  });
}

/**
 * 流动性池详情 - transactions 子表分页列表查询。
 *
 * 详情页 Tab2：transactionType===3 显示 N/A、type===2 绿色否则红色。
 * liquidityPoolId 缺失时不发起。
 */
export function useLiquidityPoolTransactionsQuery(
  params: {
    liquidityPoolId: number | string;
    pageNum: number;
    pageSize: number;
    [key: string]: unknown;
  } | undefined,
  enabled = true,
) {
  return useQuery<LiquidityPoolTxListResponse>({
    queryKey: crossChainKeys.liquidityPoolTransactions(
      params ?? { liquidityPoolId: '', pageNum: 1, pageSize: 10 },
    ),
    queryFn: ({ signal }) =>
      getLiquidityPoolTransactions(params as Parameters<typeof getLiquidityPoolTransactions>[0], { signal }),
    enabled:
      enabled &&
      params != null &&
      params.liquidityPoolId != null &&
      params.liquidityPoolId !== '',
    placeholderData: keepPreviousData,
  });
}

/**
 * 流动性池详情 - authorization 子表分页列表查询。
 *
 * 详情页 Tab3：状态色 LIQUIDITY_POOL_TX_STATUS_COLOR，i18n key 保留 ststus 拼写。
 * liquidityPoolId 缺失时不发起。
 */
export function useLiquidityPoolAuthorizationQuery(
  params: {
    liquidityPoolId: number | string;
    pageNum: number;
    pageSize: number;
    [key: string]: unknown;
  } | undefined,
  enabled = true,
) {
  return useQuery<LiquidityPoolAuthListResponse>({
    queryKey: crossChainKeys.liquidityPoolAuthorization(
      params ?? { liquidityPoolId: '', pageNum: 1, pageSize: 10 },
    ),
    queryFn: ({ signal }) =>
      getLiquidityPoolAuthorization(params as Parameters<typeof getLiquidityPoolAuthorization>[0], { signal }),
    enabled:
      enabled &&
      params != null &&
      params.liquidityPoolId != null &&
      params.liquidityPoolId !== '',
    placeholderData: keepPreviousData,
  });
}

/**
 * 流动性池详情 - operationRecords 子表分页列表查询。
 *
 * 详情页 Tab4：行「查看」跳 /approval-manage/view。
 * liquidityPoolId 缺失时不发起。
 */
export function useLiquidityPoolOpRecordsQuery(
  params: {
    liquidityPoolId: number | string;
    pageNum: number;
    pageSize: number;
    [key: string]: unknown;
  } | undefined,
  enabled = true,
) {
  return useQuery<LiquidityPoolOpRecordListResponse>({
    queryKey: crossChainKeys.liquidityPoolOpRecords(
      params ?? { liquidityPoolId: '', pageNum: 1, pageSize: 10 },
    ),
    queryFn: ({ signal }) =>
      getLiquidityPoolOpRecords(params as Parameters<typeof getLiquidityPoolOpRecords>[0], { signal }),
    enabled:
      enabled &&
      params != null &&
      params.liquidityPoolId != null &&
      params.liquidityPoolId !== '',
    placeholderData: keepPreviousData,
  });
}

// ======================================================================
// 4. rd-bridge（RD-Bridge 跨链桥配置）
// ======================================================================

/** RD-Bridge 列表查询。 */
export function useRdBridgeListQuery(params: RdBridgeListParams) {
  return useQuery<RdBridgeListResponse>({
    queryKey: crossChainKeys.rdBridgeList(params),
    queryFn: ({ signal }) => getRdBridgeList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** RD-Bridge 详情查询（详情页 + 编辑页回填共用）。crossChainId 缺失时不发起。 */
export function useRdBridgeDetailQuery(
  crossChainId: number | string | undefined,
  enabled = true,
) {
  return useQuery<RdBridgeDetail | undefined>({
    queryKey: crossChainKeys.rdBridgeDetail(crossChainId ?? ''),
    queryFn: ({ signal }) =>
      getRdBridgeDetail(crossChainId as number | string, { signal }),
    enabled: crossChainId != null && crossChainId !== '' && enabled,
  });
}

/**
 * RD-Bridge 详情 - 操作记录子表分页列表查询。
 *
 * 详情页 Tab2：行「查看」→ getCrossChainRecordDetail → Drawer。
 * crossChainId 缺失时不发起。
 */
export function useRdBridgeRecordListQuery(
  params: {
    crossChainId: number | string;
    pageNum: number;
    pageSize: number;
    [key: string]: unknown;
  } | undefined,
  enabled = true,
) {
  return useQuery<RdBridgeRecordListResponse>({
    queryKey: crossChainKeys.rdBridgeRecordList(
      params ?? { crossChainId: '', pageNum: 1, pageSize: 10 },
    ),
    queryFn: ({ signal }) =>
      getRdBridgeRecordList(params as Parameters<typeof getRdBridgeRecordList>[0], { signal }),
    enabled:
      enabled &&
      params != null &&
      params.crossChainId != null &&
      params.crossChainId !== '',
    placeholderData: keepPreviousData,
  });
}

/**
 * RD-Bridge 操作记录 Drawer 详情查询。
 *
 * 详情页 Tab2 操作记录行「查看」→ Drawer（CustomInformation 四组信息）。
 * crossChainRecordId 缺失时不发起。
 */
export function useRdBridgeRecordDetailQuery(
  crossChainRecordId: number | string | undefined,
  enabled = true,
) {
  return useQuery<RdBridgeRecordDetail | undefined>({
    queryKey: crossChainKeys.rdBridgeRecordDetail(crossChainRecordId ?? ''),
    queryFn: ({ signal }) =>
      getRdBridgeRecordDetail(crossChainRecordId as number | string, { signal }),
    enabled: crossChainRecordId != null && crossChainRecordId !== '' && enabled,
  });
}

// ======================================================================
// 5. token-pair（代币对）
// ======================================================================

/** 代币对列表查询。 */
export function useTokenPairListQuery(params: TokenPairListParams) {
  return useQuery<TokenPairListResponse>({
    queryKey: crossChainKeys.tokenPairList(params),
    queryFn: ({ signal }) => getTokenPairList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** 代币对详情查询（详情页 + 编辑页回填共用）。tokenCrossChainId 缺失时不发起。 */
export function useTokenPairDetailQuery(
  tokenCrossChainId: number | string | undefined,
  enabled = true,
) {
  return useQuery<TokenPairDetail | undefined>({
    queryKey: crossChainKeys.tokenPairDetail(tokenCrossChainId ?? ''),
    queryFn: ({ signal }) =>
      getTokenPairDetail(tokenCrossChainId as number | string, { signal }),
    enabled: tokenCrossChainId != null && tokenCrossChainId !== '' && enabled,
  });
}

/**
 * 代币对详情 - 操作记录子表分页列表查询。
 *
 * 详情页 Tab2：status 走 approval_task_status_color_ + common_task_status_。
 * tokenCrossChainId 缺失时不发起。
 */
export function useTokenPairOperationRecordsQuery(
  params: {
    tokenCrossChainId: number | string;
    pageNum: number;
    pageSize: number;
    [key: string]: unknown;
  } | undefined,
  enabled = true,
) {
  return useQuery<TokenPairRecordListResponse>({
    queryKey: crossChainKeys.tokenPairOperationRecords(
      params ?? { tokenCrossChainId: '', pageNum: 1, pageSize: 10 },
    ),
    queryFn: ({ signal }) =>
      getTokenPairOperationRecords(params as Parameters<typeof getTokenPairOperationRecords>[0], { signal }),
    enabled:
      enabled &&
      params != null &&
      params.tokenCrossChainId != null &&
      params.tokenCrossChainId !== '',
    placeholderData: keepPreviousData,
  });
}

// ======================================================================
// 6. 公共下拉查询（多子模块共用）
// ======================================================================

/**
 * 区块链下拉（cct / lp 用，common/blockchain/list）。
 * { key, value, status }，status===1 可选否则 disabled。
 * staleTime 5 分钟减少重复请求。
 */
export function useBlockchainListQuery() {
  return useQuery<BlockchainOption[]>({
    queryKey: crossChainKeys.commonBlockchainDropdown(),
    queryFn: ({ signal }) => getCommonBlockchainList({ signal }),
    select: filterDropdown<BlockchainOption>,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 区块链启用列表下拉（token-pair 用，common/blockchain/enableList）。
 * { key, value }，仅启用链，无 status 字段。
 * staleTime 5 分钟。
 */
export function useBlockchainEnableListQuery() {
  return useQuery<BlockchainEnableOption[]>({
    queryKey: crossChainKeys.commonBlockchainEnableDropdown(),
    queryFn: ({ signal }) => getCommonBlockchainEnableList({ signal }),
    select: filterDropdown<BlockchainEnableOption>,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 稳定币 / Token 下拉（cct / lp / tp 用，common/stablecoin/enabled/searches）。
 * { stablecoinId, name }。
 * staleTime 5 分钟。
 */
export function useStablecoinSearchesQuery() {
  return useQuery<TokenOption[]>({
    queryKey: crossChainKeys.stablecoinDropdown(),
    queryFn: ({ signal }) => getStablecoinSearches({ signal }),
    select: filterDropdown<TokenOption>,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * RD-Bridge 链下拉（cross/chain/getBlockChainList，与 common/blockchain/list 不同）。
 * { blockChainId, blockChainName, unit }。
 * staleTime 5 分钟。
 */
export function useRdBridgeBlockchainListQuery() {
  return useQuery<RdBridgeBlockchainOption[]>({
    queryKey: crossChainKeys.rdBridgeBlockchainDropdown(),
    queryFn: ({ signal }) => getRdBridgeBlockchainList({ signal }),
    select: filterDropdown<RdBridgeBlockchainOption>,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * RD-Bridge 全员邮箱列表下拉（cross/chain/getAllUserEmailList）。
 * staleTime 5 分钟。
 */
export function useRdBridgeAllUserEmailListQuery() {
  return useQuery<string[]>({
    queryKey: crossChainKeys.rdBridgeAllUserEmailDropdown(),
    queryFn: ({ signal }) => getRdBridgeAllUserEmailList({ signal }),
    select: filterDropdown<string>,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 流动性池 token 下拉（liquidityPool/new/tokenList）。
 * { tokenId, tokenName, symbol, decimalPrecision, blockName }。
 * staleTime 5 分钟。
 */
export function useLiquidityPoolTokenListQuery() {
  return useQuery<LiquidityPoolTokenOption[]>({
    queryKey: crossChainKeys.liquidityPoolTokenDropdown(),
    queryFn: ({ signal }) => getLiquidityPoolTokenList({ signal }),
    select: filterDropdown<LiquidityPoolTokenOption>,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 流动性池全员邮箱列表下拉（liquidityPool/new/emailList）。
 * staleTime 5 分钟。
 */
export function useLiquidityPoolEmailListQuery() {
  return useQuery<string[]>({
    queryKey: crossChainKeys.liquidityPoolEmailDropdown(),
    queryFn: ({ signal }) => getLiquidityPoolEmailList({ signal }),
    select: filterDropdown<string>,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 货币对下拉（fx-rate 列表用，fx/v1/rate/currency/pair/list）。
 * { rateId, sendCurrencySymbol, receiveCurrencySymbol }。
 * staleTime 5 分钟。
 */
export function useCurrencyPairListQuery() {
  return useQuery<CurrencyPairOption[]>({
    queryKey: crossChainKeys.currencyPairDropdown(),
    queryFn: ({ signal }) => getCurrencyPairList({ signal }),
    select: filterDropdown<CurrencyPairOption>,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 发送 Token 下拉（tokenPair/getSendToken，新增态 sendToken Select）。
 * 返回完整字段用于联动填充。
 * staleTime 5 分钟。
 */
export function useSendTokenListQuery() {
  return useQuery<SendTokenOption[]>({
    queryKey: crossChainKeys.sendTokenDropdown(),
    queryFn: ({ signal }) => getSendTokenList({ signal }),
    select: filterDropdown<SendTokenOption>,
    staleTime: 5 * 60 * 1000,
  });
}
