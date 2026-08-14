/** 币种主数据模型（源 `api/currency.ts`，与后端 CurrencyRespVO 对齐）。 */
export interface CurrencyRow {
  currencyId: number;
  currencyCode: string;
  currencyName: string;
  decimalDigits: number;
  status: number;
  createTime: number;
}

export interface CurrencyListFilter {
  currencyCode?: string;
  status?: number;
}

export interface CurrencyListReq {
  pageNum: number;
  pageSize: number;
  filter: CurrencyListFilter;
}

/** currencyId 空=新建（即启用 status 20）；非空=编辑（currencyCode 不可改）。 */
export interface CurrencySaveReq {
  currencyId?: number;
  currencyCode: string;
  currencyName: string;
  decimalDigits: number;
}

export interface CurrencyToggleReq {
  currencyId: number;
}

/** 状态标签（源状态列复用 approval/status COMMON_STATUS_MAP；本域语义 20 启用 / 50 停用）。 */
export const CURRENCY_STATUS_LABEL: Record<number, string> = {
  20: '审核通过',
  50: '停用',
};
