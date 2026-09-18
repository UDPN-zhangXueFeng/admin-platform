import type { AuditTrailListParams } from '../audit-trail.model';

/**
 * TanStack Query key 工厂。始终通过助手生成 key。
 */
export const auditTrailKeys = {
  all: ['audit-trail'] as const,
  lists: () => [...auditTrailKeys.all, 'lists'] as const,
  list: (params: AuditTrailListParams) =>
    [...auditTrailKeys.lists(), params] as const,
  detail: (traceId: number | string) =>
    [...auditTrailKeys.all, 'detail', traceId] as const,
  stablecoinSearches: () =>
    [...auditTrailKeys.all, 'stablecoin-searches'] as const,
  blockchainList: () => [...auditTrailKeys.all, 'blockchain-list'] as const,
} as const;
