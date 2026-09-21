'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  addMmfWalletType,
  addWalletType,
  changeWalletType,
  earningsSend,
  fundsOperate,
  generateKeystore,
  getAccountTypeList,
  getAccumulatedEarnings,
  getAvailableWalletTypeList,
  getBlockchainList,
  getDailyYieldList,
  getDividendRecordsList,
  getDividendRecordsSummary,
  getInterestPolicy,
  getOperationalOpRecordList,
  getOperationalTxList,
  getOperationalWalletDetails,
  getOperationalWalletList,
  getStablecoinSearches,
  getTokenTypeList,
  getUserAccrualRecords,
  getUserAuthorizationRecords,
  getUserAuthorizedRecords,
  getUserDistributeRecords,
  getUserOpRecordList,
  getUserTxList,
  getUserWalletDetails,
  getUserWalletList,
  getWalletTypeCardList,
  getWalletTypeDetails,
  getWalletTypeTableList,
  updateMmfWalletType,
  updateWalletType,
  updateWalletTypeState,
  walletOperate,
} from '../wallet.api';
import type {
  AccountTypeOption,
  AccrualRecord,
  AuthRecord,
  AvailableWalletType,
  BlockchainOption,
  ChangeWalletTypePayload,
  DistributeRecord,
  DividendRow,
  DividendSummary,
  EarningsSendPayload,
  FundsOperatePayload,
  InterestPolicy,
  KeystorePayload,
  MmfWalletTypeSavePayload,
  OperationalOpRecord,
  OperationalTx,
  OperationalWallet,
  OperationalWalletDetail,
  OperationalWalletFilters,
  StablecoinSearchOption,
  TokenTypeOption,
  UpdateWalletTypeStatePayload,
  UserOpRecord,
  UserTx,
  UserWallet,
  UserWalletDetail,
  UserWalletFilters,
  WalletListParams,
  WalletListResponse,
  WalletOperatePayload,
  WalletTypeCard,
  WalletTypeDetail,
  WalletTypeSavePayload,
  WalletTypeTableRow,
  DailyYieldRow,
} from '../wallet.model';
import { walletKeys } from './wallet.keys';

/** 分页请求参数（子记录列表 / 表格查询用）。 */
interface Page {
  pageNum: number;
  pageSize: number;
}

// ── common 下拉（三子模块共用，无分页） ───────────────────────────────────────

export function useStablecoinsQuery(enabled = true) {
  return useQuery<StablecoinSearchOption[]>({
    queryKey: walletKeys.stablecoins(),
    queryFn: getStablecoinSearches,
    enabled,
  });
}

export function useBlockchainsQuery(enabled = true) {
  return useQuery<BlockchainOption[]>({
    queryKey: walletKeys.blockchains(),
    queryFn: getBlockchainList,
    enabled,
  });
}

export function useTokenTypesQuery(enabled = true) {
  return useQuery<TokenTypeOption[]>({
    queryKey: walletKeys.tokenTypes(),
    queryFn: getTokenTypeList,
    enabled,
  });
}

// ── operational-wallet ────────────────────────────────────────────────────────

/** 营运钱包列表（服务端分页 + 筛选，keepPreviousData 平滑翻页）。 */
export function useOperationalWalletListQuery(
  params: WalletListParams<OperationalWalletFilters>
) {
  return useQuery<WalletListResponse<OperationalWallet>>({
    queryKey: walletKeys.operationalWallets(params),
    queryFn: () => getOperationalWalletList(params),
    placeholderData: keepPreviousData,
  });
}

/** 营运钱包详情。`ruleWalletId` 缺失时不发起请求。 */
export function useOperationalWalletDetailQuery(
  ruleWalletId: number | undefined,
  enabled = true
) {
  return useQuery<OperationalWalletDetail>({
    queryKey: walletKeys.operationalWalletDetail(ruleWalletId ?? 0),
    queryFn: () => getOperationalWalletDetails(ruleWalletId as number),
    enabled: Boolean(ruleWalletId) && enabled,
  });
}

/** 营运钱包交易记录（详情 tab，分页）。 */
export function useOperationalTxQuery(
  ruleWalletId: number | undefined,
  page: Page,
  enabled = true
) {
  return useQuery<WalletListResponse<OperationalTx>>({
    queryKey: walletKeys.operationalTx(ruleWalletId ?? 0, page),
    queryFn: () => getOperationalTxList(ruleWalletId as number, page),
    placeholderData: keepPreviousData,
    enabled: Boolean(ruleWalletId) && enabled,
  });
}

/** 营运钱包操作记录（详情 tab，分页；透传 walletAddress）。 */
export function useOperationalOpRecordQuery(
  data: { ruleWalletId: number; walletAddress?: string },
  page: Page,
  enabled = true
) {
  return useQuery<WalletListResponse<OperationalOpRecord>>({
    queryKey: walletKeys.operationalOpRecord(data.ruleWalletId, page),
    queryFn: () => getOperationalOpRecordList(data, page),
    placeholderData: keepPreviousData,
    enabled: Boolean(data.ruleWalletId) && enabled,
  });
}

// ── user-wallet ───────────────────────────────────────────────────────────────

/** 用户钱包列表（服务端分页 + 筛选，keepPreviousData）。 */
export function useUserWalletListQuery(
  params: WalletListParams<UserWalletFilters>
) {
  return useQuery<WalletListResponse<UserWallet>>({
    queryKey: walletKeys.userWallets(params),
    queryFn: () => getUserWalletList(params),
    placeholderData: keepPreviousData,
  });
}

/** 用户钱包详情。`walletId` 缺失时不发起请求。 */
export function useUserWalletDetailQuery(
  walletId: number | undefined,
  enabled = true
) {
  return useQuery<UserWalletDetail>({
    queryKey: walletKeys.userWalletDetail(walletId ?? 0),
    queryFn: () => getUserWalletDetails(walletId as number),
    enabled: Boolean(walletId) && enabled,
  });
}

export function useUserTxQuery(
  walletId: number | undefined,
  page: Page,
  enabled = true
) {
  return useQuery<WalletListResponse<UserTx>>({
    queryKey: walletKeys.userTx(walletId ?? 0, page),
    queryFn: () => getUserTxList(walletId as number, page),
    placeholderData: keepPreviousData,
    enabled: Boolean(walletId) && enabled,
  });
}

export function useUserOpRecordQuery(
  walletId: number | undefined,
  page: Page,
  enabled = true
) {
  return useQuery<WalletListResponse<UserOpRecord>>({
    queryKey: walletKeys.userOpRecord(walletId ?? 0, page),
    queryFn: () => getUserOpRecordList(walletId as number, page),
    placeholderData: keepPreviousData,
    enabled: Boolean(walletId) && enabled,
  });
}

export function useUserAccrualQuery(
  walletId: number | undefined,
  page: Page,
  enabled = true
) {
  return useQuery<WalletListResponse<AccrualRecord>>({
    queryKey: walletKeys.userAccrual(walletId ?? 0, page),
    queryFn: () => getUserAccrualRecords(walletId as number, page),
    placeholderData: keepPreviousData,
    enabled: Boolean(walletId) && enabled,
  });
}

export function useUserDistributeQuery(
  walletId: number | undefined,
  page: Page,
  enabled = true
) {
  return useQuery<WalletListResponse<DistributeRecord>>({
    queryKey: walletKeys.userDistribute(walletId ?? 0, page),
    queryFn: () => getUserDistributeRecords(walletId as number, page),
    placeholderData: keepPreviousData,
    enabled: Boolean(walletId) && enabled,
  });
}

export function useUserAuthorizationQuery(
  walletId: number | undefined,
  page: Page,
  enabled = true
) {
  return useQuery<WalletListResponse<AuthRecord>>({
    queryKey: walletKeys.userAuthorization(walletId ?? 0, page),
    queryFn: () => getUserAuthorizationRecords(walletId as number, page),
    placeholderData: keepPreviousData,
    enabled: Boolean(walletId) && enabled,
  });
}

export function useUserAuthorizedQuery(
  walletId: number | undefined,
  page: Page,
  enabled = true
) {
  return useQuery<WalletListResponse<AuthRecord>>({
    queryKey: walletKeys.userAuthorized(walletId ?? 0, page),
    queryFn: () => getUserAuthorizedRecords(walletId as number, page),
    placeholderData: keepPreviousData,
    enabled: Boolean(walletId) && enabled,
  });
}

/** 可用钱包类型（改类型弹窗，按 walletId 加载）。 */
export function useAvailableWalletTypesQuery(
  walletId: number | undefined,
  enabled = true
) {
  return useQuery<AvailableWalletType[]>({
    queryKey: walletKeys.availableWalletTypes(walletId ?? 0),
    queryFn: () => getAvailableWalletTypeList(walletId as number),
    enabled: Boolean(walletId) && enabled,
  });
}

// ── wallet-type ───────────────────────────────────────────────────────────────

/** 卡片网格（按 stablecoinId，扁平数组，源未分页）。 */
export function useWalletTypeCardsQuery(
  stablecoinId: number | undefined,
  enabled = true
) {
  return useQuery<WalletTypeCard[]>({
    queryKey: walletKeys.walletTypeCards(stablecoinId ?? 0),
    queryFn: () => getWalletTypeCardList(stablecoinId as number),
    enabled: Boolean(stablecoinId) && enabled,
  });
}

/** 两张表（按 stablecoinId 分页）。 */
export function useWalletTypeTableQuery(
  stablecoinId: number | undefined,
  page: Page,
  enabled = true
) {
  return useQuery<WalletListResponse<WalletTypeTableRow>>({
    queryKey: walletKeys.walletTypeTable(stablecoinId ?? 0, page),
    queryFn: () => getWalletTypeTableList(stablecoinId as number, page),
    placeholderData: keepPreviousData,
    enabled: Boolean(stablecoinId) && enabled,
  });
}

/** 钱包类型详情（edit/view/mff 共用）。`ruleId` 缺失时不发起请求。 */
export function useWalletTypeDetailQuery(
  ruleId: number | undefined,
  enabled = true
) {
  return useQuery<WalletTypeDetail>({
    queryKey: walletKeys.walletTypeDetail(ruleId ?? 0),
    queryFn: () => getWalletTypeDetails(ruleId as number),
    enabled: Boolean(ruleId) && enabled,
  });
}

/** 账户类型下拉（编辑页按 stablecoinId 加载）。 */
export function useAccountTypesQuery(
  stablecoinId: number | undefined,
  enabled = true
) {
  return useQuery<AccountTypeOption[]>({
    queryKey: walletKeys.accountTypes(stablecoinId ?? 0),
    queryFn: () => getAccountTypeList(stablecoinId as number),
    enabled: Boolean(stablecoinId) && enabled,
  });
}

/** 利息策略（编辑页选 accountType 后加载，命令式也可直接调 api）。 */
export function useInterestPolicyQuery(
  input: { accountType: number; interestType?: number; calculateType?: number },
  enabled = true
) {
  return useQuery<InterestPolicy[]>({
    queryKey: walletKeys.interestPolicy(input),
    queryFn: () => getInterestPolicy(input),
    enabled: Boolean(input.accountType) && enabled,
  });
}

/** 累计收益（mff-view）。 */
export function useAccumulatedEarningsQuery(
  ruleId: number | undefined,
  enabled = true
) {
  return useQuery<string | number>({
    queryKey: walletKeys.accumulatedEarnings(ruleId ?? 0),
    queryFn: () => getAccumulatedEarnings(ruleId as number),
    enabled: Boolean(ruleId) && enabled,
  });
}

/** 股息汇总（mff-view 抽屉）。 */
export function useDividendSummaryQuery(
  billCode: string | undefined,
  enabled = true
) {
  return useQuery<DividendSummary>({
    queryKey: walletKeys.dividendSummary(billCode ?? ''),
    queryFn: () => getDividendRecordsSummary(billCode as string),
    enabled: Boolean(billCode) && enabled,
  });
}

/** 每日收益表（mff-view，分页）。 */
export function useDailyYieldQuery(
  ruleId: number | undefined,
  page: Page,
  enabled = true
) {
  return useQuery<WalletListResponse<DailyYieldRow>>({
    queryKey: walletKeys.dailyYield(ruleId ?? 0, page),
    queryFn: () => getDailyYieldList(ruleId as number, page),
    placeholderData: keepPreviousData,
    enabled: Boolean(ruleId) && enabled,
  });
}

/** 股息明细表（mff-view 抽屉，分页）。 */
export function useDividendRecordsQuery(
  billCode: string | undefined,
  page: Page,
  enabled = true
) {
  return useQuery<WalletListResponse<DividendRow>>({
    queryKey: walletKeys.dividendRecords(billCode ?? '', page),
    queryFn: () => getDividendRecordsList(billCode as string, page),
    placeholderData: keepPreviousData,
    enabled: Boolean(billCode) && enabled,
  });
}

// ── mutation（写操作，成功后失效相关缓存） ────────────────────────────────────

/** 启用/禁用钱包类型。影响卡片网格 + 两张表。 */
export function useUpdateWalletTypeStateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateWalletTypeStatePayload) =>
      updateWalletTypeState(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
    },
  });
}

/** 冻结/解冻资金（user-wallet，type 6|7）。 */
export function useFundsOperateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: FundsOperatePayload) => fundsOperate(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
    },
  });
}

/** 冻结/解冻钱包（user-wallet，type 2|3）。 */
export function useWalletOperateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WalletOperatePayload) => walletOperate(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
    },
  });
}

/** 改钱包类型（user-wallet）。 */
export function useChangeWalletTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ChangeWalletTypePayload) => changeWalletType(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
    },
  });
}

/** 派发收益（wallet-type 收益弹窗第三段）。影响累计收益 + 两张表。 */
export function useEarningsSendMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EarningsSendPayload) => earningsSend(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
    },
  });
}

/** 新增常规钱包类型。 */
export function useAddWalletTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WalletTypeSavePayload) => addWalletType(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
    },
  });
}

/** 编辑常规钱包类型。 */
export function useUpdateWalletTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WalletTypeSavePayload) => updateWalletType(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
    },
  });
}

/** 新增 MMF 钱包类型。 */
export function useAddMmfWalletTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MmfWalletTypeSavePayload) => addMmfWalletType(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
    },
  });
}

/** 编辑 MMF 钱包类型。 */
export function useUpdateMmfWalletTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MmfWalletTypeSavePayload) =>
      updateMmfWalletType(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
    },
  });
}

/** 生成钱包 keystore（mff-add，回填 address/keystore/password）。结果直接用，不失效缓存。 */
export function useGenerateKeystoreMutation() {
  return useMutation({
    mutationFn: (payload: KeystorePayload) => generateKeystore(payload),
  });
}
