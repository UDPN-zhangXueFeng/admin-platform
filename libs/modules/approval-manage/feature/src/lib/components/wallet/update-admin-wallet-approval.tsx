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
 * UpdateAdminWalletApproval — Admin 钱包更新审核详情（迁移自 td-manage
 * `src/pages/approval-manage/components/updateAdminWallet.tsx`，119 行）。
 *
 * 只读展示组件，接收 `detailInfo`（=approvedDetail.businessContent，dispatcher 透传）。
 * td_admin_wallet_update 触发，无 type。
 *
 * 迁移要点（§7 步骤 7 / §8 字段命名不统一）：
 * - **字段命名独特**（与其它 wallet 组件不同，勿统一）：TD 名用 `tokenName`（非 tdName/name）、
 *   区块链用 `blockChain`（非 blockchainName）、创建人用 `createdBy`（非 creator/createUser）、
 *   创建时间用 `createdOn`（非 createTime/createDate）。
 * - **walletType 走 `admin_wallet_type_` 映射**（非直显）：与 createWallet/userWallet/funds
 *   的「直显 walletType」策略相反，此处 walletType 是枚举码，经 `t(admin_wallet_type_${n})` 取文案。
 * - **originalWalletAddress**：源更新前后地址并列展示（current + original）。
 * - **Paragraph copyable → CopyableEllipsisText**（journal 模式）。
 * - **status 取 `status` 字段**，badge family='task'。
 *
 * **i18n**：扁平 key，namespace=modules.approval-manage，无双重前缀。
 * admin_wallet_type_/common_task_status_/approval_task_status_color_ 动态 key 在 T14 补全。
 */

type DetailInfo = Record<string, unknown>;

/** 安全取数值（源 Number(detailInfo?.createdOn)）。 */
function toNum(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export interface UpdateAdminWalletApprovalProps {
  /** approvedDetail.businessContent（dispatcher 透传，宽松类型）。 */
  detailInfo?: DetailInfo;
}

export function UpdateAdminWalletApproval({
  detailInfo,
}: UpdateAdminWalletApprovalProps) {
  const t = useTranslations('modules.approval-manage');

  const sections: ApprovalDetailSection[] = React.useMemo(() => {
    if (!detailInfo) return [];

    const status = toNum(detailInfo.status);
    return [
      {
        list: [
          {
            label: t('tokenized_deposit_0042'),
            // 源 updateAdminWallet.tsx:30 固定 service_provider_type_2（SP Admin Wallet）。
            value: t('service_provider_type_2' as never),
          },
        ],
      },
      {
        title: t('tokenized_deposit_0010'),
        list: [
          { label: t('tokenized_deposit_0000'), value: String(detailInfo.tokenName ?? '') },
          // walletType 走 admin_wallet_type_ 映射（枚举码→文案）。
          {
            label: t('tokenized_deposit_0075'),
            value: t(`admin_wallet_type_${detailInfo.walletType}` as never),
          },
          {
            label: t('tokenized_deposit_0096'),
            value: (
              <CopyableEllipsisText
                value={String(detailInfo.walletAddress ?? '')}
              />
            ),
          },
          {
            label: t('tokenized_deposit_0097'),
            value: (
              <CopyableEllipsisText
                value={String(detailInfo.originalWalletAddress ?? '')}
              />
            ),
          },
          // 字段名 blockChain（非 blockchainName）。
          {
            label: t('tokenized_deposit_0007'),
            value: String(detailInfo.blockChain ?? ''),
            showBorder: true,
          },
          // 字段名 createdBy（非 creator）。
          { label: t('PUB_Creater'), value: String(detailInfo.createdBy ?? '') },
          // 字段名 createdOn（非 createTime）。
          {
            label: t('PUB_CreateTime'),
            value: formatTimestamp(toNum(detailInfo.createdOn)),
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
        ],
      },
      {
        list: [
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
