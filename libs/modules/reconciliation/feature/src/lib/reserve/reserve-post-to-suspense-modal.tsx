'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@myorg/shared/ui';
import {
  EMPTY_FIELD_VALUE,
} from '@myorg/modules/reconciliation/util';
import { ReservePostToSuspenseModalContent } from './reserve-post-to-suspense-modal-content';

// ── Props ──────────────────────────────────────────────────────────────────────

export interface ReservePostToSuspenseModalProps {
  open: boolean;
  reconciliationReserveId: number | undefined;
  /** 末级科目接口入参（使用 reserve detail context 中的 financeBookId / bookNo）。 */
  financeBookId?: number;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ── 组件 ───────────────────────────────────────────────────────────────────────

/**
 * ReservePostToSuspenseModal — 储备资产挂账提交 Drawer 外壳。
 *
 * 迁移自 td-manage `reconciliation/reserve/ReservePostToSuspenseModal.tsx`（629 行）。
 * 内部逻辑（回显 / 可编辑分录表 / 借贷平衡 / 提交）见 content 子组件。
 *
 * ⚠️ R1: 后端 reserve 挂账端点尚未就绪，此组件实现但不接入详情页。
 *   待后端端点就绪后移除 feature-flag 即可启用。
 */
export function ReservePostToSuspenseModal({
  open,
  reconciliationReserveId,
  financeBookId,
  onOpenChange,
  onSuccess,
}: ReservePostToSuspenseModalProps) {
  const t = useTranslations('modules.reconciliation');

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex max-w-[960px] flex-col p-0">
        <DrawerHeader className="border-b">
          <DrawerTitle>{t('reconciliation_0095')}</DrawerTitle>
          <DrawerDescription>
            {t('reconciliation_0133')}: {EMPTY_FIELD_VALUE}
          </DrawerDescription>
        </DrawerHeader>

        {/* open 时才渲染 content：挂载 useSWR 查询与 useEffect 初始化，避免未打开时拉数据 */}
        {open ? (
          <ReservePostToSuspenseModalContent
            reconciliationReserveId={reconciliationReserveId}
            financeBookId={financeBookId}
            onOpenChange={onOpenChange}
            onSuccess={onSuccess}
          />
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
