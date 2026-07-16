// statements data-access barrel.

// ── model ──
export type {
  ResultPageInfo,
  ExportRule,
  ExportRuleListFilters,
  ExportRuleListParams,
  ExportRuleListResponse,
  ExportTask,
  ExportTaskListFilters,
  ExportTaskListParams,
  ExportTaskListResponse,
  ExportRuleDetail,
  CreateExportRuleDTO,
  OperateExportRuleDTO,
  CreateExportTaskDTO,
  DeleteExportTaskDTO,
  StablecoinSearchOption,
  BlockchainOption,
} from './lib/statements.model';

// ── api（9 endpoint + 文件下载）──
export {
  getExportRuleList,
  createExportRule,
  operateExportRule,
  getPermissionEmails,
  getMyExportTaskList,
  createExportTask,
  getAllExportTaskList,
  deleteExportTask,
  getExportRuleDetail,
  getStablecoinSearches,
  getBlockchainList,
  downloadExportFile,
} from './lib/statements.api';

// ── queries ──
export { statementsKeys } from './lib/+queries/statements.keys';
export {
  useExportRuleListQuery,
  useExportRuleDetailQuery,
  useMyExportTaskListQuery,
  useAllExportTaskListQuery,
  useCreateExportRuleMutation,
  useOperateExportRuleMutation,
  useCreateExportTaskMutation,
  useDeleteExportTaskMutation,
  usePermissionEmailsMutation,
  useStablecoinSearchesQuery,
  useBlockchainListQuery,
} from './lib/+queries/statements.queries';
