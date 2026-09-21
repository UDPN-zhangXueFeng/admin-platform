import type { KissenResult } from './kissen-client';

/**
 * 源 `src/types/result.ts` 的 1:1 移植，供域 model/api 文件直接引用以保持命名一致。
 * 响应包体等价于 {@link KissenResult}。
 */
export type ResultInfo<T = unknown> = KissenResult<T>;

/** 分页请求页码（源 PageReq）。 */
export interface PageReq {
  pageNum: number;
  pageSize: number;
}

/** 分页请求体（源 DataTable<R> = { page, data }）。 */
export interface DataTable<R> {
  page: PageReq;
  data: R;
}

/** 分页响应（源 PageResult<T>）。 */
export interface PageResult<T> {
  rows: T[];
  page: { total: number };
}
