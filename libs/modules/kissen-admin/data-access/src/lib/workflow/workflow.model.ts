/**
 * 审批流定义配置模型（源 `api/workflow.ts`，对齐 kissen-base /v1/workflow/*）。
 *
 * workflowId/businessCode/businessName、status 1 启用 / 2 失效；detail 为 GET 路径参数。
 */

/** 审批流步骤（源 WorkflowStep）。 */
export interface WorkflowStep {
  workflowStepId?: number;
  stepName: string;
  stepOrder: number;
  /** 5 审核 / 10 知会 */
  stepType?: number;
  userIds: number[];
  userNames?: string[];
}

/** 审批流列表行（源 WorkflowRow）。 */
export interface WorkflowRow {
  workflowId: number;
  businessId: number;
  businessCode: string;
  businessName: string;
  workflowName: string;
  /** 1 启用 / 2 失效（同 busCode 仅一个启用版本） */
  status: number;
  stepCount: number;
  createTime?: number;
}

/** 审批流详情（源 WorkflowDetail，含步骤）。 */
export interface WorkflowDetail extends WorkflowRow {
  steps: WorkflowStep[];
}

/** 审批步骤保存载荷（源 WorkflowSaveReq.steps 元素结构）。 */
export interface WorkflowStepReq {
  stepName: string;
  stepOrder: number;
  stepType?: number;
  userIds: number[];
}

/** 新建审批流请求体（源 WorkflowSaveReq）。 */
export interface WorkflowSaveReq {
  businessId: number;
  workflowName: string;
  withdrawType?: number;
  previousStepType?: number;
  escalationType?: number;
  approveType?: number;
  steps: WorkflowStepReq[];
}

/** 更新审批流请求体（源 WorkflowUpdateReq）。 */
export interface WorkflowUpdateReq extends WorkflowSaveReq {
  workflowId: number;
}

/** 可新增审批流配置的业务选项（源 BusinessOption）。 */
export interface BusinessOption {
  businessId: number;
  businessCode: string;
  businessName: string;
}

/* ------------------------------ 状态枚举映射 ------------------------------ */

/** 审批流状态：1 启用 / 2 停用。 */
export const WORKFLOW_STATUS_LABEL: Record<number, string> = {
  1: 'Enabled',
  2: 'Disabled',
};

export const WORKFLOW_STATUS_VARIANT: Record<number, 'default' | 'secondary'> = {
  1: 'default',
  2: 'secondary',
};

/** 步骤类型：5 审核 / 10 知会。 */
export const WORKFLOW_STEP_TYPE_LABEL: Record<number, string> = {
  5: 'Review',
  10: 'Notify',
};
