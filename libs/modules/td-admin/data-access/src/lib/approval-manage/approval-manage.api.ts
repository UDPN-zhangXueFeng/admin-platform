import { apiClient } from '@myorg/shared/data-access-api';
import type {
  ApprovalListFilters,
  ApprovalListPage,
  ApprovalListParams,
  ApprovalListResponse,
  ApprovalLog,
  ApprovalLogParams,
  ApprovalTask,
  ApprovedDetail,
  ApprovedDetailParams,
  ApproveForm,
  DownloadFileParams,
  EscalationDrawerPayload,
  EscalationUser,
  EscalationUserListParams,
  EscalationUserListResponse,
  PreviousStepPayload,
  WithdrawPayload,
} from './approval-manage.model';

/**
 * Approval Management 模块 API。
 *
 * 迁移自 td-manage `src/lib/api/approval-manage.ts`（6 函数）+
 * `workflow.ts`（workflowUserList）+ `common.ts`（downloadApi）+
 * `src/pages/approval-manage/index.tsx`（三列表动态 URL，脚本漏抓，此处显式补全）。
 *
 * **两类 URL 前缀（严格区分，照源码）**：
 * - 静态：`/api/manage/v1/mult/approval/*`（detail/process/previousStep/withdraw）
 * - 动态：`${NEXT_PUBLIC_CONFIG_ID}v1/*`（三列表 queryTodoList/queryCompletedList/
 *   queryCreateList + task/addTaskApproveUser + task/listTaskApproved + common/user/list）。
 *   CONFIG_ID 是完整前缀（含 host 或路径段），axios 对绝对 URL 忽略 baseURL、对相对路径
 *   合并 baseURL，行为与源项目 `request(...)` 一致。
 *
 * **Bus-Trace-ID header**：仅 multApprovalProcessApi 携带，值 = `transCode`（来自
 * approvedDetail.businessContent.transCode），作为函数第二参传入，**非 body**（源码核对）。
 *
 * `apiClient` 自动解包 `{code,message,data}` 信封并在 code !== 0 时抛错，
 * 故各函数直接返回 `data` 字段对应类型。
 */

// ── 动态前缀（CONFIG_ID，环境依赖；未配置时降级为相对 `/`，运行时由 baseURL 兜底） ──

const CONFIG_ID = process.env.NEXT_PUBLIC_CONFIG_ID ?? '';

// ── 列表 URL（三 Tab，动态前缀，源 index.tsx 脚本漏抓，显式补全） ───────────────

const TODO_LIST_URL = `${CONFIG_ID}v1/task/queryTodoList`;
const COMPLETED_LIST_URL = `${CONFIG_ID}v1/task/queryCompletedList`;
const CREATE_LIST_URL = `${CONFIG_ID}v1/task/queryCreateList`;

// ── mult/approval 静态 URL（固定前缀） ──────────────────────────────────────────

const APPROVAL_DETAIL_URL = '/api/manage/v1/mult/approval/detail';
const APPROVAL_PROCESS_URL = '/api/manage/v1/mult/approval/process';
const APPROVAL_PREVIOUS_STEP_URL = '/api/manage/v1/mult/approval/previousStep';
const APPROVAL_WITHDRAW_URL = '/api/manage/v1/mult/approval/withdraw';

// ── task 动态 URL（动态前缀） ───────────────────────────────────────────────────

const ADD_TASK_APPROVE_USER_URL = `${CONFIG_ID}v1/task/addTaskApproveUser`;
const LIST_TASK_APPROVED_URL = `${CONFIG_ID}v1/task/listTaskApproved`;

// ── 工作流复用 URL（动态前缀，跨模块 common/user/list） ──────────────────────────

const COMMON_USER_LIST_URL = `${CONFIG_ID}v1/common/user/list`;

// ── 列表请求/响应内部类型 ───────────────────────────────────────────────────────

interface ListApi {
  page?: { pageNum?: number; pageSize?: number; total?: number; pages?: number };
  rows?: Omit<ApprovalTask, 'id'>[];
}

/**
 * POST 列表通用包装：构造 `{ data: filters, page }` 请求体，返回前为每行注入字符串 `id`。
 * 服务端分页用 **pageNum**（sys 域后端惯例，与已迁移 wallet/posting-engine 等模块一致）。
 * `idSelector` 按业务键组合稳定唯一 id（Tab1/3=taskId，Tab2=detailId）。
 */
async function postList(
  url: string,
  params: ApprovalListParams<ApprovalListFilters>,
  idSelector: (row: Omit<ApprovalTask, 'id'>) => string
): Promise<ApprovalListResponse<ApprovalTask>> {
  const response = await apiClient.post<ListApi>(url, {
    data: params.filters,
    page: { pageNum: params.pageNum, pageSize: params.pageSize },
  });
  return {
    page: response.page,
    rows: (response.rows ?? []).map((row): ApprovalTask => ({
      ...row,
      id: idSelector(row),
    })),
  };
}

// ── 列表 API（三 Tab） ─────────────────────────────────────────────────────────

/** 待审批列表（Tab1，rowKey=taskId）。 */
export function getTodoList(
  params: ApprovalListParams<ApprovalListFilters>
): Promise<ApprovalListResponse<ApprovalTask>> {
  return postList(TODO_LIST_URL, params, (row) =>
    String(row.taskId ?? Math.random())
  );
}

/** 已审批列表（Tab2，rowKey=detailId）。 */
export function getCompletedList(
  params: ApprovalListParams<ApprovalListFilters>
): Promise<ApprovalListResponse<ApprovalTask>> {
  return postList(COMPLETED_LIST_URL, params, (row) =>
    String(row.detailId ?? row.taskId ?? Math.random())
  );
}

/** 我发起的列表（Tab3，rowKey=taskId；支持撤回 taskStatus===5 && withdrawType===1）。 */
export function getCreateList(
  params: ApprovalListParams<ApprovalListFilters>
): Promise<ApprovalListResponse<ApprovalTask>> {
  return postList(CREATE_LIST_URL, params, (row) =>
    String(row.taskId ?? Math.random())
  );
}

// ── 审批详情（静态前缀） ────────────────────────────────────────────────────────

/** 审批详情（拉取 businessContent 业务载荷 + approveButtonDTO）。 */
export function getApprovedDetail(
  params: ApprovedDetailParams
): Promise<ApprovedDetail> {
  return apiClient.post<ApprovedDetail>(APPROVAL_DETAIL_URL, params);
}

// ── 审批操作（4 种，process 静态 + previousStep 静态 + withdraw 静态 + addTaskApproveUser 动态） ──

/**
 * 通过/驳回（multApprovalProcessApi）。
 *
 * **Bus-Trace-ID header**：值 = `transCode`（第二参，来自 approvedDetail
 * .businessContent.transCode），通过 apiClient 第三参 config.headers 透传，**非 body**。
 * 源码核对：`request(url, { method:'POST', data:param, headers:{'Bus-Trace-ID':transCode} })`。
 */
export function multApprovalProcess(
  param: ApproveForm,
  transCode: string
): Promise<unknown> {
  return apiClient.post(APPROVAL_PROCESS_URL, param, {
    headers: { 'Bus-Trace-ID': transCode },
  });
}

/** 退回上一步（Modal remarks 必填）。 */
export function approvalPreviousStep(
  payload: PreviousStepPayload
): Promise<unknown> {
  return apiClient.post(APPROVAL_PREVIOUS_STEP_URL, payload);
}

/** 撤回我发起的单据（Tab3，remarks 必填）。 */
export function approvalWithdraw(payload: WithdrawPayload): Promise<unknown> {
  return apiClient.post(APPROVAL_WITHDRAW_URL, payload);
}

/** 升级转办（动态前缀，nodeOrderType + approveUserIdList + reason + taskId）。 */
export function addTaskApproveUser(
  payload: EscalationDrawerPayload
): Promise<unknown> {
  return apiClient.post(ADD_TASK_APPROVE_USER_URL, payload);
}

// ── 审批日志（动态前缀） ────────────────────────────────────────────────────────

/** 审批日志（taskCreateInfo + recordList + approveType + taskStatus）。 */
export function getTaskApprovedDetail(
  params: ApprovalLogParams
): Promise<ApprovalLog> {
  return apiClient.post<ApprovalLog>(LIST_TASK_APPROVED_URL, params);
}

// ── 工作流复用：升级选人列表（动态前缀） ────────────────────────────────────────

/**
 * 用户下拉列表（common/user/list，升级 Drawer 选人）。
 * 源 view.tsx workflowUserList：请求体 `{ page, data:{businessCode, tokenId, ...} }`。
 * 分页用 pageNum；tokenId 来自 approvedDetail.businessContent.tokenId（无则 0）。
 */
export async function getWorkflowUserList(
  params: EscalationUserListParams
): Promise<EscalationUserListResponse> {
  const { pageNum, pageSize, ...data } = params;
  // EscalationUser 为宽松 record，直接解包信封。
  const response = await apiClient.post<{
    page?: ApprovalListPage;
    rows?: EscalationUser[];
  }>(COMMON_USER_LIST_URL, {
    page: { pageNum, pageSize },
    data,
  });
  return {
    page: response.page,
    rows: response.rows ?? [],
  };
}

// ── 文件下载（sftp/download，Blob，绕过 apiClient 信封解包） ─────────────────────

/**
 * 下载文件（sftp/download，serviceProvider Business License / interest-fee 文件）。
 *
 * 绕过 apiClient 信封解包（blob 不走 `{code,data}`），用 fetch 取原始响应。
 * 文件名从 Content-Disposition `utf-8''fileName` 解析（statements 模式）。
 * auth token 从 localStorage 读取（与 axios 拦截器一致，用 `token` header）。
 * **降级**：`NEXT_PUBLIC_FILE_ID` 未配置时 base 为空，URL 仍可由 baseURL 兜底；
 * 若运行时无配置则下载会失败（不崩，由调用方 try/catch 提示不可用）。
 */
export async function downloadFile(params: DownloadFileParams): Promise<void> {
  const base = process.env.NEXT_PUBLIC_FILE_ID ?? '';
  const url = `${base}/v1/sftp/download?busId=${encodeURIComponent(
    String(params.busId)
  )}&busType=${encodeURIComponent(String(params.busType))}`;
  const token =
    typeof window !== 'undefined'
      ? window.localStorage.getItem('admin_platform_access_token') ?? ''
      : '';
  const res = await fetch(url, { headers: token ? { token } : {} });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const fileNamePart = disposition.split("utf-8''")[1];
  const fileName = fileNamePart ? decodeURIComponent(fileNamePart) : 'download';
  const elink = document.createElement('a');
  elink.download = fileName;
  elink.style.display = 'none';
  elink.href = URL.createObjectURL(blob);
  document.body.appendChild(elink);
  elink.click();
  URL.revokeObjectURL(elink.href);
  document.body.removeChild(elink);
}
