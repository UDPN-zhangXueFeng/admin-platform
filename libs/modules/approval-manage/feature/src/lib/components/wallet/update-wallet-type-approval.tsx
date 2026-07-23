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
import { formatTimestamp } from '@myorg/modules/approval-manage/util';

/**
 * UpdateWalletTypeApproval — SP 钱包类型变更审核详情（迁移自 td-manage
 * `src/pages/approval-manage/components/updateWalletType.tsx`，143 行）。
 *
 * 只读展示组件，接收 `detailInfo`（=approvedDetail.businessContent，dispatcher 透传）。
 * td_change_wallet_type 触发，无 type（固定 wallet_type_task_type_2）。
 *
 * 迁移要点（§7 步骤 7）：
 * - **new/oldWalletType 并列**：源 updateWalletType.tsx:53-70 把 newWalletType（label 追加
 *   wallet_type_task_type_2 后缀）与 oldWalletType（label 追加 approval_manage_0013 后缀）
 *   并列展示，凸显「变更后/变更前」。
 * - **walletType 直显**（非映射；此处 new/oldWalletType 是后端展示字符串）。
 * - **remarks 字段**（源 :84-87）。
 * - **Paragraph copyable → CopyableEllipsisText**。
 * - **status 取 `status` 字段**，badge family='task'。
 *
 * **i18n**：扁平 key，namespace=modules.approval-manage，无双重前缀。
 * wallet_type_task_type_/token_type_/common_task_status_ 动态 key 在 T14 补全。
 */

type DetailInfo = Record<string, unknown>;

/** 安全取数值。 */
function toNum(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export interface UpdateWalletTypeApprovalProps {
  /** approvedDetail.businessContent（dispatcher 透传，宽松类型）。 */
  detailInfo?: DetailInfo;
}

export function UpdateWalletTypeApproval({
  detailInfo,
}: UpdateWalletTypeApprovalProps) {
  const t = useTranslations('modules.approval-manage');

  const sections: ApprovalDetailSection[] = React.useMemo(() => {
    if (!detailInfo) return [];

    const status = toNum(detailInfo.status);
    return [
      {
        list: [
          {
            label: t('tokenized_deposit_0042'),
            // 固定 wallet_type_task_type_2（变更）。
            value: t('wallet_type_task_type_2' as never),
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
          { label: t('approval_manage_0011'), value: String(detailInfo.spName ?? '') },
          // newWalletType（变更后）：label 追加 wallet_type_task_type_2。
          {
            label: `${t('approval_manage_0015')} (${t('wallet_type_task_type_2' as never)})`,
            value: String(detailInfo.newWalletType ?? ''),
          },
          // oldWalletType（变更前）：label 追加 approval_manage_0013。
          {
            label: `${t('approval_manage_0015')} (${t('approval_manage_0013')})`,
            value: String(detailInfo.oldWalletType ?? ''),
          },
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
  }, [detailInfo, t]);

  return <ApprovalDetailGrid sections={sections} />;
}
