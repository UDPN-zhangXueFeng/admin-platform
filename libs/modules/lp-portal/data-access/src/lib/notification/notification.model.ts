/**
 * LP 通知域模型（源 `src/api/notification.ts` NotificationRow 1:1 平移）。
 *
 * type：1 系统通知 / 2 资金池水位告警（FR-L-03）；readFlag：0 未读 / 1 已读。
 * 文案与样式映射供 feature 抽屉消费（pair 域同模式：码表随域模型导出）。
 */

export interface NotificationRow {
  notifyId: number;
  lpId: number;
  /** 1 系统通知 / 2 资金池水位告警 */
  type: number;
  title: string;
  content: string;
  /** 0 未读 / 1 已读 */
  readFlag: number;
  /** 已读时间（毫秒），未读为 0 */
  readTime: number;
  createTime: number;
}

/** 通知类型文案（约束①全英文；源 el-tag『水位告警』『系统通知』的英文化）。 */
export const NOTIFICATION_TYPE_TEXT: Record<number, string> = {
  1: 'System',
  2: 'Alert',
};

/** 源 el-tag 分支：type===2 → warning(amber)，其余 → info。 */
export function isWaterLevelAlert(type: number): boolean {
  return type === 2;
}
