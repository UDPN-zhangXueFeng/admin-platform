/**
 * 平移 + `src/views/pair/index.vue` §D7 码表，基线 kissen-lp-portal v2.3
 * e591f85：汇率三列（baseRate/markupRate/userRate，原汇率页字段）并入
 * 双 tab 行 VO，rate 页随菜单退役（端点与 SyncDomainCode 'rate' 保留）。
 *
 * v1 的 types.ts 中转声明（旧 PairRow/PairPool* 形状）随 pair-pool 聚合页
 * 一并废弃剪除，PairRow 在本域以 v2 基线形状重新声明；EligiblePairRow 为
 * /pair/eligible 新端点行。lpId 由后端登录态注入，前端不传。
 */

/** 我的 token 对行（参与清单；状态 + 生效分成比例，POST /pair/list）。 */
export interface PairRow {
  /** 记录 ID（Mine 表首列）。 */
  id: number;
  pairId: number;
  /** 无码行页面回落显示 pairId。 */
  pairCode: string;
  sourceTokenCode: string;
  sourceTokenNo: string;
  targetTokenCode: string;
  targetTokenNo: string;
  /** v2.3 并入的汇率字段：基础汇率（比值原值展示，不加 %；null → '-'）。 */
  baseRate: string | number | null;
  /** v2.3 并入的汇率字段：加价率（0〜1，页面 ×100 显 2 位小数 %）。 */
  markupRate: string | number | null;
  /** v2.3 并入的汇率字段：用户汇率 = 基础 + 加价。 */
  userRate: string | number | null;
  /** 生效分成比例（覆盖值或对默认，推送定值）。 */
  mySplitRatio: string | number;
  defaultSplitRatio: string | number;
  /** 参与状态：5 申请中 / 15 已驳回 / 20 参与生效 / 50 停用。 */
  status: number;
  /** 驳回原因（status===15 且非空时挂在状态 tag tooltip）。 */
  rejectReason: string;
  /** 生效条件缺口之一：双侧资金池是否就绪（status===20 时渲染）。 */
  poolReady: boolean;
  /** 生效条件缺口之二：预授权是否有效（status===20 时渲染）。 */
  preauthOk: boolean;
  /** f0d5b6f：源侧激活池地址（收款池；生效条件列「收」行，空不渲染）。 */
  sourcePoolAddress?: string;
  /** f0d5b6f：目标侧激活池地址（解付出款池；生效条件列「付」行，空不渲染）。 */
  targetPoolAddress?: string;
  /** 数据时间（毫秒时间戳）。 */
  syncTime: number;
}

/** 可申请视图行（全网生效对 + 两侧池开通态；缺侧灰化提示先开池）。 */
export interface EligiblePairRow {
  pairId: number;
  /** 无码行页面回落显示 pairId。 */
  pairCode: string;
  sourceTokenCode: string;
  sourceTokenNo: string;
  targetTokenCode: string;
  targetTokenNo: string;
  /** v2.3 并入的汇率字段（申请决策参考；展示口径同 PairRow）。 */
  baseRate: string | number | null;
  markupRate: string | number | null;
  userRate: string | number | null;
  /** 源侧 token 资金池已开通。 */
  sourcePooled: boolean;
  /** 目标侧 token 资金池已开通。 */
  targetPooled: boolean;
  /** 双侧池齐备才可申请（false 灰化「缺资金池」+tooltip）。 */
  eligible: boolean;
  defaultSplitRatio: string | number;
}

/**
 * 参与状态文案（源 STATUS_TEXT：5 申请中 / 15 已驳回 / 20 参与生效 /
 * 50 停用；未知码页面显原值）。与 split.model 的 SPLIT_PAIR_STATUS_LABEL
 * 同一后端码表同一译文——v1 时代「语义不同、禁复用名」的包袱在本次
 * 剪除后消除，pair 域收回正名命名。
 */
export const PAIR_STATUS_TEXT: Record<number, string> = {
  5: 'Pending',
  15: 'Rejected',
  20: 'Active',
  50: 'Disabled',
};

/**
 * 参与状态 → Badge variant（源 STATUS_TAG el-tag 色：5 warning / 15 danger /
 * 20 success / 50 info）。Badge 无 warning/success/info 变体，按 R1 映射先例：
 * warning→outline、danger→destructive、success→default、info→secondary；
 * 未知码兜底 secondary 由页面处理。
 */
export const PAIR_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  5: 'outline',
  15: 'destructive',
  20: 'default',
  50: 'secondary',
};
