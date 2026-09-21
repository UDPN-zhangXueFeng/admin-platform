'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getAdminWalletList,
  getApplyList,
  getBlockchainOptions,
  getContractDeployHistory,
  getContractDetailList,
  getContractPackageList,
  getCurrencyOptions,
  getDeployStepDetail,
  getFinanceBookByReserve,
  getFinanceTemplateList,
  getKeyServiceList,
  getMMFSummaryList,
  getOperationRecordList,
  getReserveBalance,
  getReserveList,
  getRoleWalletDetail,
  getRoleWalletsList,
  getSPRecordList,
  getSmartContractOptions,
  getStablecoinInfo,
  getStablecoinList,
  getStablecoinRecordList,
  getTDOperationEditDetail,
  getTDRecordList,
  getTimezoneOptions,
  getTokenTypeOptions,
  getWalletBalanceList,
  getWalletDetailList,
  getWalletHistoryList,
  getWalletList,
  hasPendingMelt,
} from '../tokenized-deposit.api';
import type {
  AdminWalletListItem,
  ApplyListItem,
  BlockchainOption,
  ContractDetailListParams,
  ContractDetailListResponse,
  ContractPackageListParams,
  ContractPackageListResponse,
  CurrencyOption,
  DeployHistoryItem,
  DeployStepDetail,
  DeployStepDetailParams,
  FinanceBookInfo,
  FinanceTemplateOption,
  KeyServiceOption,
  MMFSummaryListParams,
  MMFSummaryListResponse,
  OperationRecordListParams,
  OperationRecordListResponse,
  ReserveAccountOption,
  ReserveBalance,
  ReserveBalanceParams,
  RoleWalletItem,
  RoleWalletListParams,
  RoleWalletListResponse,
  SmartContractOption,
  SPRecordListParams,
  SPRecordListResponse,
  StablecoinInfo,
  StablecoinRecordListParams,
  TDRecordListParams,
  TDRecordListResponse,
  TDEditDetail,
  TimezoneOption,
  TokenTypeOption,
  WalletDetailListResponse,
  WalletDetailParams,
  WalletListParams,
  WalletListResponse,
} from '../tokenized-deposit.model';
import { tdKeys } from './tokenized-deposit.keys';

/**
 * Tokenized-Deposit TanStack Query hooks（只读查询）。
 *
 * 对齐 cross-chain / blockchain 模块模式：
 * - 列表查询用 `placeholderData: keepPreviousData` 避免翻页闪白。
 * - 详情/标题用 `enabled` 守卫，标识为空时不发起请求。
 * - 下拉用 `staleTime: 5 分钟` 减少重复请求 + `select` 过滤非数组/null 项。
 * - 子表分页列表（合约包/合约明细/操作记录/MMF 汇总）同样走列表模式：
 *   pageNum/pageSize 请求体 + keepPreviousData。
 *
 * ## customTable2 双 URL（钱包表）
 *
 * 钱包列表有 2 个 endpoint：`useWalletQuery`（listPage）与
 * `useWalletBalanceQuery`（balance）。调用方按 `isOnclick` 标志切换 hook
 * （index Tab3 刷新按钮触发 isOnclick=true 走 balance）。
 * 两者 params 类型相同（WalletListParams），但 endpoint 不同，故分两个 hook。
 */

/**
 * 过滤下拉数据：后端可能返回非数组或含 null 项，统一在 query 层过滤。
 *
 * 用于 select 回调：`select: (data) => filterDropdown<BlockchainOption>(data)`。
 */
const filterDropdown = <T>(data: T[] | null | undefined): T[] =>
  Array.isArray(data) ? data.filter((o): o is T => o != null) : [];

// ======================================================================
// 1. 列表查询（keepPreviousData，翻页不闪白）
// ======================================================================

/**
 * TD 铸销记录列表查询（index Tab5 质押铸造分支）。
 * initialValues: stablecoinCode。rowKey: recordId。
 */
export function useTDRecordQuery(params: TDRecordListParams) {
  return useQuery<TDRecordListResponse>({
    queryKey: tdKeys.overviewTDRecordList(params),
    queryFn: ({ signal }) => getTDRecordList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/**
 * SP 直铸记录列表查询（index Tab5 SP 分支）。
 * initialValues: stablecoinId。rowKey: orderNumber。
 */
export function useSPRecordQuery(params: SPRecordListParams) {
  return useQuery<SPRecordListResponse>({
    queryKey: tdKeys.viewSPRecordList(params),
    queryFn: ({ signal }) => getSPRecordList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/**
 * 钱包列表查询（listPage，默认场景，isOnclick=false）。
 * 刷新按钮触发的 balance 场景请用 {@link useWalletBalanceQuery}。
 * rowKey: accountId。
 */
export function useWalletQuery(params: WalletListParams) {
  return useQuery<WalletListResponse>({
    queryKey: tdKeys.walletList(params),
    queryFn: ({ signal }) => getWalletList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/**
 * 钱包余额列表查询（balance，index Tab3 刷新按钮触发 isOnclick=true 场景）。
 * 与 {@link useWalletQuery} 同响应结构，仅 endpoint 不同。
 * 调用方按 isOnclick 在两个 hook 间切换，缓存不会污染（分 key）。
 */
export function useWalletBalanceQuery(params: WalletListParams) {
  return useQuery<WalletListResponse>({
    queryKey: tdKeys.walletBalanceList(params),
    queryFn: ({ signal }) => getWalletBalanceList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/**
 * 钱包详情列表查询（管理钱包 Modal - Details 态）。
 * body: stablecoinId / accountType。rowKey: recordId。
 */
export function useWalletDetailListQuery(params: WalletDetailParams) {
  return useQuery<WalletDetailListResponse>({
    queryKey: tdKeys.walletDetailList(params),
    queryFn: ({ signal }) => getWalletDetailList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/**
 * 钱包历史列表查询（管理钱包 Modal - History 态）。
 * body: stablecoinId / accountType。rowKey: recordId。
 */
export function useWalletHistoryListQuery(params: WalletDetailParams) {
  return useQuery<WalletDetailListResponse>({
    queryKey: tdKeys.walletHistoryList(params),
    queryFn: ({ signal }) => getWalletHistoryList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/**
 * 操作记录列表查询（index Tab4）。
 * initialValues: stablecoinCode。rowKey: recordId。
 */
export function useOperationRecordQuery(params: OperationRecordListParams) {
  return useQuery<OperationRecordListResponse>({
    queryKey: tdKeys.operationRecordList(params),
    queryFn: ({ signal }) => getOperationRecordList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/**
 * MMF 基金汇总列表查询（index Tab1 MMF 分支，summary 组件）。
 * initialValues: tokenCode。rowKey: walletTypeCode。
 */
export function useMMFSummaryQuery(params: MMFSummaryListParams) {
  return useQuery<MMFSummaryListResponse>({
    queryKey: tdKeys.summaryMMFSummaryList(params),
    queryFn: ({ signal }) => getMMFSummaryList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/**
 * 稳定币铸销记录列表查询（view 页 Tab1）。
 * initialValues: txHash。
 */
export function useStablecoinRecordQuery(params: StablecoinRecordListParams) {
  return useQuery({
    queryKey: tdKeys.viewStablecoinRecordList(params),
    queryFn: ({ signal }) => getStablecoinRecordList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

// ======================================================================
// 2. 详情 / 标题查询（enabled 守卫，标识为空不发请求）
// ======================================================================

/**
 * TD 标题列表查询（index 顶部 CustomTab 切换 + 概览数据源）。
 * 响应 data 直接为数组（无 page/rows 包裹），无 params。始终发起。
 */
export function useApplyListQuery() {
  return useQuery<ApplyListItem[]>({
    queryKey: tdKeys.overviewApplyList(),
    queryFn: ({ signal }) => getApplyList({ signal }),
  });
}

/**
 * 稳定币列表查询（view 页 mount 拉，取 [0]）。
 * 字段形态由调用方按业务断言，返回 unknown[]。始终发起。
 */
export function useStablecoinListQuery() {
  return useQuery({
    queryKey: tdKeys.viewStablecoinList(),
    queryFn: ({ signal }) => getStablecoinList(undefined, { signal }),
  });
}

/**
 * 稳定币信息查询（view 页，surplusCount 可销毁余额）。
 * stablecoinId 缺失时不发起。
 */
export function useStablecoinInfoQuery(
  stablecoinId: number | string | undefined,
  enabled = true,
) {
  return useQuery<StablecoinInfo>({
    queryKey: tdKeys.viewStablecoinInfo(stablecoinId),
    queryFn: ({ signal }) =>
      getStablecoinInfo({ stablecoinId }, { signal }),
    enabled: stablecoinId != null && stablecoinId !== '' && enabled,
  });
}

/**
 * 合约包列表查询（index Tab2 上表，已部署合约概览）。
 * body: stablecoinCode。rowKey: packageName。
 */
export function useContractPackageQuery(params: ContractPackageListParams) {
  return useQuery<ContractPackageListResponse>({
    queryKey: tdKeys.overviewContractPackageList(params),
    queryFn: ({ signal }) => getContractPackageList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/**
 * 合约明细列表查询（index Tab2 下表）。
 * body: stablecoinCode。rowKey: contractName。
 */
export function useContractDetailQuery(params: ContractDetailListParams) {
  return useQuery<ContractDetailListResponse>({
    queryKey: tdKeys.overviewContractDetailList(params),
    queryFn: ({ signal }) => getContractDetailList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/**
 * 部署历史查询（index 部署历史 Modal）。
 * 接口返回 data[0]，空结果规范为 null。stablecoinCode 缺失时不发起。
 */
export function useContractDeployHistoryQuery(
  stablecoinCode: number | string | undefined,
  enabled = true,
) {
  return useQuery<DeployHistoryItem | null>({
    queryKey: tdKeys.overviewContractDeployHistory(String(stablecoinCode ?? '')),
    queryFn: ({ signal }) =>
      getContractDeployHistory(stablecoinCode as string, { signal }),
    enabled: stablecoinCode != null && stablecoinCode !== '' && enabled,
  });
}

/**
 * 部署步骤详情查询（index 部署 Modal，body taskCode）。
 * 空结果规范为 null；taskCode 缺失时不发起。
 */
export function useDeployStepDetailQuery(
  params: DeployStepDetailParams | undefined,
  enabled = true,
) {
  return useQuery<DeployStepDetail | null>({
    queryKey: tdKeys.overviewDeployStepDetail(
      params ?? { taskCode: '' },
    ),
    queryFn: ({ signal }) =>
      getDeployStepDetail(params as DeployStepDetailParams, { signal }),
    enabled:
      enabled && params != null && params.taskCode != null && params.taskCode !== '',
  });
}

/**
 * 储备 / 可销毁余额查询（Mint/Melt 前拉，组装 modalInfo）。
 * stablecoinCode/symbol 均缺失时不发起。
 */
export function useReserveBalanceQuery(
  params: ReserveBalanceParams | undefined,
  enabled = true,
) {
  return useQuery<ReserveBalance>({
    queryKey: tdKeys.overviewReserveBalance(
      params ?? { stablecoinCode: '', symbol: '' },
    ),
    queryFn: ({ signal }) =>
      getReserveBalance(params as ReserveBalanceParams, { signal }),
    enabled:
      enabled &&
      params != null &&
      ((params.stablecoinCode != null && params.stablecoinCode !== '') ||
        (params.symbol != null && params.symbol !== '')),
  });
}

/**
 * 是否有待处理销毁查询（控制 Melt 按钮禁用）。
 * stablecoinCode 缺失时不发起。
 */
export function useHasPendingMeltQuery(
  stablecoinCode: number | string | undefined,
  enabled = true,
) {
  return useQuery<boolean>({
    queryKey: tdKeys.overviewPendingMelt(String(stablecoinCode ?? '')),
    queryFn: ({ signal }) =>
      hasPendingMelt({ stablecoinCode: String(stablecoinCode) }, { signal }),
    enabled: stablecoinCode != null && stablecoinCode !== '' && enabled,
  });
}

// ======================================================================
// 3. 编辑页子查询（enabled 守卫，标识为空不发请求）
// ======================================================================

/**
 * 编辑详情回填查询（动态 URL GET，body code）。
 * code 缺失时不发起。字段命名转换（decimalPrecision→decimals 等）由调用方处理。
 */
export function useTDOperationEditDetailQuery(
  code: number | string | undefined,
  enabled = true,
) {
  return useQuery<TDEditDetail>({
    queryKey: tdKeys.editOperationDetail(code),
    queryFn: ({ signal }) => getTDOperationEditDetail(code as string, { signal }),
    enabled: code != null && code !== '' && enabled,
  });
}

/**
 * 密钥服务下拉查询（edit 页，body blockchainId，默认选首项 keyServiceCode）。
 * blockchainId 缺失时不发起。
 */
export function useKeyServiceListQuery(
  blockchainId: number | string | undefined,
  enabled = true,
) {
  return useQuery<KeyServiceOption[]>({
    queryKey: tdKeys.editKeyServiceList({
      blockchainId: String(blockchainId ?? ''),
    }),
    queryFn: ({ signal }) =>
      getKeyServiceList({ blockchainId: String(blockchainId) }, { signal }),
    enabled: blockchainId != null && blockchainId !== '' && enabled,
    select: filterDropdown<KeyServiceOption>,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 管理员钱包列表查询（edit 页自动拉取，仅 Ethereum Sepolia + Huawei KMS 场景）。
 * body: blockchainId。注入 id。blockchainId 缺失时不发起。
 */
export function useAdminWalletListQuery(
  blockchainId: number | string | undefined,
  enabled = true,
) {
  return useQuery<AdminWalletListItem[]>({
    queryKey: tdKeys.editAdminWalletList({
      blockchainId: String(blockchainId ?? ''),
    }),
    queryFn: ({ signal }) =>
      getAdminWalletList({ blockchainId: String(blockchainId) }, { signal }),
    enabled: blockchainId != null && blockchainId !== '' && enabled,
  });
}

/**
 * 科目模板下拉查询（COA 设置用，GET query tokenType）。
 * tokenType: 1=Stablecoin / 5=TD。tokenType 缺失时不发起。
 */
export function useFinanceTemplateQuery(
  tokenType: number | undefined,
  enabled = true,
) {
  return useQuery<FinanceTemplateOption[]>({
    queryKey: tdKeys.editFinanceTemplateList({ tokenType }),
    queryFn: ({ signal }) =>
      getFinanceTemplateList({ tokenType: tokenType as number }, { signal }),
    enabled: tokenType != null && enabled,
    select: filterDropdown<FinanceTemplateOption>,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Financial Book 查询（按 reserveAccountId 动态 URL GET）。
 * 用于 stablecoin COA configured 态只读回填。reserveAccountId 缺失时不发起。
 */
export function useFinanceBookByReserveQuery(
  reserveAccountId: number | string | undefined,
  enabled = true,
) {
  return useQuery<FinanceBookInfo | null>({
    queryKey: tdKeys.editFinanceBookByReserve({
      reserveAccountId: reserveAccountId ?? '',
    }),
    queryFn: ({ signal }) =>
      getFinanceBookByReserve(reserveAccountId as number | string, { signal }),
    enabled: reserveAccountId != null && reserveAccountId !== '' && enabled,
  });
}

/**
 * 储备账户下拉查询（edit 页，body currencySymbol，默认选首项）。
 * currencySymbol 缺失时不发起。
 */
export function useReserveListQuery(
  currencySymbol: string | undefined,
  enabled = true,
) {
  return useQuery<ReserveAccountOption[]>({
    queryKey: tdKeys.editReserveList({ currencySymbol: currencySymbol ?? '' }),
    queryFn: ({ signal }) =>
      getReserveList({ currencySymbol: currencySymbol as string }, { signal }),
    enabled: currencySymbol != null && currencySymbol !== '' && enabled,
    select: filterDropdown<ReserveAccountOption>,
    staleTime: 5 * 60 * 1000,
  });
}

// ======================================================================
// 4. 公共下拉查询（select filterDropdown 防 null，staleTime 5 分钟）
// ======================================================================

/**
 * 区块链下拉（edit 页 useSWR，GET，{ key, value, status }）。
 * status===1 可选否则 disabled。staleTime 5 分钟。
 */
export function useBlockchainOptionsQuery() {
  return useQuery<BlockchainOption[]>({
    queryKey: tdKeys.commonBlockchainDropdown(),
    queryFn: ({ signal }) => getBlockchainOptions(undefined, { signal }),
    select: filterDropdown<BlockchainOption>,
    staleTime: 5 * 60 * 1000,
  });
}

/** 币种下拉（edit 页 useSWR，GET，{ key, value }）。staleTime 5 分钟。 */
export function useCurrencyOptionsQuery() {
  return useQuery<CurrencyOption[]>({
    queryKey: tdKeys.commonCurrencyDropdown(),
    queryFn: ({ signal }) => getCurrencyOptions({ signal }),
    select: filterDropdown<CurrencyOption>,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Token 类型下拉（useTokenTypeOptions hook，GET）。
 * status===0 时 disabled。staleTime 5 分钟。
 */
export function useTokenTypeOptionsQuery() {
  return useQuery<TokenTypeOption[]>({
    queryKey: tdKeys.commonTokenTypeDropdown(),
    queryFn: ({ signal }) => getTokenTypeOptions({ signal }),
    select: filterDropdown<TokenTypeOption>,
    staleTime: 5 * 60 * 1000,
  });
}

/** 时区下拉（COA 设置用，GET）。staleTime 5 分钟。 */
export function useTimezoneOptionsQuery() {
  return useQuery<TimezoneOption[]>({
    queryKey: tdKeys.commonTimezoneDropdown(),
    queryFn: ({ signal }) => getTimezoneOptions({ signal }),
    select: filterDropdown<TimezoneOption>,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 智能合约包下拉（edit 页 smartContractPackageId Select，POST，body contractLanguage/tokenType）。
 * staleTime 5 分钟。params 变化（contractLanguage/tokenType 联动）重新查询。
 */
export function useSmartContractOptionsQuery(
  params: {
    contractLanguage?: string;
    tokenType?: number;
    [key: string]: unknown;
  },
) {
  return useQuery<SmartContractOption[]>({
    queryKey: tdKeys.commonSmartContractDropdown(params),
    queryFn: ({ signal }) => getSmartContractOptions(params, { signal }),
    select: filterDropdown<SmartContractOption>,
    staleTime: 5 * 60 * 1000,
  });
}

// ======================================================================
// 5. role-wallet（mock，后端未实装，保留 mock）
// ======================================================================

/**
 * 角色钱包列表查询（mock，body pageNum/pageSize/tokenId/roleName/walletAddress）。
 * setTimeout 300ms 模拟网络延迟。
 */
export function useRoleWalletsListQuery(params: RoleWalletListParams) {
  return useQuery<RoleWalletListResponse>({
    queryKey: tdKeys.roleWalletList(params),
    queryFn: () => getRoleWalletsList(params),
    placeholderData: keepPreviousData,
  });
}

/**
 * 角色钱包详情查询（mock，含 operations 操作历史）。
 * roleWalletId 缺失时不发起。
 */
export function useRoleWalletDetailQuery(
  roleWalletId: number | string | undefined,
  enabled = true,
) {
  return useQuery<RoleWalletItem | null>({
    queryKey: tdKeys.roleWalletDetail(roleWalletId),
    queryFn: () => getRoleWalletDetail(roleWalletId as string),
    enabled: roleWalletId != null && roleWalletId !== '' && enabled,
  });
}
