'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getAssetCategoryList,
  getBankList,
  getCurrencyList,
  getOperateRecordListPage,
  getReserveAssetDetail,
  getReserveAssetListPage,
  getReserveAssetOptions,
  getReserveAssetTxList,
} from '../pledge.api';
import type {
  AssetCategoryListQuery,
  AssetCategoryOption,
  BankOption,
  CurrencyOption,
  OperateRecordQuery,
  OperateRecordResponse,
  ReserveAssetDetail,
  ReserveAssetListQuery,
  ReserveAssetListResponse,
  ReserveAssetOptionList,
  ReserveAssetTxnListQuery,
  ReserveAssetTxnListResponse,
} from '../pledge.model';
import { pledgeKeys } from './pledge.keys';

/**
 * pledge TanStack Query hooks（只读查询）。
 *
 * 对齐 cross-chain 模块模式：
 * - 列表查询用 `placeholderData: keepPreviousData` 避免翻页闪白。
 * - 详情用 `enabled` 守卫，id 为空时不发起请求。
 * - 下拉用 `staleTime: 5 分钟` 减少重复请求 + `select` 过滤非数组/null。
 */

/** 过滤下拉数据：后端可能返回非数组或含 null 项，统一在 query 层过滤。 */
function filterDropdown<T>(data: unknown): T[] {
  return Array.isArray(data) ? data.filter((o): o is T => o != null) : [];
}

// ======================================================================
// 1. 储备资产列表
// ======================================================================

/**
 * 储备资产分页列表查询。
 * pageNum/pageSize 在 params 中（API 层组装到 body.page）。
 * bookStatus 透传到 API 层 data，前端过滤逻辑在页面层 query select 实现。
 */
export function useReserveAssetListQuery(params: ReserveAssetListQuery) {
  return useQuery<ReserveAssetListResponse>({
    queryKey: pledgeKeys.reserveAssetList(params),
    queryFn: ({ signal }) => getReserveAssetListPage(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

// ======================================================================
// 2. 储备资产交易列表
// ======================================================================

/**
 * 储备资产交易分页列表查询。
 * 列表页 + 详情 Asset Transactions Tab 共用。
 */
export function useReserveAssetTxListQuery(params: ReserveAssetTxnListQuery) {
  return useQuery<ReserveAssetTxnListResponse>({
    queryKey: pledgeKeys.assetTxnList(params),
    queryFn: ({ signal }) => getReserveAssetTxList(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

// ======================================================================
// 3. 详情
// ======================================================================

/**
 * 储备资产详情查询。
 * reserveAccountId 缺失时不发起请求。
 */
export function useReserveAssetDetailQuery(
  reserveAccountId: number | undefined,
  enabled = true,
) {
  return useQuery<ReserveAssetDetail>({
    queryKey: pledgeKeys.reserveAssetDetail(reserveAccountId ?? ''),
    queryFn: ({ signal }) => {
      // enabled 守卫确保此处 reserveAccountId 非空
      if (reserveAccountId == null) {
        throw new Error('reserveAccountId is required');
      }
      return getReserveAssetDetail(
        { reserveAccountId },
        { signal },
      );
    },
    enabled: enabled && reserveAccountId != null && reserveAccountId > 0,
  });
}

// ======================================================================
// 4. 操作记录（详情页 Tab）
// ======================================================================

/**
 * 操作记录分页列表查询。
 * operateType = 0 时 API 层转空串 ''（后端约定）。
 */
export function useOperateRecordListQuery(params: OperateRecordQuery) {
  return useQuery<OperateRecordResponse>({
    queryKey: pledgeKeys.operateRecordList(params),
    queryFn: ({ signal }) => getOperateRecordListPage(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

// ======================================================================
// 5. 下拉数据源
// ======================================================================

/**
 * 储备资产下拉（新建交易页选项源，无分页全量）。
 * staleTime 5 分钟。
 */
export function useReserveAssetOptionsQuery() {
  return useQuery<ReserveAssetOptionList>({
    queryKey: pledgeKeys.assetOptions(),
    queryFn: ({ signal }) => getReserveAssetOptions({ signal }),
    staleTime: 5 * 60 * 1000,
    select: (data) => filterDropdown<ReserveAssetOptionList[number]>(data),
  });
}

/**
 * 资产类别下拉列表。
 * 多页共用：reserveAccountId + state 参数控制。
 * staleTime 5 分钟。
 */
export function useAssetCategoryListQuery(params: AssetCategoryListQuery = {}) {
  return useQuery<AssetCategoryOption[]>({
    queryKey: pledgeKeys.assetCategoryList(params),
    queryFn: ({ signal }) => getAssetCategoryList(params, { signal }),
    staleTime: 5 * 60 * 1000,
    select: (data) => filterDropdown<AssetCategoryOption>(data),
  });
}

/**
 * Currency 下拉。
 * GET 请求，staleTime 5 分钟。
 */
export function useCurrencyListQuery() {
  return useQuery<CurrencyOption[]>({
    queryKey: pledgeKeys.currencyDropdown(),
    queryFn: ({ signal }) => getCurrencyList({ signal }),
    staleTime: 5 * 60 * 1000,
    select: (data) => filterDropdown<CurrencyOption>(data),
  });
}

/**
 * Bank 下拉。
 * GET 请求，staleTime 5 分钟。
 */
export function useBankListQuery() {
  return useQuery<BankOption[]>({
    queryKey: pledgeKeys.bankDropdown(),
    queryFn: ({ signal }) => getBankList({ signal }),
    staleTime: 5 * 60 * 1000,
    select: (data) => filterDropdown<BankOption>(data),
  });
}
