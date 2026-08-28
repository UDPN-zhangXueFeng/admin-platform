/**
 * LP 我的分成域模型（源 `src/api/split.ts` + `src/types/business.ts`
 * SplitRow/SplitDetailRow + `views/split/index.vue` §D8 双卡片页码表）。
 *
 * ⚠️ 响应契约特例（迁移矩阵 C 表脚注 19 / 本仓任务口径）：`/split/detail`
 * **不走 ResultData 包装**——响应直出
 * `{ rows, total, pageNum, pageSize, summary{markupTotal, lpSplitTotal} }`，
 * lpRequest 拦截器对无 code 字段的包体原样透传，本域直读不做二次解包。
 * `/split/list` 则为普通行数组。
 *
 * 字段沿用本仓裁决口径：源 sourceTokenCode/targetTokenCode →
 * sourceCurrency/targetCurrency、金额 number 直读（settle/tx-flow 域同款）；
 * pairCode 允许缺省（后端旧数据无码，页面回落 pairId 展示）。
 */

/** 当前生效比例行（源 SplitRow）。 */
export interface SplitRow {
  pairId: number;
  /** 货币对编码；空值页面回落 String(pairId) */
  pairCode?: string;
  sourceCurrency: string;
  targetCurrency: string;
  /** 我的分成比例（0〜1 小数比率；null 页面显 '-'） */
  mySplitRatio: number | null;
  /** 对默认分成比例（0〜1） */
  defaultSplitRatio: number | null;
  /** true = 管理侧审批时覆盖了比例，比例旁追加警示标（源 el-tag warning「覆盖」） */
  overridden: boolean;
  /** 参与状态：5 申请中 / 15 已驳回 / 20 参与生效 / 50 停用 */
  status: number;
  /** 数据时间（毫秒时间戳） */
  syncTime: number;
}

/** 分成明细行（源 SplitDetailRow v2.3 e591f85：txNo 替代原 settleRecordId/
 * transactionId 两字段；即结算流水的分成切片）。 */
export interface SplitDetailRow {
  /** 全网唯一交易单号（KSN 单号；未同步到流水副本的记录空串，页面显 '-'） */
  txNo?: string;
  /** 货币对编码；空值页面显 '-' */
  pairCode?: string;
  principal: string | number;
  markupAmount: string | number;
  /** 分成比例（0〜1，页面 ×100 显 %） */
  splitRatio: string | number | null;
  lpSplitAmount: string | number;
  /** 完成时间（毫秒时间戳） */
  completedTime: number;
}

/**
 * 分成明细分页响应（**非 ResultData 包装**，见头注；源 api/split.ts 的
 * SplitDetailResp 1:1，summary 为时间窗汇总随分页一并下发）。
 */
export interface SplitDetailResp {
  rows: SplitDetailRow[];
  total: number;
  pageNum: number;
  pageSize: number;
  summary: {
    markupTotal: string;
    lpSplitTotal: string;
  };
}

/** 分成明细筛选条件（序列化进请求 `data` 包；undefined 字段不进请求体）。 */
export interface SplitDetailFilter {
  pairCode?: string;
  startTime?: number;
  endTime?: number;
}

/** 分成明细分页查询 hook 入参（filter 双包结构同 lpPage 约定）。 */
export interface SplitDetailQuery {
  pageNum: number;
  pageSize: number;
  filter: SplitDetailFilter;
}

/**
 * 参与状态文案（源 PAIR_STATUS_TEXT：5 申请中 / 15 已驳回 / 20 参与生效 /
 * 50 停用；未知码页面显原值）。SPLIT_ 前缀保留：与 pair 域
 * PAIR_STATUS_TEXT（pair.pages v2 基线同码表同译文）并存时避免主 barrel
 * 两路 star 导出同名歧义（TS2308）。
 */
export const SPLIT_PAIR_STATUS_LABEL: Record<number, string> = {
  5: 'Pending',
  15: 'Rejected',
  20: 'Active',
  50: 'Disabled',
};

/**
 * 参与状态 → Badge variant（源 el-tag：5 warning / 15 danger / 20 success /
 * 50 info）。Badge 无 warning/success/info 变体，按 R1 映射先例：
 * warning→outline（settle 单 20 同款）、danger→destructive、success→default、
 * info→secondary；未知码兜底 secondary 由页面处理。
 */
export const SPLIT_PAIR_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  5: 'outline',
  15: 'destructive',
  20: 'default',
  50: 'secondary',
};
