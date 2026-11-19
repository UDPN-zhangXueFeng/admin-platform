import { apiClient, type ApiRequestConfig } from '@myorg/shared/data-access-api';
import type {
  KissenTransferDetail,
  KissenTransferDetailParams,
  KissenTransferListParams,
  KissenTransferListResponse,
  KissenTransferRow,
  ResultPageInfo,
} from './kissen-transfer.model';

/**
 * Kissen 跨行转账 API。
 *
 * endpoint base `/api/manage/v1/`（源自 td-manage transaction-flow/kissen-transfer）。
 * `apiClient` 自动解包 `{ code, message, data }` 信封。
 * 列表请求体沿用旧页 CustomTable 契约：`{ data: filters, page: { pageNum, pageSize } }`。
 */

const KISSEN_TRANSFER_LIST_URL = '/api/manage/v1/kissen/transfer/listPage';
const KISSEN_TRANSFER_DETAIL_URL = '/api/manage/v1/kissen/transfer/detail';

/** 后端列表行（无前端注入的 id）。 */
type KissenTransferRowApi = Omit<KissenTransferRow, 'id'>;

interface ListResponseApi {
  page?: ResultPageInfo;
  rows?: KissenTransferRowApi[];
}

/** Kissen 跨行转账分页列表。 */
export async function getKissenTransferList(
  params: KissenTransferListParams,
  config?: ApiRequestConfig,
): Promise<KissenTransferListResponse> {
  const res = await apiClient.post<ListResponseApi>(
    KISSEN_TRANSFER_LIST_URL,
    {
      data: params.filters,
      page: { pageNum: params.pageNum, pageSize: params.pageSize },
    },
    config,
  );
  return {
    page: res.page,
    rows: (res.rows ?? []).map(
      (r): KissenTransferRow => ({
        ...r,
        id: String(r.transactionId ?? ''),
      }),
    ),
  };
}

/**
 * Kissen 跨行转账详情。
 *
 * `includeChain=true` 时额外返回 `chain.kissenChain` 状态迁移链；
 * `found=false` 表示该交易尚未同步到本地系统，其余字段可能为空。
 */
export async function getKissenTransferDetail(
  params: KissenTransferDetailParams,
  config?: ApiRequestConfig,
): Promise<KissenTransferDetail> {
  return apiClient.post<KissenTransferDetail>(
    KISSEN_TRANSFER_DETAIL_URL,
    params,
    config,
  );
}
