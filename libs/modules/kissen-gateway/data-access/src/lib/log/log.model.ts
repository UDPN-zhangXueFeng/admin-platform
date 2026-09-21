/**
 * Log 域模型（源 `types/system.ts` LogListReq/LogRow + `views/system/log.vue`
 * 业务类型/状态标签映射）。
 */

/** Badge variant 约定（kissen 家族语义分层：success→default、primary/warning→secondary、danger→destructive、info→outline）。 */
export type LogVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 操作日志筛选条件（POST /log/page filter，全部可选；startTime/endTime 为毫秒时间戳）。 */
export interface LogListReq {
  userId?: number;
  module?: string;
  startTime?: number;
  endTime?: number;
}

/** 列表查询请求（喂 kissenPage）。 */
export interface LogPageReq {
  pageNum: number;
  pageSize: number;
  filter: LogListReq;
}

/**
 * 操作日志行（源 gw_oper_log；businessType 1 新增/2 修改/3 删除/4 登录/5 其他，
 * status 0 正常/1 异常）。
 */
export interface LogRow {
  operateLogId: number;
  userId?: number;
  module?: string;
  /** 1 新增 / 2 修改 / 3 删除 / 4 登录 / 5 其他 */
  businessType?: number;
  method?: string;
  requestMethod?: string;
  operateName?: string;
  operateUrl?: string;
  operateIp?: string;
  operateParam?: string;
  /** 0 正常 / 1 异常 */
  status?: number;
  errorMsg?: string;
  operateTime?: number;
  costTime?: number;
  traceId?: string;
}

/** 业务类型文案（源 `views/system/log.vue` BIZ_TEXT 1-5）。 */
export const LOG_BUSINESS_TYPE_TEXT: Record<number, string> = {
  1: 'Create',
  2: 'Update',
  3: 'Delete',
  4: 'Sign-in',
  5: 'Other',
};

/** 业务类型 Badge variant（源 BIZ_TAG：1 primary/2 warning→secondary、3 danger→destructive、4 success→default、5 info→outline）。 */
export const LOG_BUSINESS_TYPE_VARIANT: Record<number, LogVariant> = {
  1: 'secondary',
  2: 'secondary',
  3: 'destructive',
  4: 'default',
  5: 'outline',
};

/** 业务类型文案；undefined → '-'，未知码 → '其他'（源 bizText）。 */
export function logBusinessTypeText(t?: number): string {
  return t === undefined ? '-' : (LOG_BUSINESS_TYPE_TEXT[t] ?? 'Other');
}

/** 业务类型 Badge variant；未知码 → outline（源 bizTagType 的 info 兜底）。 */
export function logBusinessTypeVariant(t?: number): LogVariant {
  return LOG_BUSINESS_TYPE_VARIANT[t ?? -1] ?? 'outline';
}

/** 状态文案：0 正常 / 其余（含 1、undefined）异常（源模板三元）。 */
export function logStatusText(status?: number): string {
  return status === 0 ? 'Normal' : 'Abnormal';
}

/** 状态 Badge variant：0 正常(success→default) / 其余 异常(danger→destructive)（源模板）。 */
export function logStatusVariant(status?: number): LogVariant {
  return status === 0 ? 'default' : 'destructive';
}
