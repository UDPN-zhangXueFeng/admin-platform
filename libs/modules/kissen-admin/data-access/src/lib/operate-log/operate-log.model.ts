/**
 * 操作日志域数据模型，逐字对齐源 `api/operate-log.ts`（v2.0 新增域，kissen-base 服务）。
 */

/** 操作日志筛选（源 operateLogPage 的 data 段；UI 仅暴露 module/operateName/status）。 */
export interface OperateLogListReq {
  userId?: number;
  module?: string;
  operateName?: string;
  status?: number;
  startTime?: number;
  endTime?: number;
}

/** 操作日志行（源 OperateLogRow，与后端 SysOperateLog 对齐），rowKey 为 `operateLogId`。 */
export interface OperateLogRow {
  operateLogId: number;
  userId: number;
  module: string;
  businessType: number;
  method: string;
  requestMethod: string;
  operateName: string;
  operateUrl: string;
  operateIp: string;
  operateParam: string;
  /** 0 正常 / 1 异常 */
  status: number;
  errorMsg: string;
  operateTime: number;
  costTime: number;
  traceId: string;
}

/** 执行结果：0 正常（源 el-tag success）/ 1 异常（源 el-tag danger）。 */
export const OPERATE_LOG_RESULT_LABEL: Record<number, string> = {
  0: 'Success',
  1: 'Error',
};

export const OPERATE_LOG_RESULT_VARIANT: Record<
  number,
  'default' | 'destructive'
> = {
  0: 'default',
  1: 'destructive',
};
