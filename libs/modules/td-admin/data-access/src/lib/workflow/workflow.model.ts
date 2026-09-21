/**
 * Workflow 模块数据模型（sys-workflow）。
 *
 * 字段对齐 td-manage 源码 `src/pages/sys/workflow/{index,view,edit}.tsx` +
 * 迁移文档 `.codex/plan/modules/workflow.md` §5。源码无独立 .d.ts，类型散落在组件
 * （大量 BCMP.Objects / GlobalAny），此处落地为正式 TS 接口并保留所有源码字段。
 */

/** 工作流状态：1 启用 / 2 禁用 / 3 已删除（逻辑删）。见 util/workflow.constants.ts。 */
export type WorkflowStatus = 1 | 2 | 3;

/** 节点 stepType：5 / 10 均映射为审批人（workflow_step_type_5/10）。 */
export type WorkflowStepType = 5 | 10;

/** 三项流程开关：1=Yes / 2=No。 */
export type WorkflowSwitch = 1 | 2;

/** 业务功能项（common/business/list 行）。code 业务码，value 展示名。 */
export interface BusinessItem {
  code: string;
  value: string;
}

/** 列表行（index.tsx / workflow/list）。rowKey 为 `workflowId`。 */
export interface WorkflowItem {
  workflowId: number;
  workflowName: string;
  /** 业务功能码（列表筛选字段；部分行可能缺失）。 */
  businessCode?: string;
  /** 业务功能名（列表展示用）。 */
  businessName: string;
  /** 节点数（列表展示用，数字）。 */
  workflowNodes: number;
  /** 创建时间戳（毫秒）。 */
  createdDate: number;
  status: WorkflowStatus;
}

/** 候选审批人（common/user/list 行）。roles 用于抽屉表格展示。 */
export interface CandidateUser {
  userId: number;
  userName: string;
  roles: string[];
}

/**
 * 详情节点（detail 返回 nodes[].stepUsers）。
 * stepUsers 为该节点审批人列表。
 */
export interface WorkflowDetailNode {
  stepOrder: number;
  stepType: WorkflowStepType;
  /** 审批人名 join 串（'-' 分隔，传输态；回填时转 ' / '）。见 util step-name。 */
  stepName: string;
  stepUsers: { userId: number; userName: string }[];
}

/**
 * 工作流详情（workflow/detial 返回）。
 *
 * 字段来自 view.tsx / edit.tsx 反解。`workflowNodes` 为节点数（view 展示），
 * `nodes` 为节点数组（view Steps / edit 回填用）——detail 同时返回扁平字段 + nodes
 * 数组（workflow.md §5/§8.3 已标注结构歧义，保留两字段）。
 */
export interface WorkflowDetail {
  workflowId: number;
  workflowName: string;
  businessId: number;
  businessCode: string;
  businessName: string;
  escalationType: WorkflowSwitch;
  /** Revert 开关。 */
  previousStepType: WorkflowSwitch;
  /** Withdraw 开关。 */
  withdrawType: WorkflowSwitch;
  createdDate: number;
  status: WorkflowStatus;
  /** 节点数（view 展示用）。 */
  workflowNodes: number;
  /** 节点数组（view Steps / edit 回填用）。 */
  nodes: WorkflowDetailNode[];
}

/** 列表查询参数（workflow/list）。服务端分页 + 4 筛选字段。 */
export interface WorkflowListParams {
  /** 工作流名。 */
  workflowName?: string;
  /** 业务功能码。 */
  businessCode?: string;
  /** 开始日期（毫秒时间戳，旧页 RangePicker）。 */
  beginDate?: number;
  /** 结束日期（毫秒时间戳）。 */
  endDate?: number;
  /** 状态：1/2（列表筛选不含 3=已删除）。 */
  status?: WorkflowStatus;
  page: number;
  pageSize: number;
}

/** workflow/list 返回的分页元信息（旧后端 page 对象：pageNum/pageSize/total）。 */
export interface WorkflowListPage {
  pageNum: number;
  pageSize: number;
  total: number;
}

/** workflow/list 返回体（{ rows, page }）。 */
export interface WorkflowListResult {
  rows: WorkflowItem[];
  page: WorkflowListPage;
}

/** 候选审批人列表查询参数（common/user/list）。 */
export interface CandidateUserListParams {
  page: { pageNum: number; pageSize: number };
  data: { businessCode: string; userName?: string };
}

/** common/user/list 返回的分页元信息。 */
export interface CandidateUserListPage {
  total: number;
  pageNum?: number;
  pageSize?: number;
}

/** common/user/list 返回体（{ rows, page }）。 */
export interface CandidateUserListResult {
  rows: CandidateUser[];
  page: CandidateUserListPage;
}

/** 提交节点（add/edit payload 中 nodes[] 的元素）。 */
export interface WorkflowSaveNode {
  /** 审批人名 join 串（'-' 分隔，传输态）。提交前由 ' / ' replaceAll 而来。 */
  stepName: string;
  /** 序号（提交前 -1，去掉发起人占位偏移）。 */
  stepOrder: number;
  stepType: WorkflowStepType;
  stepUsers: { userId: number }[];
}

/** 新建工作流 payload（workflow/add）。 */
export interface WorkflowCreateReq {
  businessCode: string;
  escalationType: WorkflowSwitch;
  previousStepType: WorkflowSwitch;
  withdrawType: WorkflowSwitch;
  workflowName: string;
  nodes: WorkflowSaveNode[];
}

/** 编辑工作流 payload（workflow/edit）。 */
export interface WorkflowUpdateReq extends WorkflowCreateReq {
  workflowId: number;
}

/** 启用/禁用/删除 payload（workflow/modifyStatus）。status：1=Enable/2=Disable/3=Delete。 */
export interface WorkflowModifyStatusReq {
  workflowId: number;
  status: WorkflowStatus;
}
