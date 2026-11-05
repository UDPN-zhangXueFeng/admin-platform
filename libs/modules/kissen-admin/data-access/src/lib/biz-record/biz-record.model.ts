/**
 * 业务操作流水（biz_operate_record）域。
 * 端点：POST /manage/biz-record/object-page（按对象分页）、/recent（跨对象最近）。
 * 纯查询域，无写端点。
 */
export interface BizRecordRow {
  recordId: number;
  objectType: string;
  objectId: number;
  objectCode: string;
  action: string;
  /** 展示文案由后端下发，前端不硬编码动作名。 */
  actionLabel: string;
  fromStatus: number | null;
  toStatus: number | null;
  amount: string | number | null;
  currency: string | null;
  actorType: string;
  channel: string;
  refType: string;
  refId: number;
  parentId: number;
  /** 白名单字段 diff / 动作参数（JSON 字符串）。 */
  payload: string | null;
  payloadVersion: number;
  remarks: string;
  operatorId: number;
  operatorName: string;
  operateTime: number;
  traceId: string;
}

export type BizObjectType =
  | 'LP'
  | 'LP_POOL'
  | 'LP_PAIR'
  | 'BANK'
  | 'BANK_INSTANCE'
  | 'TOKEN'
  | 'TOKEN_PAIR'
  | 'SETTLE'
  | 'TX';

export interface BizRecordListReq {
  objectType: BizObjectType;
  objectId: number;
  actions?: string[];
  actorType?: 'ADMIN' | 'LP' | 'SYSTEM';
  startTime?: number;
  endTime?: number;
}
