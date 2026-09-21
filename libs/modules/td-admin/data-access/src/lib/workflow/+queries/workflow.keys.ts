import type {
  CandidateUserListParams,
  WorkflowListParams,
} from '../workflow.model';

/**
 * TanStack Query key factory for the workflow module。
 *
 * 所有 key 携带 projectId，切换项目自动隔离缓存。workflow 含 list / detail /
 * business-list / user-list 四类查询。
 */
export const workflowKeys = {
  /** 模块根 key。 */
  all: (projectId: string) => ['project', projectId, 'workflow'] as const,

  /** list 查询前缀（mutations 成功后统一 invalidate）。 */
  lists: (projectId: string) => [...workflowKeys.all(projectId), 'list'] as const,

  /** 某组筛选/分页参数下的 list key。 */
  list: (projectId: string, params: WorkflowListParams) =>
    [...workflowKeys.lists(projectId), params] as const,

  /** 单个工作流详情 key。 */
  detail: (projectId: string, workflowId: number) =>
    [...workflowKeys.all(projectId), 'detail', workflowId] as const,

  /** 业务功能列表 key（列表筛选 + edit Select 共用，全局缓存）。 */
  businessList: (projectId: string) =>
    [...workflowKeys.all(projectId), 'business-list'] as const,

  /** 选人抽屉候选用户列表 key（按 businessCode + userName + 分页）。 */
  userList: (projectId: string, params: CandidateUserListParams) =>
    [...workflowKeys.all(projectId), 'user-list', params] as const,
} as const;
