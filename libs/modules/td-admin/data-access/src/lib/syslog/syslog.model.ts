import type { PaginationParams } from '@myorg/shared/model';

/**
 * 单条系统日志记录。字段对齐旧页 (td-manage sys/sysLog) 的 `SysLogRespVo`。
 *
 * - `logTime` 为 epoch 毫秒。
 * - `module` 存储模块 code（如 `TOKEN_MANAGEMENT`），展示时通过 `formatModuleName` 转可读标题。
 * - `operationType` 为操作类型 code，文案走 i18n（`modules.syslog.operationType.<code>`）。
 */
export interface SysLogItem {
  logId: string;
  /** Epoch 毫秒 */
  logTime: number;
  userName: string;
  module: string;
  operationType: string;
  desc: string;
  sourceIp: string;
}

/**
 * 模块下拉数据。后端实际返回模块 code 字符串数组，例如
 * `["TOKEN_MANAGEMENT", "USER"]`，不是 `{ code, name }` 对象数组。
 */
export type SysLogModuleOption = string;

/** 操作类型下拉选项；文案由前端按 `code` 查 i18n。 */
export interface SysLogOperationTypeOption {
  code: number;
  name?: string;
}

/** 用户下拉选项；兼容 `userName` / `name` 两种返回字段。 */
export interface SysLogUserOption {
  userName?: string;
  name?: string;
}

/**
 * 日志列表查询参数。
 *
 * 字段对齐旧页筛选表单。时间范围为毫秒级 epoch，后端实测按毫秒筛选。
 */
export interface SysLogQueryParams extends PaginationParams {
  logId?: string;
  /** 起始时间（毫秒级 epoch） */
  startLogTime?: number;
  /** 结束时间（毫秒级 epoch） */
  endLogTime?: number;
  userName?: string;
  module?: string;
  operationType?: string;
  sourceIp?: string;
}
