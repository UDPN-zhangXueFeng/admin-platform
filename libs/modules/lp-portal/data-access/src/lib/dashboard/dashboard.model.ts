/**
 * Dashboard 域模型（源 `src/types/business.ts` DashboardStats /
 * DashboardPoolCard / DashboardSummary + `src/api/dashboard.ts` VolumeRow +
 * `src/views/dashboard/index.vue` 码表，v2.3 e591f85 登录落地页；
 * v2.4 6c49396：池卡增 poolAddress、recentTxs 移除）。
 *
 * 只读聚合域：无 mutations；池状态码表复用 pool 域（同一后端码表同一译文）；
 * 交易状态 tag 采用 dashboard 独立口径（⚠️ 与 tx-flow 列表口径并存，01 §E21）。
 */

/** 统计卡四宫格数据（GET /dashboard/summary → stats）。 */
export interface DashboardStats {
  /** 开通（status=20）资金池数 */
  poolsOpen: number;
  /** 参与生效 token 对数 */
  pairsActive: number;
  /** 今日完成笔数（GMT+8 日切） */
  txToday: number;
  /** 累计完成笔数（35 已入账 / 40 已完成口径） */
  txCompleted: number;
  /** 累计完成本金合计 */
  principalTotal: string | number;
}

/** 「我的资金池」卡片行（summary → pools，余额/水位/授权额度随行下发）。 */
export interface DashboardPoolCard {
  poolId: number;
  tokenCode: string;
  tokenName: string;
  bankCode: string;
  bankName: string;
  /** v2.4 池地址（货币系统账户）；卡片第三行，空显 '-'（等宽截断+tooltip 原文） */
  poolAddress?: string;
  balance: string | number | null;
  /** 水位 = 余额 ÷ token 最低流动性（null = 分母缺失；可超 100%，进度条封顶 100 显示） */
  level: string | null;
  /** 预授权可用额（该池最新快照，无快照 = null） */
  preauthAvailable: string | number | null;
  status: number;
  balanceUpdateTime: number | null;
  syncTime: number;
}

/** GET /dashboard/summary 聚合响应（lpId 后端登录态注入，前端不传）；
 * v2.4 移除 recentTxs（最近交易退役，成交量口径走折线图）。 */
export interface DashboardSummary {
  stats: DashboardStats;
  pools: DashboardPoolCard[];
}

/** 近 N 天按 token 对日粒度成交量行（GET /dashboard/volume?days=N，折线图数据源）。 */
export interface VolumeRow {
  /** 'YYYY-MM-DD'（GMT+8 日切） */
  day: string;
  pairCode: string;
  sourceTokenCode: string;
  targetTokenCode: string;
  total: string | number;
  txCount: number;
}

/**
 * 交易状态 → Badge variant——**dashboard 独立口径**（源 dashboard/index.vue
 * txStatusTagType：35|40 success、60|70|90 danger、80 info、其余 primary）。
 * ⚠️ 与 tx-flow 列表口径（35 default、60 outline 等）**并存不同口径，都保真**
 * （01 §E21）。Badge 无 success/info 变体，按 R1 映射先例：success→default、
 * danger→destructive、info→outline、primary→secondary；未知码兜底 secondary。
 */
export const DASHBOARD_TX_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  35: 'default',
  40: 'default',
  60: 'destructive',
  70: 'destructive',
  90: 'destructive',
  80: 'outline',
};
