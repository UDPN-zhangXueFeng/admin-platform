import { apiClient, type ApiRequestConfig } from '@myorg/shared/data-access-api';
import type {
  NormalizationBook,
  NormalizationBookListParams,
  NormalizationBookListResponse,
  NormalizationEvent,
  NormalizationEventListParams,
  NormalizationEventListResponse,
  NormalizationHistoryItem,
  NormalizationHistoryListParams,
  NormalizationHistoryListResponse,
  NormalizationPreview,
  NormalizationPreviewReq,
  ResultPageInfo,
  SaveNormalizationEventDTO,
  SourceFieldsParams,
  TableFieldInfo,
} from './tx-event-config.model';

/**
 * Transaction Event Configuration API。
 *
 * 所有 endpoint base：`/api/finance/v1/finance/normalization/`（已从 td-manage
 * `typings/token-finance/V1.ts` 确认）。`apiClient` 自动解包 `{ code, message, data }`
 * 信封并在 `code !== 0` 时抛错，因此各函数返回值即信封内的 `data`。列表 / 详情响应在
 * 返回前注入字符串 `id` 以满足 DataTable `{ id: string }` 契约。
 */
const BASE = '/api/finance/v1/finance/normalization';
const BOOKS_URL = `${BASE}/books`;
const MAPPING_RULES_URL = `${BASE}/mapping-rules`;
const DETAIL_URL = `${BASE}/detail`;
const PREVIEW_URL = `${BASE}/preview`;
const SOURCE_FIELDS_URL = `${BASE}/source-fields`;
const UPDATE_URL = `${BASE}/update`;
const HISTORY_LIST_URL = `${BASE}/history/list`;

/** 后端原始行（无 `id`）。仅用于在 API 层完成 `id` 注入，不对外暴露。 */
type BookApi = Omit<NormalizationBook, 'id'>;
type EventApi = Omit<NormalizationEvent, 'id'>;
type HistoryApi = Omit<NormalizationHistoryItem, 'id'>;

/** 列表响应原始结构（rows 无 `id`）。 */
interface ListResponseApi<TRow> {
  page?: ResultPageInfo;
  rows?: TRow[];
}

/**
 * 查询标准化账本列表（books，服务端分页）。
 * 请求体：`{ data: filters, page: { pageNum, pageSize } }`。
 */
export async function getNormalizationBooks(
  params: NormalizationBookListParams,
  config?: ApiRequestConfig
): Promise<NormalizationBookListResponse> {
  const response = await apiClient.post<ListResponseApi<BookApi>>(
    BOOKS_URL,
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config
  );

  return {
    page: response.page,
    rows: (response.rows ?? []).map((row): NormalizationBook => ({
      ...row,
      id: String(row.financeBookId ?? ''),
    })),
  };
}

/**
 * 查询 Mapping Rule 列表（mapping-rules/{financeBookId}，按账套维度分页）。
 * 请求体：`DataTableVoid`（`{ data: {}, page }`），financeBookId 走 path param。
 */
export async function getNormalizationMappingRules(
  params: NormalizationEventListParams,
  config?: ApiRequestConfig
): Promise<NormalizationEventListResponse> {
  const response = await apiClient.post<ListResponseApi<EventApi>>(
    `${MAPPING_RULES_URL}/${params.financeBookId}`,
    {
      data: {},
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config
  );

  return {
    page: response.page,
    rows: (response.rows ?? []).map((row): NormalizationEvent => ({
      ...row,
      id: String(row.normalizationEventId ?? ''),
    })),
  };
}

/** 查询标准化事件详情（detail/{normalizationEventId}，含映射明细）。 */
export async function getNormalizationDetail(
  normalizationEventId: number | string,
  config?: ApiRequestConfig
): Promise<NormalizationEvent> {
  const row = await apiClient.get<EventApi>(
    `${DETAIL_URL}/${normalizationEventId}`,
    config
  );
  return { ...row, id: String(row.normalizationEventId ?? normalizationEventId) };
}

/** 预览标准化规则（preview，POST 直传 body）。 */
export function previewNormalization(
  req: NormalizationPreviewReq,
  config?: ApiRequestConfig
): Promise<NormalizationPreview> {
  return apiClient.post<NormalizationPreview>(PREVIEW_URL, req, config);
}

/** 查询源字段下拉（source-fields，GET query param）。 */
export function getSourceFields(
  params: SourceFieldsParams,
  config?: ApiRequestConfig
): Promise<TableFieldInfo[]> {
  return apiClient.get<TableFieldInfo[]>(
    `${SOURCE_FIELDS_URL}?eventType=${params.eventType}&normalizationEventId=${params.normalizationEventId}`,
    config
  );
}

/** 更新标准化事件（update，POST 直传 NormalizationEventUpdateReqVo body）。 */
export async function updateNormalizationEvent(
  dto: SaveNormalizationEventDTO,
  config?: ApiRequestConfig
): Promise<NormalizationEvent> {
  const row = await apiClient.post<EventApi>(UPDATE_URL, dto, config);
  return { ...row, id: String(row.normalizationEventId ?? dto.normalizationEventId) };
}

/**
 * 查询历史记录（history/list，Historical Records tab，服务端分页）。
 * 请求体：`{ data: filters, page }`。
 */
export async function getNormalizationHistoryList(
  params: NormalizationHistoryListParams,
  config?: ApiRequestConfig
): Promise<NormalizationHistoryListResponse> {
  const response = await apiClient.post<ListResponseApi<HistoryApi>>(
    HISTORY_LIST_URL,
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config
  );

  return {
    page: response.page,
    rows: (response.rows ?? []).map((row): NormalizationHistoryItem => ({
      ...row,
      id: String(row.recordId ?? ''),
    })),
  };
}
