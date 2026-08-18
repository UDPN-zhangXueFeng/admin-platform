/**
 * LP Portal 公共类型（源 `src/types/{result,business,system}.ts` 1:1 平移）。
 *
 * - result.ts → 响应/分页信封（ResultInfo/PageInfo/DataTable/ResultData）
 * - business.ts → 六个只读业务页的行/筛选 VO（B 域 api 层直接引用）
 * - system.ts → 系统管理四页（user/role/menu/log）的行/请求 VO（C 域引用）
 *
 * 命名与字段保持源口径；跨域共享（如 tx-flow 与 chain-drawer 共用 TxChainNode、
 * pair 列表被 tx-flow 筛选复用）依赖此集中定义，勿下沉到单域 model。
 */
import type { LpResult } from './lp-client';

/** 统一响应包体（成功时 code === '0'；等价 lp-client 的 LpResult）。 */
export type ResultInfo<T = unknown> = LpResult<T>;

/** 分页请求页码（源 PageInfo）。 */
export interface PageInfo {
  pageNum: number;
  pageSize: number;
  total?: number;
}

/** 分页查询请求体：page + 查询条件 data（源 DataTable）。 */
export interface DataTable<R> {
  page: PageInfo;
  data: R;
}

/** 分页查询返回体（源 ResultData）。 */
export interface ResultData<T> {
  rows: T[];
  page: { total: number };
}

// ===== 业务读路径（源 types/business.ts；契约依据 spec M2a 及合并裁决 C-7/C-9/C-10/C-11） =====

// ===== 资金池(POST /lp/pool/list,不分页) =====

export interface PoolRow {
  poolId: number;
  currency: string;
  /** 账户地址,页面经 maskAddress 掩码展示 */
  accountAddress: string;
  /** 1 链上 EVM / 2 Aptos / 3 内部系统 */
  currencySystemType: number;
  minLimit: number;
  /** 水位提醒阈值(比率 0〜1,与 level 比较,非金额;裁决 C-8) */
  remindThreshold: number;
  availableBalanceCache: number;
  balanceUpdateTime: number;
  /** 水位 = 余额缓存 ÷ 最低限额,小数比率(如 0.2 即 20%);minLimit≤0 时为 null(裁决 C-7) */
  level: number | null;
  /** 20 正常 / 50 停用 */
  status: number;
}

// ===== 补资(POST /lp/topup/list,分页;默认按 declare_time 倒序,裁决 C-12) =====

export interface TopupListReq {
  poolId?: number;
  /** 1 已声明 / 2 已到账 / 3 失败 */
  status?: number;
  startTime?: number;
  endTime?: number;
}

export interface TopupRow {
  topupId: number;
  poolId: number;
  currency: string;
  amount: number;
  transferInAddress: string;
  declareTime: number;
  /** 0 = 未到账 */
  confirmTime: number;
  csTxId?: string;
  /** 1 已声明 / 2 已到账 / 3 失败 */
  status: number;
}

// ===== 汇率(POST /lp/rate/list,不分页) =====

export interface RateRow {
  pairId: number;
  sourceCurrency: string;
  targetCurrency: string;
  /** 基础汇率(原值直出;该货币对无汇率行时 baseRate/userRate/updateTime 均 null,后端 D-4) */
  baseRate: number | null;
  markupRate: number;
  /** 用户汇率 = 基础 × (1 + 加价率),api 侧计算 */
  userRate: number | null;
  /** 货币对状态 20 启用 / 50 停用 */
  pairStatus: number;
  updateTime: number | null;
  /** 本 LP 是否参与(参与置顶由前端做) */
  participated: boolean;
}

// ===== 货币对参与(POST /lp/pair/list,不分页) =====

export interface PairRow {
  pairId: number;
  sourceCurrency: string;
  targetCurrency: string;
  /** 参与状态 20 生效 / 50 停用(灰显) */
  participationStatus: number;
  /** 货币对状态 20 启用 / 50 停用 */
  pairStatus: number;
  /** 滑点阈值,空显 '-' */
  slippageThreshold?: number | null;
  /** 解付能力(api 侧判定 FR-P-10,前端只渲染) */
  capable: boolean;
}

// ===== 预授权项(pair-pool 聚合内嵌,与 pool/detail 同构) =====

export interface PreauthItem {
  preauthId: number;
  authAmount: number;
  usedAmount: number;
  /** 剩余 = 授权额度 减 已用 */
  remaining: number;
  validFrom: number;
  validTo: number;
  /** CommonStatusEnum:20 有效 / 50 已撤销 */
  status: number;
}

// ===== 货币对资金池聚合(POST /lp/pair-pool/list,不分页;裁决 C-9 以后端契约为准) =====

/** 源币种池;最近变动 = 该池最近一笔补资 */
export interface PairPoolSourcePool {
  poolId: number;
  currency: string;
  availableBalanceCache: number;
  balanceUpdateTime: number;
  /** 最近一笔补资;无则 null */
  lastTopup: {
    topupId: number;
    amount: number;
    declareTime: number;
    /** 1 已声明 / 2 已到账 / 3 失败 */
    status: number;
  } | null;
}

/** 目标币种池 */
export interface PairPoolTargetPool {
  poolId: number;
  currency: string;
  availableBalanceCache: number;
  minLimit: number;
  /** 水位提醒阈值(比率 0〜1,与 level 比较,非金额;裁决 C-8) */
  remindThreshold: number;
  /** 水位小数比率(如 0.2 即 20%);minLimit≤0 时 null(裁决 C-7) */
  level: number | null;
  balanceUpdateTime: number;
}

export interface PairPoolAgg {
  pairId: number;
  sourceCurrency: string;
  targetCurrency: string;
  /** 参与状态 20 生效 / 50 停用 */
  participationStatus: number;
  /** 源币种池;缺池(缺口 NO_POOL)时 null */
  sourcePool: PairPoolSourcePool | null;
  /** 目标币种池;缺池(缺口 NO_POOL)时 null */
  targetPool: PairPoolTargetPool | null;
  /** 目标币种预授权列表(裁决 C-9:数组,非单个 preauth) */
  preauths: PreauthItem[];
  /** 解付能力判定(api 算,前端只渲染) */
  capable: boolean;
  /** 缺口码:NO_POOL/NO_PREAUTH/PREAUTH_EXPIRED/QUOTA_INSUFFICIENT/LOW_LEVEL/PARTICIPATION_STOPPED(中文文案映射由前端承担,裁决 C-4) */
  gaps: string[];
}

// ===== 交易流水(POST /lp/tx-flow/list 分页;GET /lp/tx-flow/chain/{transactionId}) =====

export interface TxListReq {
  /** TransactionStatusEnum 13 值 */
  status?: number;
  pairId?: number;
  startTime?: number;
  endTime?: number;
}

export interface TxRow {
  transactionId: number;
  /** 交易业务单号,空显 '-' */
  txNo?: string;
  pairId: number;
  sourceCurrency: string;
  targetCurrency: string;
  principal: number;
  /** 1 已创建/5 已报价/10 已确认/20 源端划转中/25 源端已验证/30 解付中/35 已入账/40 已完成/50 冲正中/60 已冲正/70 异常/80 已取消/90 失败 */
  status: number;
  createTime: number;
  /** 0 = 未完成 */
  completedTime: number;
}

/**
 * 交易链路扁平节点(裁决 C-10:chain 响应即 TxFlowNodeVO[] 数组,非 stages+events 对象;
 * 字段以 kissen-api query/model/TxFlowNodeVO.java 为准,联调窗校准)
 */
export interface TxChainNode {
  flowId: number;
  parentFlowId: number | null;
  /** 1 环节 / 2 动作 / 3 报文 / 4 重试 */
  nodeType: number;
  step: number;
  /** 状态迁移起点,0 表示无 */
  statusFrom: number | null;
  /** 状态迁移终点,0 表示无 */
  statusTo: number | null;
  eventTime: number;
  operator?: string;
  csTxId?: string;
  remark?: string;
  traceId?: string;
}

// ===== 结算(POST /lp/settle/records、/lp/settle/orders,均分页) =====

/** records 筛选只留时间范围(records 表无周期列,cycle 不接线;裁决 C-1) */
export interface SettleRecordListReq {
  startTime?: number;
  endTime?: number;
}

/** 结算流水行(裁决 C-11:无周期字段) */
export interface SettleRecordRow {
  settleRecordId: number;
  transactionId: number;
  pairId: number;
  sourceCurrency: string;
  targetCurrency: string;
  principal: number;
  userDeduction: number;
  markupAmount: number;
  baseRate: number;
  markupRate: number;
  userRate: number;
  receiverAmount: number;
  adminSplitAmount: number;
  /** LP 分成(页面 key-figure 重点展示) */
  lpSplitAmount: number;
  /** 1 有效 / 45 作废 */
  status: number;
  createTime: number;
}

export interface SettleOrderListReq {
  /** 5/10 生成、15 拒绝、20 已确认、35 已结算(裁决 C-2;筛选选项 生成 5/已确认 20/已结算 35) */
  status?: number;
  /** 周期粒度 day/week/month,后端映射 period_type 1/2/3(裁决 C-1/D-7);空 = 全部 */
  cycle?: 'day' | 'week' | 'month';
  startTime?: number;
  endTime?: number;
}

export interface SettleOrderRow {
  orderId: number;
  /** 1 日 / 2 周 / 3 月 */
  periodType: number;
  periodStart: number;
  periodEnd: number;
  txCount: number;
  principalTotal: number;
  markupTotal: number;
  adminSplitTotal: number;
  /** LP 分成合计(页面 key-figure 重点展示) */
  lpSplitTotal: number;
  /** 5 生成(待审)/10 生成(审中)/15 拒绝/20 已确认/35 已结算(裁决 C-2) */
  status: number;
  createTime: number;
}

// ===== 系统管理域(源 types/system.ts;F2 用户/角色、F3 菜单/接口权限、F4 日志) =====

export interface UserListReq {
  loginName?: string;
  userName?: string;
  /** 0 正常 / 1 停用 */
  status?: number;
}

export interface UserRow {
  userId: number;
  loginName: string;
  userName: string;
  email?: string;
  phone?: string;
  /** 0 正常 / 1 停用 */
  status: number;
  /** 0=首登需改密 */
  firstLogin: number;
  createTime: number;
  /** 用户已分配角色(编辑弹窗与分配角色弹窗回显用) */
  roleIds?: number[];
}

export interface UserCreateReq {
  /** 全局唯一;lp_id 由后端按登录态强制注入,前端不传 */
  loginName: string;
  userName: string;
  email?: string;
  phone?: string;
  roleIds?: number[];
}

export interface UserUpdateReq {
  userId: number;
  /** loginName 不可改,后端不接收该字段 */
  userName?: string;
  email?: string;
  phone?: string;
  roleIds?: number[];
}

export interface UserAssignRoleReq {
  userId: number;
  roleIds: number[];
}

/** 用户新增/重置密码返回:一次性口令(首登强制改密) */
export interface OneTimePassword {
  userId: number;
  oneTimePassword: string;
}

export interface RoleListReq {
  roleCode?: string;
  roleName?: string;
  status?: number;
}

export interface RoleRow {
  roleId: number;
  roleCode: string;
  roleName: string;
  /** 0 内置 / 1 自定义 */
  roleType?: number;
  status: number;
  remarks?: string;
  createTime?: number;
}

export interface RoleSaveReq {
  /** 全局唯一(23_0005);role_type 后端固定 1 自定义 */
  roleCode: string;
  roleName?: string;
  remarks?: string;
}

export interface RoleUpdateReq {
  roleId: number;
  /** roleCode 不可改,后端不接收该字段 */
  roleName?: string;
  remarks?: string;
}

export interface RoleAssignMenuReq {
  roleId: number;
  /** 事务先删后插;空数组=清空授权 */
  menuIds: number[];
}

export interface MenuTree {
  menuId: number;
  menuName: string;
  menuNameEn?: string;
  menuKey: string;
  parentId?: number;
  /** 0 模块 / 1 系统 / 2 一级菜单 / 3 二级菜单 / 4 按钮 */
  menuType?: number;
  orderNum?: number;
  /** 0 显示 / 1 隐藏 */
  visible?: number;
  menuUrl?: string;
  icon?: string;
  children?: MenuTree[];
}

export interface MenuSaveReq {
  menuName: string;
  menuNameEn: string;
  /** 全局唯一(23_0021) */
  menuKey: string;
  parentId?: number;
  menuType?: number;
  orderNum?: number;
  visible?: number;
  menuUrl?: string;
  icon?: string;
}

export interface MenuUpdateReq {
  menuId: number;
  /** menuKey/menuType/parentId 不可改,后端不接收;null 字段不更新 */
  menuName?: string;
  menuNameEn?: string;
  orderNum?: number;
  visible?: number;
  menuUrl?: string;
  icon?: string;
}

/** 后端 MenuPermissionRespVO(/lp/menu-permission/list 返回行) */
export interface MenuPermissionRow {
  menuPermissionId: number;
  menuId: number;
  menuKey: string;
  resourceUrl: string;
  httpMethod: string;
  resourceType?: number;
  permissionType?: number;
}

/** 前端权限行(api/menu-permission.ts list 映射结果;无 id=本地新增未保存行) */
export interface MenuPermissionItem {
  id?: number;
  menuKey: string;
  url: string;
  /** GET/POST/PUT/DELETE,空=不限 */
  httpMethod?: string;
}

/** 后端 MenuPermissionSaveReqVO:逐行写入(后端仅 insert,无删除端点) */
export interface MenuPermissionSaveReq {
  menuId: number;
  resourceUrl: string;
  httpMethod?: string;
  permissionType?: number;
}

export interface LogListReq {
  module?: string;
  operateName?: string;
  startTime?: number;
  endTime?: number;
}

export interface LogRow {
  operateLogId: number;
  module: string;
  /** 1 新增 / 2 修改 / 3 删除 / 4 登录 / 5 其他 */
  businessType?: number;
  operateName?: string;
  operateUrl?: string;
  operateParam?: string;
  /** 0 正常 / 1 异常 */
  status: number;
  errorMsg?: string;
  operateTime?: number;
  costTime?: number;
  traceId?: string;
}
