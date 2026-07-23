'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { CopyableEllipsisText } from '@myorg/shared/ui';
import {
  ApprovalDetailGrid,
  ApprovalStatusBadge,
  type ApprovalDetailItem,
  type ApprovalDetailSection,
} from '@myorg/modules/approval-manage/ui';
import { formatTimestamp, reSet } from '@myorg/modules/approval-manage/util';

/**
 * FundsApproval — TD 资金冻结/解冻审核详情（迁移自 td-manage
 * `src/pages/approval-manage/components/funds.tsx`，132 行）。
 *
 * 只读展示组件，接收 `detailInfo`（=approvedDetail.businessContent）+ 可选 `type`。
 * td_freeze_wallet_td(type=1 冻结 TD 资金) / td_unfreeze_wallet_td(type=2 解冻) 触发。
 *
 * 迁移要点（§7 步骤 7）：
 * - **type 驱动 `funds_task_type_`**：操作类型 label 由 type 派生（1=冻结 / 2=解冻）。
 * - **reSet 金额格式化**：operationCount（操作金额）与 stablecoinCount（稳定币余额）
 *   均 reSet 千分位 + 追加 symbol（源 funds.tsx:32/49）。注意 label 与 value 的位置：
 *   源把 operationCount 放在首 section 的 value（label 是 funds_task_type_）。
 * - **walletType 直显**。
 * - **Paragraph copyable → CopyableEllipsisText**。
 * - **status 取 `status` 字段**，badge family='task'。
 *
 * **i18n**：扁平 key，namespace=modules.approval-manage，无双重前缀。
 * funds_task_type_/token_type_/common_task_status_ 动态 key 在 T14 补全。
 */

type DetailInfo = Record<string, unknown>;

/** 安全取数值。 */
function toNum(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export interface FundsApprovalProps {
  /** approvedDetail.businessContent（dispatcher 透传，宽松类型）。 */
  detailInfo?: DetailInfo;
  /** 操作类型 1=冻结 / 2=解冻（busCode 派生）。 */
  type?: number;
}

export function FundsApproval({ detailInfo, type }: FundsApprovalProps) {
  const t = useTranslations('modules.approval-manage');

  const sections: ApprovalDetailSection[] = React.useMemo(() => {
    if (!detailInfo) return [];

    const status = toNum(detailInfo.status);
    const opType = type ?? 0;
    const symbol = String(detailInfo.symbol ?? '');
    return [
      {
        list: [
          {
            label: t(`funds_task_type_${opType}` as never),
            // value = reSet(operationCount) + ' ' + symbol（源 funds.tsx:32）。
            value: `${reSet(detailInfo.operationCount)} ${symbol}`,
          },
        ],
      },
      {
        title: t('approval_manage_0014'),
        list: [
          {
            label: t('tokenized_deposit_0053'),
            value: (
              <CopyableEllipsisText
                value={String(detailInfo.walletAddress ?? '')}
              />
            ),
          },
          {
            label: t('approval_manage_0012'),
            value: `${reSet(detailInfo.stablecoinCount)} ${symbol}`,
          },
          { label: t('approval_manage_0011'), value: String(detailInfo.spName ?? '') },
          // walletType 直显。
          { label: t('approval_manage_0015'), value: String(detailInfo.walletType ?? '') },
          { label: t('tokenized_deposit_0000'), value: String(detailInfo.tdName ?? '') },
          {
            label: t('tokenized_deposit_0062'),
            value: t(`token_type_${detailInfo.tokenType}` as never),
          },
          { label: t('PUB_Blockchain'), value: String(detailInfo.blockchainName ?? '') },
          // remarks。
          {
            label: t('approval_manage_0010'),
            value: String(detailInfo.remarks ?? ''),
            showBorder: true,
          },
          { label: t('PUB_Creater'), value: String(detailInfo.creator ?? '') },
          {
            label: t('PUB_CreateTime'),
            value: formatTimestamp(toNum(detailInfo.createTime)),
            showBorder: true,
          },
        ],
      },
      {
        title: t('tokenized_deposit_0095'),
        list: [
          { label: t('tokenized_deposit_0089'), value: String(detailInfo.txHash || '--') },
          {
            label: t('tokenized_deposit_0086'),
            value: formatTimestamp(toNum(detailInfo.txTime)),
            showBorder: true,
          },
          {
            label: t('PUB_Status'),
            value:
              status !== undefined ? (
                <ApprovalStatusBadge family="task" status={status} />
              ) : null,
            showBorder: true,
          } satisfies ApprovalDetailItem,
        ],
      },
    ];
  }, [detailInfo, type, t]);

  return <ApprovalDetailGrid sections={sections} />;
}
