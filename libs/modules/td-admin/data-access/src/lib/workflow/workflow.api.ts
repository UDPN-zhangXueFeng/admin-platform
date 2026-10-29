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
 * URL 走动态前缀 `${CONFIG_ID}v1/*`（同 approval-manage 的 CONFIG_ID 模式）。
 * workflow/* 与 common/user/list 为 POST；common/business/list 保持旧页
 * useSWR 默认 GET（单 key 调用、无请求体）。
 */

// ── 动态前缀（CONFIG_ID，环境依赖；未配置时降级为相对 `/`，运行时由 baseURL 兜底） ──

const CONFIG_ID = process.env.NEXT_PUBLIC_CONFIG_ID ?? '';

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
 * workflow/list 请求体：`{ page, data }` 信封——分页嵌套（pageNum/pageSize），
 * 筛选字段收进 data（同 common/user/list 的 sys 域服务端分页惯例）。
 */
interface WorkflowListApiBody {
  page: { pageNum: number; pageSize: number };
  data: Omit<WorkflowListParams, 'page' | 'pageSize'>;
}

/**
 * 工作流分页列表（workflow/list）。服务端分页 + 4 筛选字段。
 * 对应旧页 useCustomTable 的 `url: workflow/list`。
 */
export async function getWorkflowList(
  params: WorkflowListParams,
  config?: ApiRequestConfig
): Promise<WorkflowListResult> {
  // 前端平铺的 page/pageSize 适配为嵌套 pageNum/pageSize，筛选字段收进 data。
  const { page, pageSize, ...filters } = params;
  const raw = await apiClient.post<WorkflowListResult, WorkflowListApiBody>(
    `${CONFIG_ID}v1/workflow/list`,
    { page: { pageNum: page, pageSize }, data: filters },
    config
  );

  // 该服务实际可能只返回 page.total；请求页码/容量仍是当前结果的权威来源。
  return {
    rows: raw.rows ?? [],
    page: {
      ...raw.page,
      pageNum: raw.page?.pageNum ?? page,
      pageSize: raw.page?.pageSize ?? pageSize,
      total: raw.page?.total ?? 0,
    },
  };
}

/**
 * 业务功能列表（common/business/list）。供列表筛选下拉 + 列展示 + edit 业务 Select。
 * 旧页 useSWR 默认 GET（单 key 调用，无请求体），此处保持 GET。
 */
export function getBusinessList(
  config?: ApiRequestConfig
): Promise<BusinessItem[]> {
  return apiClient.get<BusinessItem[]>(
    `${CONFIG_ID}v1/common/business/list`,
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
    `${CONFIG_ID}v1/workflow/detial`,
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
    `${CONFIG_ID}v1/workflow/add`,
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
    `${CONFIG_ID}v1/workflow/edit`,
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
    `${CONFIG_ID}v1/workflow/modifyStatus`,
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
    `${CONFIG_ID}v1/common/user/list`,
    params,
    config
  );
}
