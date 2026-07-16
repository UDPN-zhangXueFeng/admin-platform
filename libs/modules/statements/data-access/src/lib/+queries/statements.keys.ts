import type {
  ExportRuleListParams,
  ExportTaskListParams,
} from '../statements.model';

/** TanStack Query key 工厂。 */
export const statementsKeys = {
  all: ['statements'] as const,
  rules: () => [...statementsKeys.all, 'rules'] as const,
  ruleList: (params: ExportRuleListParams) =>
    [...statementsKeys.rules(), 'list', params] as const,
  ruleDetail: (exportRuleId: number | string) =>
    [...statementsKeys.rules(), 'detail', exportRuleId] as const,
  tasks: () => [...statementsKeys.all, 'tasks'] as const,
  myTaskList: (params: ExportTaskListParams) =>
    [...statementsKeys.tasks(), 'my', params] as const,
  allTaskList: (params: ExportTaskListParams) =>
    [...statementsKeys.tasks(), 'all', params] as const,
  stablecoinSearches: () =>
    [...statementsKeys.all, 'stablecoin-searches'] as const,
  blockchainList: () => [...statementsKeys.all, 'blockchain-list'] as const,
} as const;
