/**
 * OverviewShell 的 Disable/Enable/Delete 二次确认 hook：确认框 state、写操作
 * mutations（useUpdateTDStatusMutation/useDeleteTDMutation）与 onOk 提交处理。
 * 源: overview-shell.tsx 179-206、487-522
 */
'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  useDeleteTDMutation,
  useUpdateTDStatusMutation,
} from '@myorg/modules/td-admin/data-access';

/** Disable/Enable 二次确认框 state（源 statusConfirm）。 */
export interface OverviewStatusConfirm {
  open: boolean;
  /** 目标 TD code 快照（提交 body.code）。 */
  code: string;
  /** 启用 1 / 禁用 0（源 enable: state===1 ? 0 : 1）。 */
  enable: number;
  /** title（Router_036 禁用 / Router_0003_6 启用）。 */
  title: string;
  /** content 文案（0044 禁用 / 0045 启用 / 0046 删除，已 replace name）。 */
  content: string;
  /** 提交后 toast 文案占位词（PUB_Submit / PUB_Delete）。 */
  toastWord: string;
}

/** Delete 二次确认框 state（源 deleteConfirm）。 */
export interface OverviewDeleteConfirm {
  open: boolean;
  /** 目标 TD code 快照。 */
  code: string;
  content: string;
}

/** 运营总览页主壳的 Disable/Enable/Delete 二次确认流程。 */
export function useOverviewConfirm(
  setActiveCode: React.Dispatch<React.SetStateAction<string | null>>,
) {
  const t = useTranslations('modules.tokenized-deposit');

  // ── Disable/Enable/Delete 二次确认（收口 td-14 gap，替代源 antd modal.confirm）──
  // code 在打开确认框时快照：对话框打开期间 applyList 可能 refetch，提交必须
  // 作用于确认时的目标，而非 refetch 后的 currentTd。
  const [statusConfirm, setStatusConfirm] =
    React.useState<OverviewStatusConfirm | null>(null);
  const [deleteConfirm, setDeleteConfirm] =
    React.useState<OverviewDeleteConfirm | null>(null);

  // ── 写操作 mutations（Disable/Enable/Delete）──
  const { mutateAsync: updateStatusAsync, isPending: statusPending } =
    useUpdateTDStatusMutation();
  const { mutateAsync: deleteAsync, isPending: deletePending } =
    useDeleteTDMutation();

  // ── Disable/Enable 提交（源 statusUpdateApi onOk 1937-1957）──
  // code 用确认框打开时的快照，不取 currentTd（refetch 后可能已换资产）。
  const handleStatusConfirm = React.useCallback(() => {
    const ctx = statusConfirm;
    if (!ctx?.code) return;
    setStatusConfirm((prev) => (prev ? { ...prev, open: false } : prev));
    void updateStatusAsync({ code: ctx.code, enable: ctx.enable })
      .then(() => {
        toast.success(t('PUB_Success').replace('****', ctx.toastWord));
      })
      .catch(() => {
        toast.error(t('td_toast_submit_failed'));
      });
  }, [statusConfirm, updateStatusAsync, t]);
  const handleStatusCancel = React.useCallback(() => {
    setStatusConfirm(null);
  }, []);

  // ── Delete 提交（源 deleteApi onOk 1969-1985）──
  const handleDeleteConfirm = React.useCallback(() => {
    const ctx = deleteConfirm;
    if (!ctx?.code) return;
    setDeleteConfirm(null);
    void deleteAsync({ code: ctx.code })
      .then(() => {
        toast.success(t('PUB_Success').replace('****', t('PUB_Delete')));
        // 源 setActiveKey(0) + getTilteList(0)：切回首项。
        setActiveCode(null);
      })
      .catch(() => {
        toast.error(t('td_toast_submit_failed'));
      });
  }, [deleteConfirm, deleteAsync, t]);
  const handleDeleteCancel = React.useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  return {
    statusConfirm,
    deleteConfirm,
    statusPending,
    deletePending,
    setStatusConfirm,
    setDeleteConfirm,
    handleStatusConfirm,
    handleStatusCancel,
    handleDeleteConfirm,
    handleDeleteCancel,
  };
}
