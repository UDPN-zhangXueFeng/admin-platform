/** LP 资金池（源 `api/lp-pool.ts`；rowKey=poolId，单币种钱包地址池）。 */

export interface LpPoolRow {
  poolId: number;
  lpId: number;
  lpName: string;
  currency: string;
  accountAddress: string;
  /** 币种体系：1=EVM, 2=Aptos, 3=内部（源 api/lp-pool.ts）。 */
  currencySystemType: number;
  minLimit: string | number;
  remindThreshold: string | number;
  availableBalanceCache: string | number;
  balanceUpdateTime: number | null;
  status: number;
  createTime: number;
}

/** 与后端 LpPoolSaveReqVO 对齐；poolId 空=新增，非空=编辑。 */
export interface LpPoolSaveReq {
  poolId?: number;
  lpId: number;
  currency: string;
  accountAddress: string;
  currencySystemType: number;
  minLimit: string | number;
  remindThreshold: string | number;
}

export interface LpPoolListFilter {
  lpId?: number;
  currency?: string;
  status?: number;
}

export interface LpPoolListReq {
  pageNum: number;
  pageSize: number;
  filter: LpPoolListFilter;
}

/** 资金池状态（save 直出 20=启用；50=停用）。 */
export const LP_POOL_STATUS_LABEL: Record<number, string> = {
  1: '草稿',
  20: '启用',
  50: '停用',
};

export const LP_POOL_STATUS_VARIANT: Record<
  number,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  1: 'outline',
  20: 'default',
  50: 'outline',
};

/** 币种体系（源 api/lp-pool.ts currencySystemType）。 */
export const CURRENCY_SYSTEM_TYPE_LABEL: Record<number, string> = {
  1: 'EVM',
  2: 'Aptos',
  3: '内部',
};

/**
 * 资金池选项（按 lpId 联动下拉；薄调用 POST /manage/lp-pool/list 行子集）。
 * 预授权/补资等子域共用此类型，避免 barrel 重导出同名冲突。
 */
export interface LpPoolOption {
  poolId: number;
  lpId: number;
  currency: string;
  accountAddress: string;
  status: number;
}
