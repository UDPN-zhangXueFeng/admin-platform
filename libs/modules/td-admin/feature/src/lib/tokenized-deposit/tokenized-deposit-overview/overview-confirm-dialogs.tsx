/**
 * OverviewShell 的 Disable/Enable 与 Delete 二次确认 AlertDialog（收口 td-14 gap，
 * 替代源 antd modal.confirm）。确认 state 与提交回调由 OverviewShell 注入。
 * 源: overview-shell.tsx 719-768
 */
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@myorg/shared/ui';
import type {
  OverviewDeleteConfirm,
  OverviewStatusConfirm,
} from './use-overview-confirm';

interface OverviewConfirmDialogsProps {
  statusConfirm: OverviewStatusConfirm | null;
  deleteConfirm: OverviewDeleteConfirm | null;
  statusPending: boolean;
  deletePending: boolean;
  handleStatusConfirm: () => void;
  handleStatusCancel: () => void;
  handleDeleteConfirm: () => void;
  handleDeleteCancel: () => void;
}

/** 渲染 Disable/Enable 与 Delete 二次确认框。 */
export function OverviewConfirmDialogs({
  statusConfirm,
  deleteConfirm,
  statusPending,
  deletePending,
  handleStatusConfirm,
  handleStatusCancel,
  handleDeleteConfirm,
  handleDeleteCancel,
}: OverviewConfirmDialogsProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  return (
    <>
      {/* Disable/Enable 二次确认（收口 td-14 gap，替代源 antd modal.confirm） */}
      <AlertDialog
        open={statusConfirm?.open ?? false}
        onOpenChange={(next) => {
          if (!next) handleStatusCancel();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{statusConfirm?.title ?? ''}</AlertDialogTitle>
            <AlertDialogDescription>
              {statusConfirm?.content ?? ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStatusCancel}>
              {t('PUB_Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={statusPending}
              onClick={handleStatusConfirm}
            >
              {t('PUB_Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete 二次确认（源 deleteApi + setActiveKey(0)） */}
      <AlertDialog
        open={deleteConfirm?.open ?? false}
        onOpenChange={(next) => {
          if (!next) handleDeleteCancel();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('PUB_Delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.content ?? ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>
              {t('PUB_Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePending}
              onClick={handleDeleteConfirm}
            >
              {t('PUB_Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
