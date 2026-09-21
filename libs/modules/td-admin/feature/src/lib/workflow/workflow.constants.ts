/**
 * Workflow 模块常量（sys-workflow）。
 *
 * 业务来源：td-manage `src/pages/sys/workflow/{index,view,edit,t_edit}.tsx`
 * + 迁移文档 `.codex/plan/modules/workflow.md`。
 *
 * - `WorkflowStatus`：工作流状态枚举。1=启用 / 2=禁用 / 3=已删除（逻辑删除）。
 *   列表筛选/行操作/Tag 配色都依赖这三个数字语义（workflow.md §5 / §6.1）。
 * - `WorkflowStepType`：节点权限/类型。源码 options 为 [5, 10]，两者在 i18n 中分别
 *   映射文案（workflow_step_type_5 / workflow_step_type_10），均表示「审批人」节点。
 * - `WorkflowSwitch`：三项流程开关（Withdraw / Revert / Escalate）。1=Yes / 2=No
 *   （workflow.md §5，旧表单 Radio.Group value 取 1/2）。
 * - `WORKFLOW_PAGE_SIZE`：列表与选人抽屉的分页默认，对齐旧页（10）。
 * - `THRESHOLD_BUSINESS_CODES` + threshold 相关：来自 t_edit.tsx 的阈值规则原型
 *   （threshold 阶梯金额审批分支）。保留常量与校验逻辑供 edit form 可选增强分支引用，
 *   当前后端 DTO 未确认落地，仅作占位（workflow.md §2 / §6.4）。
 */

/** 默认每页条数，对齐旧页 useCustomTable / 选人抽屉 Table 分页默认。 */
export const WORKFLOW_PAGE_SIZE = 10;

/** 工作流 status 枚举：1 启用 / 2 禁用 / 3 已删除（逻辑删）。 */
export const WorkflowStatus = {
  Active: 1,
  Inactive: 2,
  Deleted: 3,
} as const;

export type WorkflowStatusValue =
  (typeof WorkflowStatus)[keyof typeof WorkflowStatus];

/**
 * 节点权限/类型 stepType。源码 options 为 [5, 10]，均映射为「审批人」节点
 * （i18n workflow_step_type_5 / workflow_step_type_10）。列表第一个节点固定为发起人
 * （提交时不参与，表单内仅作展示占位）。
 */
export const WorkflowStepType = {
  /** 5/10 均为审批节点，具体语义以后端枚举为准（旧页 disabled，不可改）。 */
  Approve5: 5,
  Approve10: 10,
} as const;

export type WorkflowStepTypeValue =
  (typeof WorkflowStepType)[keyof typeof WorkflowStepType];

/** 三项流程开关（Withdraw / Revert / Escalate）：1=Yes / 2=No。 */
export const WorkflowSwitch = {
  Yes: 1,
  No: 2,
} as const;

export type WorkflowSwitchValue =
  (typeof WorkflowSwitch)[keyof typeof WorkflowSwitch];

/**
 * 阈值规则（threshold）适用的业务 code 白名单（来自 t_edit.tsx）。
 *
 * 仅当所选 businessCode 在此列表内时，节点表单才渲染阈值列（条件渲染）。
 * 该能力为 t_edit 原型增强，后端 DTO 落地前作为可选分支保留（workflow.md §6.4）。
 */
export const THRESHOLD_BUSINESS_CODES = [
  'MINT_TOKEN',
  'MELT_TOKEN',
  'SP_TOP_UP',
  'SP_WITHDRAW',
  'FREEZE_FUNDS',
  'UNFREEZE_FUNDS',
] as const;

/** 判断某 businessCode 是否启用阈值规则列。 */
export function isThresholdBusiness(businessCode: string | undefined): boolean {
  return !!businessCode && THRESHOLD_BUSINESS_CODES.includes(businessCode as never);
}

/**
 * 阈值金额阶梯校验（来自 t_edit.tsx validateThresholdAmount）。
 *
 * 语义：当前节点金额必须**严格大于**其之前最近一个「启用阈值」节点的金额，
 * 形成阶梯式审批门槛。返回首个违反（小于等于）的前置节点金额，便于提示。
 *
 * 注意：此为 t_edit 原型逻辑，后端未落地时仅供前端表单校验占位。
 *
 * @param nodes      含 enableThreshold/thresholdAmount 的节点列表（首节点为发起人占位）。
 * @param currentIndex 当前校验节点下标（1-based 对齐表单 stepOrder）。
 * @param value      当前节点输入金额。
 * @returns 违反的前置阈值金额（校验失败）；无违反返回 null（通过）。
 */
export function validateThresholdAmount(
  nodes: ReadonlyArray<{
    enableThreshold?: boolean;
    thresholdAmount?: number | null;
  }>,
  currentIndex: number,
  value: number
): number | null {
  if (!value || currentIndex <= 1) return null;
  for (let i = currentIndex - 1; i >= 1; i--) {
    const prev = nodes[i];
    if (prev?.enableThreshold && prev?.thresholdAmount) {
      if (value <= prev.thresholdAmount) {
        return prev.thresholdAmount;
      }
      return null; // 仅与最近一个启用阈值的节点比较，命中即止。
    }
  }
  return null;
}

/** 5 个后端权限点 UUID（index 行操作：View/Edit/Disable/Enable/Delete）+ Add。
 *
 * 来自 td-manage index.tsx 的 limit（workflow.md §6.1）。sys 域尚未接通权限守卫
 * （与 role/syslog 一致），UUID 先集中于此避免散落。 */
export const WORKFLOW_PERMISSIONS = {
  add: 'f1c12e747d454782ac1e869539f9ad17',
  view: '512805e710be4adfb5b31b3e4a5ae50a',
  edit: '779e5227362e4d9084e2f9f08ece0335',
  disable: '33830490c43a431b85793ea4d6ec4325',
  enable: 'b60cd83679214358b1a470a68e6a97b8',
  delete: '63c22af4cb5c43d1909a54fcfe338e80',
} as const;
