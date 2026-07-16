'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addAssetCategory,
  addReserveAsset,
  changeReserveAssetStatus,
  editReserveAsset,
  saveReserveAssetTx,
} from '../pledge.api';
import type {
  AddAssetCategoryReq,
  AddReserveAssetReq,
  AssetTransactionCreateReq,
  ChangeReserveAssetStatusReq,
  EditReserveAssetReq,
} from '../pledge.model';
import { pledgeKeys } from './pledge.keys';

/**
 * pledge TanStack Query mutations（写操作 hooks）。
 *
 * 对齐 cross-chain 模块模式：
 * - 写操作成功后 invalidate 对应域的列表查询，确保列表自动刷新。
 * - 调用方在 onSuccess 回调中执行 toast.success + router.push / close drawer。
 * - 不自动 toast/redirect —— 由调用方控制 UI 反馈。
 */

// ======================================================================
// 1. 新增储备资产
// ======================================================================

/**
 * 新增储备资产 mutation。
 * 成功后失效所有 reserveAsset 列表查询缓存（刷新列表）。
 *
 * 用法（Drawer 'new' onFinish）：
 * ```ts
 * const { mutate: add, isPending } = useAddReserveAssetMutation();
 * add(values, { onSuccess: () => { toast.success('ok'); closeDrawer(); } });
 * ```
 */
export function useAddReserveAssetMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, AddReserveAssetReq>({
    mutationFn: (dto) => addReserveAsset(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pledgeKeys.reserveAsset() });
    },
  });
}

// ======================================================================
// 2. 编辑储备资产（资产类别）
// ======================================================================

/**
 * 编辑储备资产 mutation（修改资产类别）。
 * 成功后失效所有 reserveAsset 查询缓存（刷新列表 + 详情）。
 *
 * 用法（Drawer 'edit' onFinish）：
 * ```ts
 * const { mutate: edit, isPending } = useEditReserveAssetMutation();
 * edit({ reserveAccountId, assetCategoryList }, { onSuccess: () => { toast.success('ok'); closeDrawer(); } });
 * ```
 */
export function useEditReserveAssetMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, EditReserveAssetReq>({
    mutationFn: (dto) => editReserveAsset(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pledgeKeys.reserveAsset() });
    },
  });
}

// ======================================================================
// 3. 启用/停用储备资产
// ======================================================================

/**
 * 启用/停用储备资产 mutation。
 * Deactivate 传 status=50，Activate 传 status=20。
 * 成功后失效所有 reserveAsset 列表查询缓存。
 *
 * 用法（列表行操作 Popconfirm confirm）：
 * ```ts
 * const { mutate: changeStatus, isPending } = useChangeReserveAssetStatusMutation();
 * changeStatus({ reserveAccountId, status: 50 }, { onSuccess: () => toast.success('ok') });
 * ```
 */
export function useChangeReserveAssetStatusMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, ChangeReserveAssetStatusReq>({
    mutationFn: (dto) => changeReserveAssetStatus(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pledgeKeys.reserveAsset() });
    },
  });
}

// ======================================================================
// 4. 新增资产类别
// ======================================================================

/**
 * 新增资产类别 mutation。
 * 成功后失效 assetCategoryList 缓存（刷新下拉） + reserveAsset 缓存（刷新详情）。
 *
 * 用法（asset-ategory 页 onFinish）：
 * ```ts
 * const { mutate: addCategory, isPending } = useAddAssetCategoryMutation();
 * addCategory(values, { onSuccess: () => { toast.success('ok'); router.push('/pledge/reserve-asset-list'); } });
 * ```
 */
export function useAddAssetCategoryMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, AddAssetCategoryReq>({
    mutationFn: (dto) => addAssetCategory(dto),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: pledgeKeys.assetCategoryList(),
      });
      void qc.invalidateQueries({ queryKey: pledgeKeys.reserveAsset() });
    },
  });
}

// ======================================================================
// 5. 新建储备资产交易
// ======================================================================

/**
 * 新建储备资产交易 mutation。
 * 参数以新版 SaveAssentTransactionReqVo 为准（assetTypeId/transactionAmount/transactionDirection/unit）。
 * 成功后失效 assetTxn 列表查询缓存。
 *
 * 用法（asset-transaction/edit 页 onFinish）：
 * ```ts
 * const { mutate: saveTx, isPending } = useSaveReserveAssetTxMutation();
 * saveTx(values, { onSuccess: () => { toast.success('ok'); router.push('/pledge/asset-transaction'); } });
 * ```
 */
export function useSaveReserveAssetTxMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, AssetTransactionCreateReq>({
    mutationFn: (dto) => saveReserveAssetTx(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pledgeKeys.assetTxn() });
    },
  });
}
