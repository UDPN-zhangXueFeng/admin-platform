/** token 域 query key factory（维度：list=分页+筛选 / detail / operationLogs=code+分页 / filterOptions）。 */
import type { TokenOperationLogsPageReq, TokenPageReq } from './token.model';

export const tokenKeys = {
  all: ['kissen-gateway', 'token'] as const,
  list: (req: TokenPageReq) => [...tokenKeys.all, 'list', req] as const,
  detail: (tokenCode: string) => [...tokenKeys.all, 'detail', tokenCode] as const,
  operationLogs: (tokenCode: string, req: TokenOperationLogsPageReq) =>
    [...tokenKeys.all, 'operation-logs', tokenCode, req] as const,
  filterOptions: () => [...tokenKeys.all, 'filter-options'] as const,
} as const;
