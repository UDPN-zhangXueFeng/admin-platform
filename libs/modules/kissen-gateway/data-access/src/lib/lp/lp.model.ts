/**
 * LP 域数据模型（源 `types/business.ts` LpInfo，gw_lp_info 推送缓存）。
 */

/**
 * LP 行（GET /lp/list?pairId=）。
 * status：20 启用 / 其他 停用；源 lp.vue 模板对 status 判空（null 显示 '-'），
 * 故类型按运行时宽容声明为可空。
 */
export interface LpItem {
  id: number;
  lpId: number;
  lpName: string;
  pairId: number;
  status: number | null;
  version?: number;
  pushTime?: number;
}

/** LP 状态文案（源 lp.vue：status === 20 ? '启用' : '停用'；未知状态按停用兜底）。 */
export const LP_STATUS_LABEL: Record<number, string> = {
  20: 'Enabled',
  50: 'Disabled',
};

/** LP 状态 → Badge variant（启用=default，停用/未知=outline；对齐 kissen-admin conventions §5）。 */
export const LP_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  20: 'default',
  50: 'outline',
};
