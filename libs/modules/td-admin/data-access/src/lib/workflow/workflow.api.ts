import { apiClient, type ApiRequestConfig } from '@myorg/shared/data-access-api';
import type {
  BusinessItem,
  CandidateUserListParams,
  CandidateUserListResult,
  WorkflowCreateReq,
  WorkflowDetail,
  WorkflowListParams,
  WorkflowListResult,
  WorkflowModifyStatusReq,
  WorkflowUpdateReq,
} from './workflow.model';

/**
 * Workflow 模块 API client（sys-workflow）。
 *
 * 来源：td-manage `src/pages/sys/workflow/*` 内联 useSWR + `src/lib/api/workflow.ts`。
 * base `/api/rbac/v1`（sys 域统一前缀）。全部 7 个 endpoint 均为 POST
 * （business/list 旧页用 useSWR 默认 GET，迁移统一为 POST 以对齐 sys 域约定）。
 */

const BASE = '/api/rbac/v1';

/**
 * 单实体操作返回体（add/edit/modifyStatus 成功无业务 data）。
 *
 * apiClient.post 仅在 data===undefined 时抛错；后端成功通常返回 data:null，
 * 故调用方不依赖返回 data，仅依赖「不抛错即成功」。
 */
export interface WorkflowResultInfo {
  code: number;
  data: unknown;
  message: string;
}

/**
 * 工作流分页列表（workflow/list）。服务端分页 + 4 筛选字段。
 * 对应旧页 useCustomTable 的 `url: workflow/list`。
 */
export function getWorkflowList(
  params: WorkflowListParams,
  config?: ApiRequestConfig
): Promise<WorkflowListResult> {
  // 后端 workflow/list 约定分页字段为 pageNum（同 td-manage CustomTable）。
  // 前端 WorkflowListParams 用 page，此处适配，避免字段名不匹配导致空数据。
  const { page, ...rest } = params;
  const apiParams = (page !== undefined ? { ...rest, pageNum: page } : rest) as WorkflowListParams;
  return apiClient.post<WorkflowListResult, WorkflowListParams>(
    `${BASE}/workflow/list`,
    apiParams,
    config
  );
}

/**
 * 业务功能列表（common/business/list）。供列表筛选下拉 + 列展示 + edit 业务 Select。
 * 旧页 useSWR 默认 GET，迁移统一 POST（base 仍 /api/rbac/v1）。
 */
export function getBusinessList(
  config?: ApiRequestConfig
): Promise<BusinessItem[]> {
  return apiClient.post<BusinessItem[], unknown>(
    `${BASE}/common/business/list`,
    {},
    config
  );
}

/**
 * 工作流详情（workflow/detial）。参数 `{ workflowId }`。
 *
 * 注意（workflow.md §4）：endpoint 拼写为 `detial`（疑 typo for detail），**保留源码
 * 拼写**以匹配后端契约，勿擅自改正。后端若实际为 `detail` 需同步修改此处。
 */
export function getWorkflowDetail(
  workflowId: number,
  config?: ApiRequestConfig
): Promise<WorkflowDetail> {
  return apiClient.post<WorkflowDetail, { workflowId: number }>(
    `${BASE}/workflow/detial`,
    { workflowId },
    config
  );
}

/** 新建工作流（workflow/add）。对应旧页 workflowAddApi。 */
export function createWorkflow(
  data: WorkflowCreateReq,
  config?: ApiRequestConfig
): Promise<WorkflowResultInfo> {
  return apiClient.post<WorkflowResultInfo, WorkflowCreateReq>(
    `${BASE}/workflow/add`,
    data,
    config
  );
}

/** 编辑工作流（workflow/edit）。对应旧页 workflowEditApi。 */
export function updateWorkflow(
  data: WorkflowUpdateReq,
  config?: ApiRequestConfig
): Promise<WorkflowResultInfo> {
  return apiClient.post<WorkflowResultInfo, WorkflowUpdateReq>(
    `${BASE}/workflow/edit`,
    data,
    config
  );
}

/**
 * 启用/禁用/删除（workflow/modifyStatus）。status：1=Enable/2=Disable/3=Delete
 * （Delete 为逻辑删除，workflow.md §4）。对应旧页 workflowModifyStatusApi。
 */
export function modifyWorkflowStatus(
  data: WorkflowModifyStatusReq,
  config?: ApiRequestConfig
): Promise<WorkflowResultInfo> {
  return apiClient.post<WorkflowResultInfo, WorkflowModifyStatusReq>(
    `${BASE}/workflow/modifyStatus`,
    data,
    config
  );
}

/**
 * 候选审批人列表（common/user/list）。按 businessCode 过滤，服务端分页。
 * 供 edit 选人抽屉。对应旧页 workflowUserListApi。
 */
export function getCandidateUsers(
  params: CandidateUserListParams,
  config?: ApiRequestConfig
): Promise<CandidateUserListResult> {
  return apiClient.post<CandidateUserListResult, CandidateUserListParams>(
    `${BASE}/common/user/list`,
    params,
    config
  );
}
