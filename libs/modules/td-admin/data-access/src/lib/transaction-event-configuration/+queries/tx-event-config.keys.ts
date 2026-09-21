import type {
  NormalizationBookListParams,
  NormalizationEventListParams,
  NormalizationHistoryListParams,
  SourceFieldsParams,
} from '../tx-event-config.model';

/**
 * TanStack Query key 工厂（集中管理，便于 invalidate）。
 */
export const txEventConfigKeys = {
  all: ['transaction-event-configuration'] as const,
  booksList: (params: NormalizationBookListParams) =>
    [...txEventConfigKeys.all, 'books', params] as const,
  /** mapping-rules 列表（按 financeBookId 维度）。 */
  mappingRules: (params: NormalizationEventListParams) =>
    [...txEventConfigKeys.all, 'mapping-rules', params] as const,
  /** 所有 mapping-rules 列表（invalidate 用前缀）。 */
  mappingRulesAll: () => [...txEventConfigKeys.all, 'mapping-rules'] as const,
  detail: (normalizationEventId: number | string) =>
    [...txEventConfigKeys.all, 'detail', normalizationEventId] as const,
  sourceFields: (params: SourceFieldsParams) =>
    [...txEventConfigKeys.all, 'source-fields', params] as const,
  historyList: (params: NormalizationHistoryListParams) =>
    [...txEventConfigKeys.all, 'history', params] as const,
};
