/** 与后端 DashboardSummaryRespVO.Stats 对齐（五格统计卡，全部生效口径） */
export interface DashboardStats {
  banks: number;
  lps: number;
  tokens: number;
  pairs: number;
  txToday: number;
}

/** 与后端 DashboardSummaryRespVO.PairBar 对齐（今日交易按 token 对，pairId=0 未匹配对） */
export interface DashboardPairBar {
  pairId: number;
  pairCode: string | null;
  label: string;
  txCount: number;
}

/** 与后端 DashboardSummaryRespVO.LowPool 对齐（告急池，水位升序 Top 8） */
export interface DashboardLowPool {
  poolId: number;
  lpId: number;
  lpName: string;
  tokenCode: string;
  tokenSymbol: string;
  /** 池地址（货币系统账户地址） */
  accountAddress: string;
  /** 水位分子展示串（后端按 token 小数位格式化:千分位+定长小数,前端直显） */
  available: string;
  /** 距达标缺口展示串 = Σ对侧 min − 水位分子（同上后端格式化） */
  shortfall: string;
  /** 不足类型：BALANCE 余额不足 / AUTH 可用授权不足 */
  lackType: 'BALANCE' | 'AUTH';
  /** 水位 = 分子 ÷ Σ对侧 min（scale 4） */
  ratio: string | number;
}

export type ExceptionGroupKey = 'PENDING' | 'REVERSED' | 'FAILED' | 'CANCELLED';

export interface DashboardExceptionGroup {
  key: ExceptionGroupKey;
  today: number;
  week: number;
}

export interface DashboardExceptionStats {
  today: number;
  week: number;
  groups: DashboardExceptionGroup[];
}

/** 与后端 DashboardSummaryRespVO 对齐 */
export interface DashboardSummary {
  stats: DashboardStats;
  lowPools: DashboardLowPool[];
  criticalPoolTotal: number;
  exceptions: DashboardExceptionStats;
}

/** 与后端 DashboardTrendRowVO 对齐（稀疏行，按日补零由图表组件完成） */
export interface DashboardTrendRow {
  day: string;
  total: number;
  exception: number;
}
