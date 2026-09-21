'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  getNormalizationBooks,
  getNormalizationDetail,
  getNormalizationHistoryList,
  getNormalizationMappingRules,
  getSourceFields,
  previewNormalization,
  updateNormalizationEvent,
} from '../tx-event-config.api';
import type {
  NormalizationBookListParams,
  NormalizationBookListResponse,
  NormalizationEvent,
  NormalizationEventListParams,
  NormalizationEventListResponse,
  NormalizationHistoryListParams,
  NormalizationHistoryListResponse,
  NormalizationPreview,
  NormalizationPreviewReq,
  SaveNormalizationEventDTO,
  SourceFieldsParams,
  TableFieldInfo,
} from '../tx-event-config.model';
import { txEventConfigKeys } from './tx-event-config.keys';

/** 标准化账本列表查询（服务端分页，keepPreviousData 平滑翻页）。 */
export function useNormalizationBooksQuery(params: NormalizationBookListParams) {
  return useQuery<NormalizationBookListResponse>({
    queryKey: txEventConfigKeys.booksList(params),
    queryFn: ({ signal }) => getNormalizationBooks(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

/** Mapping Rule 列表查询（按 financeBookId，服务端分页）。 */
export function useNormalizationMappingRulesQuery(
  params: NormalizationEventListParams,
  enabled = true
) {
  return useQuery<NormalizationEventListResponse>({
    queryKey: txEventConfigKeys.mappingRules(params),
    queryFn: ({ signal }) => getNormalizationMappingRules(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 标准化事件详情查询（详情页 + 编辑页用）。normalizationEventId 缺失时不请求。 */
export function useNormalizationDetailQuery(
  normalizationEventId: number | undefined,
  enabled = true
) {
  return useQuery<NormalizationEvent>({
    queryKey: txEventConfigKeys.detail(normalizationEventId ?? 0),
    queryFn: ({ signal }) =>
      getNormalizationDetail(normalizationEventId as number, { signal }),
    enabled: Boolean(normalizationEventId) && enabled,
  });
}

/** 源字段下拉查询（编辑页用，依赖 eventType + normalizationEventId）。 */
export function useSourceFieldsQuery(
  params: SourceFieldsParams | null,
  enabled = true
) {
  return useQuery<TableFieldInfo[]>({
    queryKey: txEventConfigKeys.sourceFields(
      params ?? { eventType: 0, normalizationEventId: 0 }
    ),
    queryFn: ({ signal }) => getSourceFields(params as SourceFieldsParams, { signal }),
    enabled: Boolean(params) && enabled,
  });
}

/** 历史记录查询（Historical Records tab，服务端分页）。 */
export function useNormalizationHistoryListQuery(
  params: NormalizationHistoryListParams,
  enabled = true
) {
  return useQuery<NormalizationHistoryListResponse>({
    queryKey: txEventConfigKeys.historyList(params),
    queryFn: ({ signal }) => getNormalizationHistoryList(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 预览标准化规则（列表页 Preview Modal 手动触发）。 */
export function usePreviewNormalizationMutation() {
  return useMutation<NormalizationPreview, Error, NormalizationPreviewReq>({
    mutationFn: (req) => previewNormalization(req),
  });
}

/**
 * 更新标准化事件 mutation（编辑页保存）。
 * 成功后失效 mapping-rules 列表 + 当前详情缓存。
 */
export function useUpdateNormalizationEventMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: SaveNormalizationEventDTO) => updateNormalizationEvent(dto),
    onSuccess: (_data, dto) => {
      void queryClient.invalidateQueries({
        queryKey: txEventConfigKeys.mappingRulesAll(),
      });
      void queryClient.invalidateQueries({
        queryKey: txEventConfigKeys.detail(dto.normalizationEventId),
      });
    },
  });
}
