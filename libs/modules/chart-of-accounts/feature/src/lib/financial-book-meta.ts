/**
 * Financial Book 本地映射。
 *
 * 1:1 迁移自源项目 `td-manage` 的 `src/lib/financial/financial-book-meta.ts`。
 * 当前目标项目尚无等价后端接口，故保留本地映射；接入后端后替换为 API 查询即可。
 * 列表页操作跳转用 `getFinancialBookMetaByBookId` 取详情所需 `id`；
 * 详情页 Basic Information tab 用同份数据展示。
 */

export interface FinancialBookTokenMeta {
  name: string;
  symbol: string;
  blockchain: string;
  displayName: string;
}

export interface FinancialBookMeta {
  id: string;
  financialBookName: string;
  bookId: string;
  reserveAssetName: string;
  currency: string;
  tokenType: number;
  tokenName: string;
  tokenSymbol: string;
  blockchain: string;
  tokens: string[];
  tokenDetails: FinancialBookTokenMeta[];
  createdBy: string;
  createdOn: string;
  eodCutoffTime: string;
  lastEodPostingRun: string;
  lastEodPostingRunTimestamp: number;
}

export const FINANCIAL_BOOK_METAS: FinancialBookMeta[] = [
  {
    id: '1',
    financialBookName: 'SC EUR Financial Book',
    bookId: 'FB-SC-EUR-202604-001',
    reserveAssetName: 'EUR Reserve Asset',
    currency: 'EUR',
    tokenType: 1,
    tokenName: 'SCEURCoin',
    tokenSymbol: 'SCEUR',
    blockchain: 'Hyperledger Besu',
    tokens: ['ABCoin (Besu)', 'EURCoin (Besu)'],
    tokenDetails: [
      {
        name: 'ABCoin',
        symbol: 'ABC',
        blockchain: 'Hyperledger Besu',
        displayName: 'ABCoin (Besu)',
      },
      {
        name: 'EURCoin',
        symbol: 'EURC',
        blockchain: 'Hyperledger Besu',
        displayName: 'EURCoin (Besu)',
      },
    ],
    createdBy: 'chris',
    createdOn: 'Mar 9, 2026, 11:23:12 (UTC+8)',
    eodCutoffTime: '18:00:00 (UTC+8)',
    lastEodPostingRun: 'Apr 13, 2026, 19:00:00 (UTC+8)',
    lastEodPostingRunTimestamp: new Date('2026-04-13T19:00:00+08:00').getTime(),
  },
  {
    id: '2',
    financialBookName: 'TD HSB Financial Book',
    bookId: 'FB-TD-HKD-202604-001',
    reserveAssetName: 'N/A',
    currency: 'HKD',
    tokenType: 5,
    tokenName: 'HSBCoin',
    tokenSymbol: 'HSBC',
    blockchain: 'Polygon',
    tokens: ['HSBCoin (Polygon)'],
    tokenDetails: [
      {
        name: 'HSBCoin',
        symbol: 'HSBC',
        blockchain: 'Polygon',
        displayName: 'HSBCoin (Polygon)',
      },
    ],
    createdBy: 'chris',
    createdOn: 'Mar 9, 2026, 10:23:12 (UTC+8)',
    eodCutoffTime: '18:00:00 (UTC+8)',
    lastEodPostingRun: 'Apr 13, 2026, 19:00:00 (UTC+8)',
    lastEodPostingRunTimestamp: new Date('2026-04-13T19:00:00+08:00').getTime(),
  },
];

const DEFAULT_BOOK_META = FINANCIAL_BOOK_METAS[0];

export const getFinancialBookMetaById = (id?: string): FinancialBookMeta => {
  if (!id) {
    return DEFAULT_BOOK_META;
  }

  return FINANCIAL_BOOK_METAS.find((item) => item.id === id) || DEFAULT_BOOK_META;
};

export const getFinancialBookMetaByBookId = (bookId?: string): FinancialBookMeta => {
  if (!bookId) {
    return DEFAULT_BOOK_META;
  }

  return (
    FINANCIAL_BOOK_METAS.find((item) => item.bookId === bookId) || DEFAULT_BOOK_META
  );
};
