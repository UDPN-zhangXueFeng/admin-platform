/**
 * Pagination types shared across all modules.
 */

/** Query parameters sent to paginated list endpoints. */
export interface PaginationParams {
  /** 1-based page number */
  page?: number;
  /** Items per page */
  pageSize?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/** Metadata returned alongside a paginated response. */
export interface PaginationMeta {
  /** Current page number (1-based) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
}
