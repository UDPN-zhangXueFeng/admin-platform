/**
 * Approval Management 模块类型定义（审批专属类型）。
 *
 * approval-manage 是横切全平台的「审批中心」，消费所有业务模块发起的审批单。
 * 本文件**只**定义审批专属类型（task / approvedDetail / approveForm / approvalLog /
 * escalationDrawer）。各审核组件（25 个）的业务字段语义来自已迁移模块
 * （tokenized-deposit / wallet / cross-chain / pledge / financial / key-management），
 * `businessContent` 是 dispatcher 按各 busCode 拆解的任意业务载荷，故用宽松类型兜底，
 * 不在此重建业务实体类型（避免与已迁移模块定义重复，Rule 1/2/7）。
 *
 * 迁移自 td-manage `src/lib/api/approval-manage.ts` + `workflow.ts`（workflowUserList）
 * + `src/pages/approval-manage/{index,view}.tsx` 消费字段。
 * 字段名遵循后端驼峰；列表行注入字符串 `id` 以满足 DataTable `{ id: string }` 契约（journal 模式）。
 */

// ── 公共类型 ──────────────────────────────────────────────────────────────────

/** 列表行注入 id 后的基类契约（DataTable 要求）。 */
export interface ApprovalRow {
  id: string;
}

/** 服务端分页请求参数（三 Tab 列表共用）。 */
export interface ApprovalListParams<F> {
  pageNum: number;
  pageSize: number;
  filters: F;
}

/** 三 Tab 列表筛选条件（源 index.tsx 三表 form 均为空，预留筛选扩展位）。 */
export interface ApprovalListFilters {
  [k: string]: unknown;
}

/** 分页响应公共结构（源项目 `{ page, rows }`）。 */
export interface ApprovalListPage {
  pageNum?: number;
  pageSize?: number;
  total?: number;
  pages?: number;
}

export interface ApprovalListResponse<R extends ApprovalRow> {
  page?: ApprovalListPage;
  rows: R[];
}

// ── 列表项 ApprovalTask ───────────────────────────────────────────────────────

/**
 * 审批任务列表行。三 Tab（待审批 / 已审批 / 我发起）共用同一结构：
 * - Tab1（queryTodoList）/ Tab3（queryCreateList）rowKey = `taskId`
 * - Tab2（queryCompletedList）rowKey = `detailId`
 *
 * 状态字段在不同 Tab 取值不同：Tab1/2 用 `approvalStatus`，Tab3 用 `taskStatus` +
 * `withdrawType`（Tab3 Withdrawal 按钮仅 `taskStatus===5 && withdrawType===1` 可用）。
 * Tab3 无 `approvalTime` 列。
 */
export interface ApprovalTask extends ApprovalRow {
  /** 任务 id（Tab1/3 rowKey）。 */
  taskId?: number | string;
  /** 已审批详情 id（Tab2 rowKey）。 */
  detailId?: number | string;
  /** 业务码（dispatcher 分发依据；跳详情透传为 `?busCode=`）。 */
  businessCode?: string;
  /** 业务名称（源序号列 dataIndex 疑似 bug 用了 businessName，迁移纠正由列定义处理）。 */
  businessName?: string;
  /** 业务描述（列表描述列）。 */
  businessDesc?: string;
  /** 发起人姓名。 */
  createUserName?: string;
  /** 发起时间（毫秒时间戳）。 */
  createTime?: number | string;
  /** 审批时间（Tab1/2 有，Tab3 无）。 */
  approvalTime?: number | string;
  /** 审批状态（Tab1/2 用，1=进行中/2=驳回/3=通过；颜色 `common_approval_status_${n}`）。 */
  approvalStatus?: number;
  /** 任务状态（Tab3 用，`common_task_status_${n}` + `approval_task_status_color_${n}`）。 */
  taskStatus?: number;
  /** 撤回类型（Tab3 撤回按钮启用条件之一，===1 可撤回）。 */
  withdrawType?: number;
  [k: string]: unknown;
}

// ── 审批详情 ApprovedDetail ────────────────────────────────────────────────────

/**
 * approvedDetailApi（/api/manage/v1/mult/approval/detail）返回。
 *
 * `businessContent` 是按 busCode 拆解的任意业务载荷（25 审核组件各自消费不同字段），
 * 故用 `Record<string, unknown>` 兜底；其中 `transCode` 是 multApprovalProcessApi
 * 的 **Bus-Trace-ID header** 来源（非 body）。
 *
 * `approveButtonDTO` 控制右侧审批操作区按钮可见性（approveType / escalationType /
 * previousStepType / metaMaskSignType），字段语义照源 view.tsx。
 */
export interface ApproveButtonDTO {
  /** 通过/驳回按钮：3=通过，2=驳回（与 approve form 的 approve 取值一致）。 */
  approveType?: number;
  /** 升级转办按钮可见性。 */
  escalationType?: number;
  /** 退回上一步按钮可见性。 */
  previousStepType?: number;
  /** MetaMask 签名按钮可见性（目标若无需求降级 stub）。 */
  metaMaskSignType?: number;
  [k: string]: unknown;
}

export interface ApprovedDetail {
  /** 业务载荷（任意，按 busCode 在 dispatcher 中拆解）。 */
  businessContent?: Record<string, unknown>;
  /** 审批操作区按钮控制 DTO。 */
  approveButtonDTO?: ApproveButtonDTO;
  /** 发起人姓名。 */
  createUserName?: string;
  /** 业务码（透传）。 */
  transCode?: string;
  [k: string]: unknown;
}

// ── 审批操作表单 ApproveForm ───────────────────────────────────────────────────

/**
 * multApprovalProcessApi 的请求体（通过/驳回）。
 * 源 view.tsx onFinish：`{approve, remarks, signatureR/S/V, taskId, busCode}`。
 * `approve` 取值 `'3'`(通过) / `'2'`(驳回)，与 approveButtonDTO.approveType 语义一致。
 * MetaMask 签名 RSV 注入（目标若无需求降级为空串）。
 */
export interface ApproveForm {
  approve: string | number;
  remarks?: string;
  signatureR?: string;
  signatureS?: string;
  signatureV?: string;
  taskId: number;
  busCode: string;
}

/** 退回上一步请求体（approvalPreviousStepApi）。源 view.tsx onFinishPreviousStep。 */
export interface PreviousStepPayload {
  busCode: string;
  remarks: string;
  taskId: number;
}

/** 撤回请求体（approvalWithdrawApi）。源 index.tsx onFinish。 */
export interface WithdrawPayload {
  busCode: string;
  remarks: string;
  taskId: number;
}

// ── 审批日志 ApprovalLog ───────────────────────────────────────────────────────

/**
 * taskApprovedDetailApi（${CONFIG_ID}v1/task/listTaskApproved）返回。
 * Steps 审批日志数据源：taskCreateInfo（首节点）+ recordList（操作记录链）。
 */
export interface ApprovalTaskCreateInfo {
  createTime?: number | string;
  [k: string]: unknown;
}

/** 单条审批操作记录（Steps 节点）。 */
export interface ApprovalRecord {
  /** 操作类型：0=待审批N人、1=reviewerStatus===3?通过:驳回、2=升级、3=退回上一步、其它=默认。 */
  operationType?: number;
  /** 审核状态（operationType=1 时按此判通过/驳回）。 */
  reviewerStatus?: number;
  /** 待审人列表（>5 折叠 + Tooltip）。 */
  reviewerUserNameList?: string[];
  /** 操作时间。 */
  operationTime?: number | string;
  /** 操作人。 */
  operationUserName?: string;
  /** 操作备注。 */
  operationRemarks?: string;
  [k: string]: unknown;
}

export interface ApprovalLog {
  taskCreateInfo?: ApprovalTaskCreateInfo;
  recordList?: ApprovalRecord[];
  /** 审批类型（Steps 节点分隔符 `approve_type_${n}`）。 */
  approveType?: number;
  /** 任务状态（taskApprovedDetailApi 返回会覆盖 setStatus，financial busCode 取此）。 */
  taskStatus?: number;
  [k: string]: unknown;
}

/** taskApprovedDetailApi 请求体。 */
export interface ApprovalLogParams {
  taskId: number;
}

/** approvedDetailApi 请求体。 */
export interface ApprovedDetailParams {
  taskId: number;
  busCode: string;
}

// ── 升级转办 Escalation ───────────────────────────────────────────────────────

/**
 * workflowUserList（${CONFIG_ID}v1/common/user/list）返回的用户项。
 * 升级 Drawer 选人 Table checkbox 跨页累积去重（removeKeys + Set）。
 */
export interface EscalationUser {
  userId?: number | string;
  userName?: string;
  /** 角色列表（只读展示）。 */
  roles?: Array<{ roleName?: string; [k: string]: unknown }>;
  [k: string]: unknown;
}

/** workflowUserList 请求体（源 view.tsx workflowUserList）。 */
export interface EscalationUserListParams {
  pageNum: number;
  pageSize: number;
  businessCode?: string;
  /** 来自 approvedDetail.businessContent.tokenId，无则 0。 */
  tokenId?: number;
  [k: string]: unknown;
}

/** workflowUserList 分页响应。 */
export interface EscalationUserListResponse {
  page?: ApprovalListPage;
  rows: EscalationUser[];
}

/**
 * addTaskApproveUser（${CONFIG_ID}v1/task/addTaskApproveUser）请求体。
 * 源 view.tsx onFinishEscalation：`{approveUserIdList, nodeOrderType, reason, taskId}`。
 */
export interface EscalationDrawerPayload {
  /** 已选用户 id 列表（跨页累积去重后）。 */
  approveUserIdList: Array<number | string>;
  /** 节点顺序类型（Radio 取值转 number）。 */
  nodeOrderType: number;
  /** 升级原因（必填）。 */
  reason: string;
  taskId: number;
}

// ── 文件下载 ───────────────────────────────────────────────────────────────────

/** downloadApi（${FILE_ID}v1/sftp/download）请求参数（serviceProvider / interest-fee）。 */
export interface DownloadFileParams {
  busId: string | number;
  busType: string | number;
}
