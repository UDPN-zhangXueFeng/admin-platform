'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getLeafAccounts,
  getReserveAssetList,
  getReserveBasicDetail,
  getReserveInvestigationList,
  getReserveList,
  getReserveReconLog,
  getTokenBasicDetail,
  getTokenList,
  getTxInvestigationList,
  getTxList,
  getTxReconLog,
} from '../reconciliation.api';
import type {
  ReconciliationListParams,
  ReconciliationListResponse,
  ReserveAssetBasicDetailReqVo,
  ReserveAssetBasicDetailRespVo,
  ReserveAssetListReqVo,
  ReserveAssetSummaryRespVo,
  ReserveReconDetailRespVo,
  ReserveReconListReqVo,
  ReserveReconLogReqVo,
  ReserveReconLogRespVo,
  TokenReconBasicDetailReqVo,
  TokenReconBasicDetailRespVo,
  TokenReconListReqVo,
  TokenReconSummaryRespVo,
  TxReconDetailRespVo,
  TxReconListReqVo,
  TxReconLogReqVo,
  TxReconLogRespVo,
  LeafAccountsReqVo,
  LeafAccountsRespVo,
} from '../reconciliation.model';
import { reconciliationKeys } from './reconciliation.keys';

// ── Real-time 列表（服务端分页，keepPreviousData 平滑翻页） ────────────────────

/** Token 对账汇总列表（real-time 列表页）。 */
export function useTokenListQuery(
  params: ReconciliationListParams<TokenReconListReqVo>,
) {
  return useQuery<ReconciliationListResponse<TokenReconSummaryRespVo>>({
    queryKey: reconciliationKeys.tokenList(params),
    queryFn: () => getTokenList(params),
    placeholderData: keepPreviousData,
  });
}

/** Tx 明细列表（real-time 详情页 Reconciliation List Tab）。 */
export function useTxListQuery(
  params: ReconciliationListParams<TxReconListReqVo>,
) {
  return useQuery<ReconciliationListResponse<TxReconDetailRespVo>>({
    queryKey: reconciliationKeys.txList(params),
    queryFn: () => getTxList(params),
    placeholderData: keepPreviousData,
  });
}

/**
 * Tx investigation 列表（real-time 详情页 Investigation Tab）。
 *
 * 保留旧系统语义（R2）：后端返回全集，前端 `select` 二次过滤
 * `reconciliationStatus===3` 并重算 `total`，避免角标/分页不符。
 */
export function useTxInvestigationListQuery(
  params: ReconciliationListParams<TxReconListReqVo>,
) {
  return useQuery<ReconciliationListResponse<TxReconDetailRespVo>>({
    queryKey: reconciliationKeys.txInvestigation(params),
    queryFn: () => getTxInvestigationList(params),
    placeholderData: keepPreviousData,
    select: (data) => {
      const filtered = (data.rows ?? []).filter(
        (r) => r.reconciliationStatus === 3,
      );
      return {
        page: { ...data.page, total: filtered.length },
        rows: filtered,
      };
    },
  });
}

// ── Real-time 单对象（enabled by id） ─────────────────────────────────────────

/** Token 基本信息（real-time 详情页顶部）。`tokenId` 缺失时不发起请求。 */
export function useTokenBasicDetailQuery(
  tokenId: number | undefined,
  enabled = true,
) {
  return useQuery<TokenReconBasicDetailRespVo>({
    queryKey:
      tokenId != null
        ? reconciliationKeys.tokenBasicDetail(tokenId)
        : reconciliationKeys.all,
    queryFn: () =>
      getTokenBasicDetail({ tokenId: tokenId as number } as TokenReconBasicDetailReqVo),
    enabled: enabled && tokenId != null,
  });
}

/** Tx 对账日志（ReconLogModal / PostToSuspenseModal 回显）。 */
export function useTxReconLogQuery(
  reconciliationTxId: number | undefined,
  enabled = true,
) {
  return useQuery<TxReconLogRespVo>({
    queryKey:
      reconciliationTxId != null
        ? reconciliationKeys.txReconLog(reconciliationTxId)
        : reconciliationKeys.all,
    queryFn: () =>
      getTxReconLog({
        reconciliationTxId: reconciliationTxId as number,
      } as TxReconLogReqVo),
    enabled: enabled && reconciliationTxId != null,
  });
}

// ── 跨域共享（末级科目，reserve ReservePostToSuspenseModal 也调） ──────────────

/** 末级科目（Debit/Credit），`financeBookId` 缺失时不发起请求。 */
export function useLeafAccountsQuery(
  financeBookId: number | undefined,
  enabled = true,
) {
  return useQuery<LeafAccountsRespVo>({
    queryKey:
      financeBookId != null
        ? reconciliationKeys.leafAccounts(financeBookId)
        : reconciliationKeys.all,
    queryFn: () =>
      getLeafAccounts({
        financeBookId: financeBookId as number,
      } as LeafAccountsReqVo),
    enabled: enabled && financeBookId != null,
  });
}

// ── Reserve 列表 ─────────────────────────────────────────────────────────────────

/** 储备资产汇总列表（reserve 列表页）。 */
export function useReserveAssetListQuery(
  params: ReconciliationListParams<ReserveAssetListReqVo>,
) {
  return useQuery<ReconciliationListResponse<ReserveAssetSummaryRespVo>>({
    queryKey: reconciliationKeys.reserveAssetList(params),
    queryFn: () => getReserveAssetList(params),
    placeholderData: keepPreviousData,
  });
}

/** Reserve 明细列表（reserve 详情页 Reconciliation List Tab）。 */
export function useReserveListQuery(
  params: ReconciliationListParams<ReserveReconListReqVo>,
) {
  return useQuery<ReconciliationListResponse<ReserveReconDetailRespVo>>({
    queryKey: reconciliationKeys.reserveList(params),
    queryFn: () => getReserveList(params),
    placeholderData: keepPreviousData,
  });
}

/**
 * Reserve investigation 列表（reserve 详情页 Investigation Tab）。
 *
 * 与 real-time 不同（R2 语义分叉）：reserve **不在前端二次过滤**，
 * 直接展示后端返回。
 */
export function useReserveInvestigationListQuery(
  params: ReconciliationListParams<ReserveReconListReqVo>,
) {
  return useQuery<ReconciliationListResponse<ReserveReconDetailRespVo>>({
    queryKey: reconciliationKeys.reserveInvestigation(params),
    queryFn: () => getReserveInvestigationList(params),
    placeholderData: keepPreviousData,
  });
}

// ── Reserve 单对象（enabled by id） ───────────────────────────────────────────

/** 储备资产基本信息（reserve 详情页顶部）。 */
export function useReserveBasicDetailQuery(
  reserveAccountId: number | undefined,
  enabled = true,
) {
  return useQuery<ReserveAssetBasicDetailRespVo>({
    queryKey:
      reserveAccountId != null
        ? reconciliationKeys.reserveBasicDetail(reserveAccountId)
        : reconciliationKeys.all,
    queryFn: () =>
      getReserveBasicDetail({
        reserveAccountId: reserveAccountId as number,
      } as ReserveAssetBasicDetailReqVo),
    enabled: enabled && reserveAccountId != null,
  });
}

/** Reserve 对账日志（ReserveReconLogModal 回显）。 */
export function useReserveReconLogQuery(
  reconciliationReserveId: number | undefined,
  enabled = true,
) {
  return useQuery<ReserveReconLogRespVo>({
    queryKey:
      reconciliationReserveId != null
        ? reconciliationKeys.reserveReconLog(reconciliationReserveId)
        : reconciliationKeys.all,
    queryFn: () =>
      getReserveReconLog({
        reconciliationReserveId: reconciliationReserveId as number,
      } as ReserveReconLogReqVo),
    enabled: enabled && reconciliationReserveId != null,
  });
}
