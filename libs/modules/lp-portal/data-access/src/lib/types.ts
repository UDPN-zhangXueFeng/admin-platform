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

// ===== Token 总览(POST /lp/token/list、GET /lp/token/bank-group,全局域本地副本) =====

export interface TokenRow {
  tokenId: number;
  tokenNo: string;
  tokenCode: string;
  tokenName: string;
  symbol: string;
  decimalDigits: number;
  chainType: string;
  anchorFiat: string;
  minLiquidity: string | number;
  bankId: number;
  bankCode: string;
  bankName: string;
  /** 本 LP 已开池(status=20)标注 */
  pooled: boolean;
  syncTime: number;
}

export interface BankGroupRow {
  bankId: number;
  bankCode: string;
  bankName: string;
  bankStatus: number;
  tokens: Array<
    Pick<
      TokenRow,
      | 'tokenId'
      | 'tokenNo'
      | 'tokenCode'
      | 'symbol'
      | 'chainType'
      | 'anchorFiat'
    >
  >;
}

// ===== 资金池(POST /lp/pool/list,不分页;v2 源本地副本,水位/状态随行下发) =====

export interface PoolRow {
  poolId: number;
  tokenId: number;
  tokenNo: string;
  tokenCode: string;
  bankCode: string;
  /** v2.4：Token 列第二行（bankName 缺失回退 bankCode） */
  bankName?: string;
  /** 池地址,页面经 maskAddress 掩码展示 */
  poolAddress: string;
  /** 5 申请中 / 15 已驳回 / 20 已开通 / 50 停用 */
  status: number;
  /** 驳回原因(status=15 时状态格 tooltip 展示) */
  rejectReason: string;
  availableBalanceCache: string | number;
  balanceUpdateTime: number | null;
  /** 水位小数比率字符串(如 "0.2");分母(最低流动性)缺失时 null */
  level: string | null;
  /** v2.4：授权额度（该池最新预授权快照；null=无快照，显 '-' 带 tooltip） */
  preauthAuthAmount?: string | number | null;
  /** v2.4：可用授权额度（同 null 语义） */
  preauthAvailableAmount?: string | number | null;
  syncTime: number;
}


// ===== 交易流水(POST /lp/tx-flow/list 分页;GET /lp/tx-flow/chain/{transactionId};
// v2.3 e591f85 行 VO:txUuid/txNo/receiverAmount/failReason/sourceCsTxId/
// sourceVerifiedTime/quoteTime,方向列换 source/targetTokenCode) =====

export interface TxListReq {
  /** TransactionStatusEnum 13 值 */
  status?: number;
  /** 货币对编码（如 PR-xxxx），源 types/business.ts TxListReq.pairCode */
  pairCode?: string;
  startTime?: number;
  endTime?: number;
}

export interface TxRow {
  transactionId: number;
  /** 银行幂等号（抽屉「Bank Idempotency No.」项；v2.3） */
  txUuid?: string;
  /**
   * 全网唯一交易业务单号（KSN 单号；v2.3 固定口径：列表/抽屉/split 明细/
   * settle 流水一律 `txNo || '-'`，不再回退 txUuid/transactionId）。
   */
  txNo?: string;
  pairId: number;
  /** 货币对编码（如 PR-xxxx）；空显 '-' */
  pairCode?: string;
  sourceTokenCode: string;
  targetTokenCode: string;
  principal: string | number;
  /** 收款方到账金额（v2.3 列表列） */
  receiverAmount?: string | number;
  /** v2.4 用户汇率（成交快照；0/null = 无快照显 '-'，非零 en-US 千分位 max 8 位小数） */
  userRate?: string | number | null;
  /** v2.4 From 钱包（源端账户；存量行为空串显 '-'，等宽截断+tooltip 原文） */
  senderAccount?: string;
  /** v2.4 To 钱包（收款方账户；同上） */
  receiverAccount?: string;
  /** 1 已创建/5 已报价/10 已确认/20 源端划转中/25 源端已验证/30 解付中/35 已入账/40 已完成/50 冲正中/60 已冲正/70 异常/80 已取消/90 失败 */
  status: number;
  /** 失败原因（status=70/90 时状态格 tooltip 展示） */
  failReason?: string;
  /** 源端凭证号（v2.3 抽屉项；空显 '-'） */
  sourceCsTxId?: string;
  /** 源端验证时间（毫秒时间戳；v2.3） */
  sourceVerifiedTime?: number;
  /** 报价时间（毫秒时间戳；v2.3 抽屉项；!quoteTime → '-'） */
  quoteTime?: number;
  createTime: number;
  /** 0 = 未完成 */
  completedTime: number;
  /** 数据时间（毫秒时间戳；v2.3） */
  syncTime?: number;
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

// ===== 结算(POST /lp/settle/orders 分页 + POST /lp/settle/order-records;
// v2.4 6c49396：records 独立分页端点退役，流水按结算单周期过滤随抽屉拉取) =====

/** 结算流水行（split-settle 合并页抽屉「结算流水」表行；v2.4 增 currency）。 */
export interface SettleRecordRow {
  /** 全网唯一交易单号（KSN 单号；未同步到流水副本的记录空串显 '-'） */
  txNo?: string;
  /** 货币对编码；空值页面显 '-' */
  pairCode?: string;
  /** v2.4 分成币种（源端 token symbol 优先回退 code）；空显 '-' */
  currency?: string;
  principal: string | number;
  markupAmount: string | number;
  /** 分成比例（0〜1，页面 ×100 显 %） */
  splitRatio: string | number | null;
  lpSplitAmount: string | number;
  /** 完成时间（毫秒时间戳） */
  completedTime: number;
}

/** 结算单分项（SettleOrderRow.items 元素；v2.4 增 currency）。 */
export interface SettleOrderItem {
  pairCode: string;
  /** v2.4 该分项币种（源端 token）；空显 '-' */
  currency?: string;
  txCount: number;
  principalTotal: string | number;
  markupTotal: string | number;
  lpSplitTotal: string | number;
}

export interface SettleOrderRow {
  orderId: number;
  /** 1 日 / 2 周 / 3 月 */
  periodType: number;
  periodStart: number;
  periodEnd: number;
  txCount: number;
  principalTotal: string | number;
  markupTotal: string | number;
  kissenSplitTotal: string | number;
  /** LP 分成合计 */
  lpSplitTotal: string | number;
  /** 10 待确认 / 20 已确认 / 35 已结算 / 45 已作废重开 */
  status: number;
  /** token 对分项（详情抽屉直读，非二次请求） */
  items: SettleOrderItem[];
  /** v2.4 单据涉及币种集合（'A / B'）；跨币种金额不可加总，单据层不展示金额合计 */
  currencies: string;
  syncTime: number;
}

export interface SettleOrderListReq {
  periodType?: number;
  status?: number;
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
