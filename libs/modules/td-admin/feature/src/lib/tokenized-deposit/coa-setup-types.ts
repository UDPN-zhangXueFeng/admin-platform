'use client';

/**
 * COA 卡片 Props 契约类型集（CoaSetupStatus / CoaSetupInfo / CoaSetupErrors /
 * CoaSetupOption / CoaSetupCardProps）。
 * 源: coa-setup-card.tsx 73-129（纯代码搬移；coa-setup-card.tsx 原样 re-export）。
 */

// ── Props 契约（本地定义，与 data-access/model.ts 同名类型结构一致）──
//
// nx 边界规则：`type:ui` 仅可依赖 `type:ui`/`type:util`/`type:model`，
// 不可依赖 `type:data-access`（model.ts 所在层）。故 ui 层本地定义 Props 契约，
// 与 cross-chain-status-badge 等同模块兄弟组件惯例一致。
// 字段集严格对齐 data-access/model.ts 的 CoaSetupCardProps / CoaSetupInfo /
// CoaSetupErrors / CoaSetupOption，避免类型漂移；feature 层从 data-access
// import 同名类型并传 props，结构兼容。

/** COA 设置状态：configured（只读）/ setup_required（可编辑）。 */
export type CoaSetupStatus = 'configured' | 'setup_required';

/** COA Financial Book 初始化数据（完全受控，由父组件持有）。 */
export interface CoaSetupInfo {
  reserveAccountId?: number | string;
  status: CoaSetupStatus;
  financialBookName?: string;
  accountTemplateCode?: string;
  accountTemplateName?: string;
  eodCutOffTime?: string;
  timeZone?: string;
  timeZoneLabel?: string;
  linkedMessage?: string;
  headerNote?: string;
}

/** COA 字段校验错误映射。 */
export type CoaSetupErrors = Partial<
  Record<
    'financialBookName' | 'accountTemplateCode' | 'eodCutOffTime' | 'timeZone',
    string
  >
>;

/** COA 下拉选项（科目模板 / 时区）。 */
export interface CoaSetupOption {
  value: string;
  label: string;
}

/** CoaSetupCard Props（完全受控组件）。 */
export interface CoaSetupCardProps {
  data: CoaSetupInfo;
  loading?: boolean;
  /** 只读模式（stablecoin configured 态）。 */
  readonly?: boolean;
  /** 科目模板下拉选项。 */
  accountTemplateOptions?: CoaSetupOption[];
  /** 时区下拉选项。 */
  timezoneOptions?: CoaSetupOption[];
  /** 校验错误。 */
  errors?: CoaSetupErrors;
  /** 字段变更回调，参数为合并后的完整 data（patch 语义）。 */
  onChange?: (data: CoaSetupInfo) => void;
  className?: string;
  embedded?: boolean;
}
