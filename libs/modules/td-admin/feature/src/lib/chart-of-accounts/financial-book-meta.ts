/**
 * Legacy Financial Book metadata fixtures migrated from `td-manage`.
 *
 * Basic Information now comes from `useCoaBasicInfoQuery(financeBookId)`; do not use
 * these sample values for detail labels or currency. Current callers retain the
 * fixture ID for the legacy EOD column selection and detail URL. An unmatched live
 * `bookNo` falls back to the first fixture, which is not an authoritative layout
 * mapping; confirm the backend/product rule before changing that behavior.
 */

export interface FinancialBookMeta {
  id: string;
  bookId: string;
}

export const FINANCIAL_BOOK_METAS: FinancialBookMeta[] = [
  { id: '1', bookId: 'FB-SC-EUR-202604-001' },
  { id: '2', bookId: 'FB-TD-HKD-202604-001' },
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
