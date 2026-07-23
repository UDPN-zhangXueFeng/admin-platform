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
 * CreateWalletApproval — 用户钱包新建审核详情（迁移自 td-manage
 * `src/pages/approval-manage/components/createWallet.tsx`，117 行）。
 *
 * 只读展示组件，接收 `detailInfo`（=approvedDetail.businessContent，dispatcher 透传）。
 * sp_open_wallet 触发，无 type。
 *
 * 迁移要点（§7 步骤 7）：
 * - **walletType 直显**：与 updateAdminWallet（走 `admin_wallet_type_` 映射）不同，
 *   此处 walletType 是后端返回的展示字符串，直接展示（源 createWallet.tsx:48-49）。
 * - **Paragraph copyable → CopyableEllipsisText**（journal 模式，§6.4），walletAddress。
 * - **status 取 `status` 字段**（§6.2 note），badge family='task'。
 *
 * **i18n**：扁平 key（namespace 已是 modules.approval-manage，无双重前缀）。
 * token_type_/common_task_status_/approval_task_status_color_ 等动态 key 在 T14 阶段补全。
 *
 * **类型策略（Rule 8/3）**：detailInfo 来自 dispatcher 透传的
 * `Record<string, unknown>`，组件内用局部宽松类型取值（不重建业务实体类型）。
 */

/** 字段取值辅助：detailInfo 宽松取值（与 monitoring-rule 一致）。 */
type DetailInfo = Record<string, unknown>;

/** 安全取数值（源 Number(detailInfo?.createTime)，后端可能返回字符串）。 */
function toNum(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export interface CreateWalletApprovalProps {
  /** approvedDetail.businessContent（dispatcher 透传，宽松类型）。 */
  detailInfo?: DetailInfo;
}

export function CreateWalletApproval({
  detailInfo,
}: CreateWalletApprovalProps) {
  const t = useTranslations('modules.approval-manage');

  const sections: ApprovalDetailSection[] = React.useMemo(() => {
    if (!detailInfo) return [];

    const status = toNum(detailInfo.status);
    return [
      {
        list: [
          {
            label: t('tokenized_deposit_0042'),
            // 源 createWallet.tsx:28 固定 user_wallet_task_type_3（开户）。
            value: t('user_wallet_task_type_3' as never),
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
          { label: t('approval_manage_0049'), value: String(detailInfo.spName ?? '') },
          // walletType 直显（后端展示字符串，不走 admin_wallet_type_ 映射）。
          { label: t('approval_manage_0015'), value: String(detailInfo.walletType ?? '') },
          { label: t('tokenized_deposit_0000'), value: String(detailInfo.tdName ?? '') },
          {
            label: t('tokenized_deposit_0062'),
            value: t(`token_type_${detailInfo.tokenType}` as never),
          },
          { label: t('PUB_Blockchain'), value: String(detailInfo.blockchainName ?? '') },
          { label: t('PUB_Creater'), value: String(detailInfo.creator ?? '') },
          {
            label: t('PUB_CreateTime'),
            value: formatTimestamp(toNum(detailInfo.createTime)),
            showBorder: true,
          },
        ],
      },
      {
        title: t('tokenized_deposit_0173'),
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
