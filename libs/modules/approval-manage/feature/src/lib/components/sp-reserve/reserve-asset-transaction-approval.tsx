'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import {
  ApprovalDetailGrid,
  type ApprovalDetailSection,
  ApprovalStatusBadge,
  type ApprovalComponentProps,
} from '@myorg/modules/approval-manage/ui';
import {
  EMPTY_FIELD_VALUE,
  formatTimestamp,
  getTransactionDirection,
} from '@myorg/modules/approval-manage/util';

/**
 * ReserveAssetTransactionApproval — 储备资产交易审核详情（迁移自 td-manage
 * `src/pages/approval-manage/components/reserve-asset-transaction.tsx`，110 行）。
 *
 * 1 个 busCode 命中（util BUS_CODE_MAP）：save_reserve_asset_transaction。
 *
 * **方向语义（源 transactionDirection）**：`===1` → Inflow（绿色 +），否则 →
 * Outflow（红色 -）。Asset Value 用 `Intl.NumberFormat`（min/max 2 位小数）格式化
 * 金额 + 货币符号，前缀方向符号（源 amountNode）。
 *
 * **字段类型**：detailInfo = approvedDetail.businessContent（宽松 Record，源 GlobalAny）。
 */
export function ReserveAssetTransactionApproval({
  detailInfo,
}: ApprovalComponentProps) {
  const t = useTranslations('modules.approval-manage');
  const d = (detailInfo ?? {}) as Record<string, any>;

  const { directionLabel, amountNode } = React.useMemo(() => {
    const isInflow = Number(d.transactionDirection) === 1;
    const directionText = getTransactionDirection(d.transactionDirection);
    const amount = Number(d.transactionAmount || 0);
    const currency = d.currency || '';
    const formatter = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const sign = isInflow ? '+' : '-';
    const colorClass = isInflow ? 'text-green-600' : 'text-red-600';
    const node = (
      <span className={`font-bold ${colorClass}`}>
        {`${sign}${formatter.format(amount)} ${currency}`}
      </span>
    );
    return { directionLabel: directionText, amountNode: node };
  }, [d.transactionDirection, d.transactionAmount, d.currency]);

  const sections = React.useMemo<ApprovalDetailSection[]>(() => {
    return [
      {
        title: t('wallet_type_013'),
        list: [
          { label: t('reserveAssetTransaction.transactionType'), value: directionLabel },
          { label: t('reserveAssetTransaction.assetValue'), value: amountNode },
        ],
      },
      {
        title: t('reserveAssetTransaction.informationTitle'),
        list: [
          { label: t('reserveAsset.assetName'), value: d.assetName },
          { label: t('reserveAsset.currency'), value: d.currency },
          { label: t('reserveAssetTransaction.assetCategory'), value: d.assetCategoryName },
          {
            label: t('reserveAssetTransaction.quantity'),
            value: d.unit || EMPTY_FIELD_VALUE,
          },
          { label: t('reserveAssetTransaction.createdBy'), value: d.createdName },
          {
            label: t('reserveAssetTransaction.createdOn'),
            value: formatTimestamp(toNumber(d.createdTime)),
          },
          {
            label: t('PUB_Status'),
            value: <ApprovalStatusBadge family="task" status={toNumber(d.status)} />,
            showBorder: true,
          },
        ],
      },
    ];
  }, [directionLabel, amountNode, d, t]);

  return <ApprovalDetailGrid sections={sections} />;
}

/** 安全 number 化（兼容字符串数字）。 */
function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
