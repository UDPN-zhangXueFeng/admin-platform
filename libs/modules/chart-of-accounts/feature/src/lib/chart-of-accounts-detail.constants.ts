import type { CoaRow } from '@myorg/modules/chart-of-accounts/data-access';

/**
 * 详情页本地常量与 mock 数据。
 *
 * 1:1 迁移自源项目 `td-manage` 的 `view/constants.ts`。COA 树接口失败时
 * 回退到这里的 mock（`COA_ROWS` / `SECOND_BOOK_COA_ROWS`），与源项目 fallback 行为一致。
 * 每行注入 `id = key` 以满足 DataTable 契约。
 */

/** 操作类型：后端 code → 语义 key（Operation Records，预留）。 */
export const OPERATION_TYPE_RESPONSE_MAP: Record<number, string> = {
  1: 'create',
  2: 'update',
  3: 'activate',
  4: 'deactivate',
};

/** 账本 1（SC EUR）COA 树 mock。 */
export const COA_ROWS: CoaRow[] = [
  { id: 'section-assets', key: 'section-assets', rowType: 'section', sectionType: 'assets', actions: ['new-primary-account'] },
  { id: '1001', key: '1001', rowType: 'item', accountType: 'assets', depth: 0, accountCode: '1001', accountName: 'Fiat Reserves–EUR', description: 'Total fiat reserves backing stablecoin issuance.', balanceSide: 'Dr', allowPosting: true, status: 'active', actions: ['new-sub-account', 'edit', 'deactivate'] },
  { id: '1900', key: '1900', rowType: 'item', accountType: 'assets', depth: 0, accountCode: '1900', accountName: 'Other Assets', description: 'Assets not classified under specific categories.', balanceSide: 'Dr', allowPosting: false, status: 'active', actions: ['new-sub-account', 'edit', 'deactivate'] },
  { id: '1900.99', key: '1900.99', rowType: 'item', accountType: 'assets', depth: 1, accountCode: '1900.99', accountName: 'Suspense Account – Asset', description: 'Temporary asset account for pending or unreconciled transactions.', balanceSide: 'Dr', allowPosting: true, status: 'active', actions: ['new-sub-account', 'edit', 'deactivate'] },
  { id: 'section-liabilities', key: 'section-liabilities', rowType: 'section', sectionType: 'liabilities', actions: ['new-primary-account'] },
  { id: '2001', key: '2001', rowType: 'item', accountType: 'liabilities', depth: 0, accountCode: '2001', accountName: 'Unmint Stablecoins', description: 'Authorized but not yet minted stablecoins.', balanceSide: 'Cr', allowPosting: true, status: 'active', actions: ['new-sub-account', 'edit', 'deactivate'] },
  { id: '2002', key: '2002', rowType: 'item', accountType: 'liabilities', depth: 0, accountCode: '2002', accountName: 'Stablecoin in Respository', description: 'Minted stablecoins held in custody, not yet in circulation.', balanceSide: 'Cr', allowPosting: true, status: 'active', actions: ['new-sub-account', 'edit', 'deactivate'] },
  { id: '2003', key: '2003', rowType: 'item', accountType: 'liabilities', depth: 0, accountCode: '2003', accountName: 'Stablecoin in Circulation', description: 'Stablecoins issued and held by external parties.', balanceSide: 'Cr', allowPosting: true, status: 'active', actions: ['new-sub-account', 'edit', 'deactivate'] },
  { id: '2900', key: '2900', rowType: 'item', accountType: 'liabilities', depth: 0, accountCode: '2900', accountName: 'Other Liabilities', description: 'Liabilities not classified under specific categories.', balanceSide: 'Cr', allowPosting: false, status: 'active', actions: ['new-sub-account', 'edit', 'deactivate'] },
  { id: '2900.99', key: '2900.99', rowType: 'item', accountType: 'liabilities', depth: 1, accountCode: '2900.99', accountName: 'Suspense Account – Liability', description: 'Temporary liability account for pending or unreconciled transactions.', balanceSide: 'Cr', allowPosting: true, status: 'active', actions: ['new-sub-account', 'edit', 'deactivate'] },
];

/** 账本 2（TD HSB）COA 树 mock。 */
export const SECOND_BOOK_COA_ROWS: CoaRow[] = [
  { id: 'section-assets-td', key: 'section-assets-td', rowType: 'section', sectionType: 'assets', actions: ['new-primary-account'] },
  { id: '1011-td', key: '1011-td', rowType: 'item', accountType: 'assets', depth: 0, accountCode: '1011', accountName: 'Due from Core System', description: 'Total amount receivable from the core banking system.', balanceSide: 'Dr', allowPosting: true, status: 'active', actions: ['new-sub-account', 'edit', 'deactivate'] },
  { id: '1900-td', key: '1900-td', rowType: 'item', accountType: 'assets', depth: 0, accountCode: '1900', accountName: 'Other Assets', description: 'Assets not classified under specific categories.', balanceSide: 'Dr', allowPosting: false, status: 'active', actions: ['new-sub-account', 'edit', 'deactivate'] },
  { id: '1900.99-td', key: '1900.99-td', rowType: 'item', accountType: 'assets', depth: 1, accountCode: '1900.99', accountName: 'Suspense Account – Asset', description: 'Temporary asset account for pending or unreconciled transactions.', balanceSide: 'Dr', allowPosting: true, status: 'active', actions: ['new-sub-account', 'edit', 'deactivate'] },
  { id: 'section-liabilities-td', key: 'section-liabilities-td', rowType: 'section', sectionType: 'liabilities', actions: ['new-primary-account'] },
  { id: '2001-td', key: '2001-td', rowType: 'item', accountType: 'liabilities', depth: 0, accountCode: '2001', accountName: 'Unissued TDs', description: 'Total value of term deposits that have been authorized but not yet issued to customers.', balanceSide: 'Cr', allowPosting: true, status: 'active', actions: ['new-sub-account', 'edit', 'deactivate'] },
  { id: '2002-td', key: '2002-td', rowType: 'item', accountType: 'liabilities', depth: 0, accountCode: '2002', accountName: 'TD in Circulation', description: 'TDs issued and held by external parties.', balanceSide: 'Cr', allowPosting: true, status: 'active', actions: ['new-sub-account', 'edit', 'deactivate'] },
  { id: '2900-td', key: '2900-td', rowType: 'item', accountType: 'liabilities', depth: 0, accountCode: '2900', accountName: 'Other Liabilities', description: 'Liabilities not classified under specific categories.', balanceSide: 'Cr', allowPosting: false, status: 'active', actions: ['new-sub-account', 'edit', 'deactivate'] },
  { id: '2900.99-td', key: '2900.99-td', rowType: 'item', accountType: 'liabilities', depth: 1, accountCode: '2900.99', accountName: 'Suspense Account – Liability', description: 'Temporary liability account for pending or unreconciled transactions.', balanceSide: 'Cr', allowPosting: true, status: 'active', actions: ['new-sub-account', 'edit', 'deactivate'] },
];
