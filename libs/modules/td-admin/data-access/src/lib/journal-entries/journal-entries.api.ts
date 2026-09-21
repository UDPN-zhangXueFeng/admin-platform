import { apiClient, type ApiRequestConfig } from '@myorg/shared/data-access-api';
import type {
  BillRule,
  BillRuleDetail,
  BillRuleListParams,
  BillRuleListResponse,
  BillSubject,
  BillTokenOption,
  BillTxItem,
  BillTxListParams,
  BillTxListResponse,
  BlockchainOption,
  CurrencyOption,
  ExportBillTxReq,
  InterestTxType,
  OperateBillRuleDTO,
  SaveBillRuleDTO,
  SaveSubjectDTO,
  StablecoinSearchOption,
} from './journal-entries.model';

/**
 * Journal Entries (旧版 Bill Rule) API。
 *
 * endpoint base `/api/manage/v1/`（源自 td-manage index/edit/view，已确认）。
 * `apiClient` 自动解包 `{ code, message, data }` 信封。列表行注入 id 满足 DataTable 契约。
 */
const RULE_LIST_URL = '/api/manage/v1/financial/bill/rule/listPage';
const RULE_OPERATE_URL = '/api/manage/v1/financial/bill/operate';
const RULE_DETAIL_URL = '/api/manage/v1/financial/bill/rule/detail';
const RULE_ADD_URL = '/api/manage/v1/financial/bill/rule/add';
const RULE_EDIT_URL = '/api/manage/v1/financial/bill/rule/edit';
const RULE_SUBJECT_LIST_URL = '/api/manage/v1/financial/bill/rule/add/subjectList';
const RULE_SUBJECT_SAVE_URL =
  '/api/manage/v1/financial/bill/rule/add/subject/save';
const RULE_TOKEN_LIST_URL = '/api/manage/v1/financial/bill/rule/add/tokenList';
const INTEREST_TX_TYPE_URL = '/api/manage/v1/financial/bill/query/interest/tx/type';
const BILL_OTX_LIST_URL = '/api/manage/v1/financial/bill/otx/list';
const BILL_TX_TYPE_URL = '/api/manage/v1/financial/bill/tx/type';
const EXPORT_TASK_URL = '/api/manage/v1/export/task/create';
const STABLECOIN_SEARCHES_URL =
  '/api/manage/v1/common/stablecoin/enabled/searches';
const BLOCKCHAIN_LIST_URL = '/api/manage/v1/common/blockchain/list';
const CURRENCY_LIST_URL = '/api/manage/v1/common/currency/list';

type BillRuleApi = Omit<BillRule, 'id'>;
type BillTxApi = Omit<BillTxItem, 'id'>;
interface ListResponseApi<TRow> {
  page?: BillRuleListResponse['page'];
  rows?: TRow[];
}

/** 规则列表（listPage，服务端分页）。 */
export async function getBillRuleList(
  params: BillRuleListParams,
  config?: ApiRequestConfig,
): Promise<BillRuleListResponse> {
  const res = await apiClient.post<ListResponseApi<BillRuleApi>>(
    RULE_LIST_URL,
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map((r): BillRule => ({
      ...r,
      id: String(r.ruleId ?? ''),
    })),
  };
}

/** 启用/禁用规则（operate，state 0/1）。 */
export function operateBillRule(
  dto: OperateBillRuleDTO,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(RULE_OPERATE_URL, dto, config);
}

/** 规则详情（detail，body { ruleId }）。 */
export async function getBillRuleDetail(
  ruleId: number | string,
  config?: ApiRequestConfig,
): Promise<BillRuleDetail | undefined> {
  const data = await apiClient.post<BillRuleDetail | null>(
    RULE_DETAIL_URL,
    { ruleId: Number(ruleId) },
    config,
  );
  return data ?? undefined;
}

/** 新增规则（add）。 */
export function addBillRule(
  dto: SaveBillRuleDTO,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(RULE_ADD_URL, dto, config);
}

/** 编辑规则（edit）。 */
export function editBillRule(
  dto: SaveBillRuleDTO,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(RULE_EDIT_URL, dto, config);
}

/** 科目下拉（add/subjectList，body { stablecoinId }）。 */
export function getBillSubjectList(
  stablecoinId: number | string,
  config?: ApiRequestConfig,
): Promise<BillSubject[]> {
  return apiClient.post<BillSubject[]>(
    RULE_SUBJECT_LIST_URL,
    { stablecoinId: Number(stablecoinId) },
    config,
  );
}

/** 保存新科目（add/subject/save）。 */
export function saveBillSubject(
  dto: SaveSubjectDTO,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(RULE_SUBJECT_SAVE_URL, dto, config);
}

/** token 下拉（add/tokenList，GET）。 */
export function getBillTokenList(
  config?: ApiRequestConfig,
): Promise<BillTokenOption[]> {
  return apiClient.get<BillTokenOption[]>(RULE_TOKEN_LIST_URL, config);
}

/** 利息交易类型（interest/tx/type，body { stablecoinId }）。 */
export function getInterestTxType(
  stablecoinId: number | string,
  config?: ApiRequestConfig,
): Promise<InterestTxType[]> {
  return apiClient.post<InterestTxType[]>(
    INTEREST_TX_TYPE_URL,
    { stablecoinId: Number(stablecoinId) },
    config,
  );
}

/** 账本交易列表（bill/otx/list，view 页）。 */
export async function getBillTxList(
  params: BillTxListParams,
  config?: ApiRequestConfig,
): Promise<BillTxListResponse> {
  const res = await apiClient.post<ListResponseApi<BillTxApi>>(
    BILL_OTX_LIST_URL,
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map((r): BillTxItem => ({
      ...r,
      id: String(r.txHash ?? `${r.subjectCode}-${r.loanType}`),
    })),
  };
}

/** txType 下拉（bill/tx/type，view 页，body { stablecoinId }）。 */
export function getBillTxType(
  stablecoinId: number | string,
  config?: ApiRequestConfig,
): Promise<InterestTxType[]> {
  return apiClient.post<InterestTxType[]>(
    BILL_TX_TYPE_URL,
    { stablecoinId: Number(stablecoinId) },
    config,
  );
}

/** 导出账本交易（export/task/create，moduleType=1）。 */
export function createBillExportTask(
  req: ExportBillTxReq,
  config?: ApiRequestConfig,
): Promise<unknown> {
  return apiClient.post(EXPORT_TASK_URL, req, config);
}

/** Stablecoin 下拉。 */
export function getStablecoinSearches(
  config?: ApiRequestConfig,
): Promise<StablecoinSearchOption[]> {
  return apiClient.get<StablecoinSearchOption[]>(
    STABLECOIN_SEARCHES_URL,
    config,
  );
}

/** 区块链下拉。 */
export function getBlockchainList(
  config?: ApiRequestConfig,
): Promise<BlockchainOption[]> {
  return apiClient.get<BlockchainOption[]>(BLOCKCHAIN_LIST_URL, config);
}

/** 货币下拉。 */
export function getCurrencyList(
  config?: ApiRequestConfig,
): Promise<CurrencyOption[]> {
  return apiClient.get<CurrencyOption[]>(CURRENCY_LIST_URL, config);
}
