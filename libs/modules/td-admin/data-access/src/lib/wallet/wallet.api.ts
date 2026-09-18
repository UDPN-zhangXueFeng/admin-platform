import { apiClient } from '@myorg/shared/data-access-api';
import type { WalletListPage, WalletListParams, WalletRow } from './wallet.model';
import type {
  AccountTypeOption,
  AccrualRecord,
  AuthRecord,
  AvailableWalletType,
  BalanceCalcResult,
  BlockchainOption,
  ChangeWalletTypePayload,
  DistributeRecord,
  DividendRow,
  DividendSummary,
  EarningsCalcResult,
  EarningsSendPayload,
  FundsOperatePayload,
  InterestPolicy,
  KeystorePayload,
  KeystoreResult,
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
  WalletOperatePayload,
  WalletTypeCard,
  WalletTypeDetail,
  WalletTypeSavePayload,
  WalletTypeTableRow,
  DailyYieldRow,
} from './wallet.model';

/**
 * Wallet 模块 API。base = `NEXT_PUBLIC_API_BASE_URL`（apiClient 自动解包 `{code,message,data}`
 * 信封并在 code !== 0 时抛错）。源路径 `/api/manage/v1/...` 原样保留（与 sp-access、
 * journal 共用 common 端点一致）。迁移自 td-manage `src/lib/api/{wallet-type,wallet-state,
 * user-wallet-stable,common}.ts` + 各页内联 useSWR。
 */

// ── URL 常量 ──────────────────────────────────────────────────────────────────

const STABLECOIN_SEARCHES_URL = '/api/manage/v1/common/stablecoin/enabled/searches';
const BLOCKCHAIN_LIST_URL = '/api/manage/v1/common/blockchain/list';
const TOKEN_TYPE_LIST_URL = '/api/manage/v1/common/tokenType/list';
const KEYSTORE_URL = '/api/manage/v1/util/wallet/keystore';

const OW_LIST_URL = '/api/manage/v1/operational/wallet/list';
const OW_DETAILS_URL = '/api/manage/v1/operational/wallet/details';
const OW_TX_LIST_URL = '/api/manage/v1/operational/wallet/txList';
const OW_OP_RECORD_URL = '/api/manage/v1/operational/wallet/operatingRecord';

const UW_LIST_URL = '/api/manage/v1/user/wallet/list';
const UW_DETAILS_URL = '/api/manage/v1/user/wallet/details';
const UW_TX_LIST_URL = '/api/manage/v1/user/wallet/txList';
const UW_OP_RECORD_URL = '/api/manage/v1/user/wallet/operatingRecord';
const UW_ACCRUAL_URL = '/api/manage/v1/user/wallet/accrualRecords';
const UW_DISTRIBUTE_URL = '/api/manage/v1/user/wallet/distributeRecords';
const UW_AUTH_RECORD_URL = '/api/manage/v1/user/wallet/authorizationRecord';
const UW_AUTHORIZED_RECORD_URL = '/api/manage/v1/user/wallet/authorizedRecord';
const UW_AVAILABLE_TYPE_URL = '/api/manage/v1/user/wallet/getAvailableWalletTypeList';
const UW_FUNDS_OPERATE_URL = '/api/manage/v1/user/wallet/funds/operate';
const UW_OPERATE_URL = '/api/manage/v1/user/wallet/operate';
const UW_CHANGE_TYPE_URL = '/api/manage/v1/user/wallet/changeWalletType';

const WT_HEAD_LIST_URL = '/api/manage/v1/wallet/type/head/list';
const WT_LIST_URL = '/api/manage/v1/wallet/type/list';
const WT_UPDATE_STATUS_URL = '/api/manage/v1/wallet/type/update/status';
const WT_BALANCE_CALC_URL = '/api/manage/v1/wallet/type/wallet/balance/calculate';
const WT_EARNINGS_CALC_URL = '/api/manage/v1/wallet/type/earnings/calculate';
const WT_EARNINGS_SEND_URL = '/api/manage/v1/wallet/type/earnings/send';
const WT_HEAD_DETAILS_URL = '/api/manage/v1/wallet/type/head/details';
const WT_ACCOUNT_TYPE_LIST_URL = '/api/manage/v1/wallet/type/accountTypeList';
const WT_INTEREST_POLICY_URL = '/api/manage/v1/wallet/type/interestPolicy';
const WT_ADD_URL = '/api/manage/v1/wallet/type/add';
const WT_UPDATE_URL = '/api/manage/v1/wallet/type/update';
const WT_ADD_MMF_URL = '/api/manage/v1/wallet/type/add/mmf';
const WT_UPDATE_MMF_URL = '/api/manage/v1/wallet/type/update/mmf';
const WT_ACCUMULATED_EARNINGS_URL = '/api/manage/v1/wallet/type/accumulatedEarnings';
const WT_DIVIDEND_SUMMARY_URL = '/api/manage/v1/wallet/type/dividend/records/summary';
const WT_DAILY_YIELD_LIST_URL = '/api/manage/v1/wallet/type/dailyYieldList';
const WT_DIVIDEND_LIST_URL = '/api/manage/v1/wallet/type/dividend/records/list';

// ── 列表请求/响应内部类型 ───────────────────────────────────────────────────────

interface ListApi<R> {
  page?: WalletListPage;
  rows?: R[];
}

interface WalletListResponseApi<R extends WalletRow> {
  page?: WalletListPage;
  rows: R[];
}

/**
 * POST 列表通用包装：构造 `{ data: filters, page }` 请求体，返回前为每行注入字符串 `id`。
 * `idSelector` 按业务键组合出稳定唯一 id（journal 模式）。
 */
async function postList<R extends WalletRow, F>(
  url: string,
  params: WalletListParams<F>,
  idSelector: (row: Omit<R, 'id'>) => string
): Promise<WalletListResponseApi<R>> {
  const response = await apiClient.post<ListApi<Omit<R, 'id'>>>(url, {
    data: params.filters,
    page: { pageNum: params.pageNum, pageSize: params.pageSize },
  });
  return {
    page: response.page,
    rows: (response.rows ?? []).map((row): R => ({ ...row, id: idSelector(row) } as R)),
  };
}

/** POST 列表（额外 initial values，如 ruleWalletId / walletId 透传到 data）。 */
async function postListWithData<R extends WalletRow>(
  url: string,
  data: Record<string, unknown>,
  page: { pageNum: number; pageSize: number },
  idSelector: (row: Omit<R, 'id'>) => string
): Promise<WalletListResponseApi<R>> {
  const response = await apiClient.post<ListApi<Omit<R, 'id'>>>(url, {
    data,
    page: { pageNum: page.pageNum, pageSize: page.pageSize },
  });
  return {
    page: response.page,
    rows: (response.rows ?? []).map((row): R => ({ ...row, id: idSelector(row) } as R)),
  };
}

// ── common ────────────────────────────────────────────────────────────────────

export function getStablecoinSearches(): Promise<StablecoinSearchOption[]> {
  return apiClient.get<StablecoinSearchOption[]>(STABLECOIN_SEARCHES_URL);
}

export function getBlockchainList(): Promise<BlockchainOption[]> {
  return apiClient.get<BlockchainOption[]>(BLOCKCHAIN_LIST_URL);
}

export function getTokenTypeList(): Promise<TokenTypeOption[]> {
  return apiClient.get<TokenTypeOption[]>(TOKEN_TYPE_LIST_URL);
}

export function generateKeystore(
  payload: KeystorePayload
): Promise<KeystoreResult> {
  return apiClient.post<KeystoreResult>(KEYSTORE_URL, payload);
}

// ── operational-wallet ────────────────────────────────────────────────────────

export function getOperationalWalletList(
  params: WalletListParams<OperationalWalletFilters>
): Promise<WalletListResponseApi<OperationalWallet>> {
  return postList<OperationalWallet, OperationalWalletFilters>(
    OW_LIST_URL,
    params,
    (row) => String(row.ruleWalletId ?? row.ruleId ?? Math.random())
  );
}

export function getOperationalWalletDetails(
  ruleWalletId: number
): Promise<OperationalWalletDetail> {
  return apiClient.post<OperationalWalletDetail>(OW_DETAILS_URL, { ruleWalletId });
}

export function getOperationalTxList(
  ruleWalletId: number,
  page: { pageNum: number; pageSize: number }
): Promise<WalletListResponseApi<OperationalTx>> {
  return postListWithData<OperationalTx>(
    OW_TX_LIST_URL,
    { ruleWalletId },
    page,
    (row) => String(row.txHash ?? Math.random())
  );
}

export function getOperationalOpRecordList(
  data: { ruleWalletId: number; walletAddress?: string },
  page: { pageNum: number; pageSize: number }
): Promise<WalletListResponseApi<OperationalOpRecord>> {
  return postListWithData<OperationalOpRecord>(
    OW_OP_RECORD_URL,
    data as unknown as Record<string, unknown>,
    page,
    (row) => String(row.taskId ?? row.txHash ?? Math.random())
  );
}

// ── user-wallet ───────────────────────────────────────────────────────────────

export function getUserWalletList(
  params: WalletListParams<UserWalletFilters>
): Promise<WalletListResponseApi<UserWallet>> {
  return postList<UserWallet, UserWalletFilters>(UW_LIST_URL, params, (row) =>
    String(row.walletId ?? Math.random())
  );
}

export function getUserWalletDetails(
  walletId: number
): Promise<UserWalletDetail> {
  return apiClient.post<UserWalletDetail>(UW_DETAILS_URL, { walletId });
}

export function getUserTxList(
  walletId: number,
  page: { pageNum: number; pageSize: number }
): Promise<WalletListResponseApi<UserTx>> {
  return postListWithData<UserTx>(
    UW_TX_LIST_URL,
    { walletId },
    page,
    (row) => String(row.txHash ?? Math.random())
  );
}

export function getUserOpRecordList(
  walletId: number,
  page: { pageNum: number; pageSize: number }
): Promise<WalletListResponseApi<UserOpRecord>> {
  return postListWithData<UserOpRecord>(
    UW_OP_RECORD_URL,
    { walletId },
    page,
    (row) => String(row.taskId ?? row.txHash ?? Math.random())
  );
}

export function getUserAccrualRecords(
  walletId: number,
  page: { pageNum: number; pageSize: number }
): Promise<WalletListResponseApi<AccrualRecord>> {
  return postListWithData<AccrualRecord>(
    UW_ACCRUAL_URL,
    { walletId },
    page,
    (row) => String(row.accrualTime ?? Math.random())
  );
}

export function getUserDistributeRecords(
  walletId: number,
  page: { pageNum: number; pageSize: number }
): Promise<WalletListResponseApi<DistributeRecord>> {
  return postListWithData<DistributeRecord>(
    UW_DISTRIBUTE_URL,
    { walletId },
    page,
    (row) => String(row.txHash ?? row.payableOn ?? Math.random())
  );
}

export function getUserAuthorizationRecords(
  walletId: number,
  page: { pageNum: number; pageSize: number }
): Promise<WalletListResponseApi<AuthRecord>> {
  return postListWithData<AuthRecord>(
    UW_AUTH_RECORD_URL,
    { walletId },
    page,
    (row) => String(row.authId ?? row.txHash ?? Math.random())
  );
}

export function getUserAuthorizedRecords(
  walletId: number,
  page: { pageNum: number; pageSize: number }
): Promise<WalletListResponseApi<AuthRecord>> {
  return postListWithData<AuthRecord>(
    UW_AUTHORIZED_RECORD_URL,
    { walletId },
    page,
    (row) => String(row.authId ?? row.txHash ?? Math.random())
  );
}

export function getAvailableWalletTypeList(
  walletId: number
): Promise<AvailableWalletType[]> {
  return apiClient.post<AvailableWalletType[]>(UW_AVAILABLE_TYPE_URL, { walletId });
}

export function fundsOperate(payload: FundsOperatePayload): Promise<unknown> {
  return apiClient.post(UW_FUNDS_OPERATE_URL, payload);
}

export function walletOperate(payload: WalletOperatePayload): Promise<unknown> {
  return apiClient.post(UW_OPERATE_URL, payload);
}

export function changeWalletType(
  payload: ChangeWalletTypePayload
): Promise<unknown> {
  return apiClient.post(UW_CHANGE_TYPE_URL, payload);
}

// ── wallet-type ───────────────────────────────────────────────────────────────

/** 卡片网格（head/list）。返回扁平数组（源未分页）。 */
export function getWalletTypeCardList(
  stablecoinId: number
): Promise<WalletTypeCard[]> {
  return apiClient.post<WalletTypeCard[]>(WT_HEAD_LIST_URL, { stablecoinId });
}

/** 两张表（list，分页）。 */
export function getWalletTypeTableList(
  stablecoinId: number,
  page: { pageNum: number; pageSize: number }
): Promise<WalletListResponseApi<WalletTypeTableRow>> {
  return postListWithData<WalletTypeTableRow>(
    WT_LIST_URL,
    { stablecoinId },
    page,
    (row) => String(row.recordId ?? Math.random())
  );
}

export function updateWalletTypeState(
  payload: UpdateWalletTypeStatePayload
): Promise<unknown> {
  return apiClient.post(WT_UPDATE_STATUS_URL, payload);
}

export function getWalletBalanceCalculate(input: {
  ruleId: number;
  earningsDate: number | string;
}): Promise<BalanceCalcResult> {
  return apiClient.post<BalanceCalcResult>(WT_BALANCE_CALC_URL, input);
}

export function earningsCalculate(input: {
  ruleId: number;
  earningsDate: number | string;
  totalEarnings: string | number;
}): Promise<EarningsCalcResult> {
  return apiClient.post<EarningsCalcResult>(WT_EARNINGS_CALC_URL, input);
}

export function earningsSend(payload: EarningsSendPayload): Promise<unknown> {
  return apiClient.post(WT_EARNINGS_SEND_URL, payload);
}

export function getWalletTypeDetails(ruleId: number): Promise<WalletTypeDetail> {
  return apiClient.post<WalletTypeDetail>(WT_HEAD_DETAILS_URL, { ruleId });
}

export function getAccountTypeList(
  stablecoinId: number
): Promise<AccountTypeOption[]> {
  return apiClient.get<AccountTypeOption[]>(WT_ACCOUNT_TYPE_LIST_URL, {
    params: { stablecoinId },
  });
}

export function getInterestPolicy(input: {
  accountType: number;
  interestType?: number;
  calculateType?: number;
}): Promise<InterestPolicy[]> {
  return apiClient.post<InterestPolicy[]>(WT_INTEREST_POLICY_URL, input);
}

export function addWalletType(payload: WalletTypeSavePayload): Promise<unknown> {
  return apiClient.post(WT_ADD_URL, payload);
}

export function updateWalletType(
  payload: WalletTypeSavePayload
): Promise<unknown> {
  return apiClient.post(WT_UPDATE_URL, payload);
}

export function addMmfWalletType(
  payload: MmfWalletTypeSavePayload
): Promise<unknown> {
  return apiClient.post(WT_ADD_MMF_URL, payload);
}

export function updateMmfWalletType(
  payload: MmfWalletTypeSavePayload
): Promise<unknown> {
  return apiClient.post(WT_UPDATE_MMF_URL, payload);
}

export function getAccumulatedEarnings(ruleId: number): Promise<string | number> {
  return apiClient.post<string | number>(WT_ACCUMULATED_EARNINGS_URL, { ruleId });
}

export function getDividendRecordsSummary(
  billCode: string
): Promise<DividendSummary> {
  return apiClient.post<DividendSummary>(WT_DIVIDEND_SUMMARY_URL, { billCode });
}

export function getDailyYieldList(
  ruleId: number,
  page: { pageNum: number; pageSize: number }
): Promise<WalletListResponseApi<DailyYieldRow>> {
  return postListWithData<DailyYieldRow>(
    WT_DAILY_YIELD_LIST_URL,
    { ruleId },
    page,
    (row) => String(row.billCode ?? Math.random())
  );
}

export function getDividendRecordsList(
  billCode: string,
  page: { pageNum: number; pageSize: number }
): Promise<WalletListResponseApi<DividendRow>> {
  return postListWithData<DividendRow>(
    WT_DIVIDEND_LIST_URL,
    { billCode },
    page,
    (row) => String(row.txHash ?? Math.random())
  );
}
