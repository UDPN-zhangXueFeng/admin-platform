import { apiClient, type ApiRequestConfig } from '@myorg/shared/data-access-api';
import type {
  BlockchainOption,
  JournalDetailData,
  JournalEntry,
  JournalListParams,
  JournalListResponse,
  StablecoinSearchOption,
} from './journal-entries-new.model';

const JOURNAL_LIST_URL = '/api/finance/v1/finance/journal/list';
const JOURNAL_DETAIL_URL = '/api/finance/v1/finance/journal/detail';
const STABLECOIN_SEARCHES_URL = '/api/manage/v1/common/stablecoin/enabled/searches';
const BLOCKCHAIN_LIST_URL = '/api/manage/v1/common/blockchain/list';

/** 后端原始列表行（无 `id` 字段）。仅用于在 API 层完成 `id` 注入，不对外暴露。 */
type JournalEntryApi = Omit<JournalEntry, 'id'>;

interface JournalListResponseApi {
  page?: JournalListResponse['page'];
  rows?: JournalEntryApi[];
}

/**
 * 查询 Journal 列表（服务端分页）。
 *
 * 请求体结构与源项目一致：`{ data: filters, page: { pageNum, pageSize } }`。
 * 返回前将每个原始行注入字符串 `id`（= `tdTxId`）以满足 DataTable 契约。
 * `apiClient` 已自动解包 `{ code, message, data }` 信封并在 `code !== 0` 时抛错。
 */
export async function getJournalList(
  params: JournalListParams,
  config?: ApiRequestConfig
): Promise<JournalListResponse> {
  const response = await apiClient.post<JournalListResponseApi>(
    JOURNAL_LIST_URL,
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config
  );

  return {
    page: response.page,
    rows: (response.rows ?? []).map((row): JournalEntry => ({
      ...row,
      id: String(row.tdTxId),
    })),
  };
}

/**
 * 查询单笔 Journal 详情。
 *
 * URL 路径参数为 `tdTxId`（源项目为 `string | number`），此处统一按
 * `string | number` 透传，路径模板会自动 stringify。
 */
export function getJournalDetail(
  tdTxId: number | string,
  config?: ApiRequestConfig
): Promise<JournalDetailData> {
  return apiClient.get<JournalDetailData>(
    `${JOURNAL_DETAIL_URL}/${tdTxId}`,
    config
  );
}

/** 查询启用的 stablecoin（token 名称下拉）。 */
export function getStablecoinSearches(
  config?: ApiRequestConfig
): Promise<StablecoinSearchOption[]> {
  return apiClient.get<StablecoinSearchOption[]>(
    STABLECOIN_SEARCHES_URL,
    config
  );
}

/** 查询区块链下拉。 */
export function getBlockchainList(
  config?: ApiRequestConfig
): Promise<BlockchainOption[]> {
  return apiClient.get<BlockchainOption[]>(BLOCKCHAIN_LIST_URL, config);
}
