'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { CopyableEllipsisText } from '@myorg/shared/ui';
import {
  ApprovalDetailGrid,
  ApprovalStatusBadge,
  type ApprovalDetailSection,
  type ApprovalDetailItem,
} from '@myorg/modules/approval-manage/ui';
import { formatTimestamp } from '@myorg/modules/approval-manage/util';

/**
 * LiquidityPoolApproval — 跨链流动性池审核组件（迁移自 td-manage
 * `src/pages/approval-manage/components/liquidity-pool.tsx`，201 行）。
 *
 * busCode: save/update_liquidity_pool（无 type，operationType 驱动）。
 * operationType===2（Edit）多处触发新旧差异展示：
 * 1. Wallet Address：Update!=Original 时 label 加 "(Update)" + 追加 Original 行。
 * 2. Authorized Amount：Update 时「Update to X」前缀（源三元两分支值同为 Update，照搬）。
 * 3. Threshold：Original!==Update 时「Update from X to Y」。
 * 4. Email Recipients：疑似源 bug（迁移文档 §8 ③）—— `emailRecipientsNumberOriginal
 *    !== emailRecipientsOriginal`（数值字段 vs 字符串/数组字段，类型不匹配，恒为 true）。
 *    按 Rule 12 保留源逻辑（与后端确认前不改），并在注释标注。
 *
 * 字段照源逐一对齐（source liquidity-pool.tsx:22-185）；i18n 收敛到 modules.approval-manage（§14）。
 *
 * NOTE: detailInfo 为 dispatcher 透传的 businessContent（源 BCMP.ANY），宽松类型 + 防御读取，
 * 不重建业务实体类型（迁移文档 §5 复用策略）。
 */

/** 业务内容（宽松类型；字段名照源 detailInfo?.xxx，逐一对齐）。 */
interface LiquidityPoolBusinessContent {
  operationType?: number;
  liquidityPoolWalletAddressUpdate?: string;
  liquidityPoolWalletAddressOriginal?: string;
  tokenName?: string;
  blockchain?: string;
  deductibleAmountUpdate?: string | number;
  symbol?: string;
  thresholdOriginal?: string | number;
  thresholdUpdate?: string | number;
  emailRecipientsNumberUpdate?: string | number;
  emailRecipientsUpdate?: string;
  emailRecipientsNumberOriginal?: string | number;
  emailRecipientsOriginal?: string;
  createdBy?: string;
  createdOn?: string | number;
  transactionHash?: string;
  transactionTime?: string | number;
  status?: number;
}

export interface LiquidityPoolApprovalProps {
  /** businessContent（dispatcher 透传）。 */
  detailInfo?: Record<string, unknown>;
}

export function LiquidityPoolApproval({ detailInfo }: LiquidityPoolApprovalProps) {
  const t = useTranslations('modules.approval-manage');

  const d = (detailInfo ?? {}) as LiquidityPoolBusinessContent;

  const sections = useMemo<ApprovalDetailSection[]>(() => {
    const isEdit = d.operationType === 2;

    // Wallet Address：Update!=Original 时 label 追加 "(Update)"（源 liquidity-pool.tsx:38-46）。
    const walletAddressChanged =
      isEdit &&
      d.liquidityPoolWalletAddressUpdate !==
        d.liquidityPoolWalletAddressOriginal;
    const walletAddressLabel = `${t('cross_chain_0045')} ${
      walletAddressChanged ? `(${t('cross_chain_00141')})` : ''
    }`;

    // Authorized Amount：Edit 时「Update to X」前缀（源 liquidity-pool.tsx:83-93）。
    const authorizedAmountValue = isEdit
      ? `${t('cross_chain_00118')} ${t('cross_chain_00120')} ${
          d.deductibleAmountUpdate ?? ''
        } ${d.symbol ?? ''}`
      : `${d.deductibleAmountUpdate ?? ''} ${d.symbol ?? ''}`;

    // Threshold：Original!==Update 时「Update from X to Y」（源 liquidity-pool.tsx:101-118）。
    const thresholdChanged =
      isEdit && d.thresholdOriginal !== d.thresholdUpdate;
    const thresholdValue = thresholdChanged
      ? `${t('cross_chain_00118')} ${t('cross_chain_00119')} ${
          d.thresholdOriginal ?? 0
        } ${d.symbol ?? ''} ${t('cross_chain_00120')} ${
          d.thresholdUpdate ?? ''
        } ${d.symbol ?? ''}`
      : `${d.thresholdUpdate ?? ''} ${d.symbol ?? ''}`;

    // Email Recipients label（源 liquidity-pool.tsx:121-133）。Update 时追加 "(Update)"。
    const emailRecipientsLabel = `${t('cross_chain_0016')}(${
      d.emailRecipientsNumberUpdate ?? ''
    }) ${isEdit ? `(${t('cross_chain_00141')})` : ''}`;

    // ⚠️ 疑似源 bug（迁移文档 §8 ③）：源用 emailRecipientsNumberOriginal（数值）
    //    !== emailRecipientsOriginal（字符串/数组），类型不匹配恒为 true。
    //    按 Rule 12 保留源逻辑（与后端确认前不改）。
    const emailRecipientsChanged =
      isEdit &&
      d.emailRecipientsNumberOriginal !== d.emailRecipientsOriginal;

    return [
      {
        list: [
          {
            label: t('cross_chain_0032'),
            value: t(`liquidity_pool_operation_type_${d.operationType}`),
          },
        ],
      },
      {
        title: t('cross_chain_00116'),
        list: [
          {
            label: walletAddressLabel,
            value: (
              <CopyableEllipsisText
                value={d.liquidityPoolWalletAddressUpdate ?? ''}
              />
            ),
          },
          walletAddressChanged
            ? ({
                label: `${t('cross_chain_0045')} (${t('cross_chain_00117')})`,
                value: (
                  <CopyableEllipsisText
                    value={d.liquidityPoolWalletAddressOriginal ?? ''}
                  />
                ),
              } as ApprovalDetailItem)
            : ({} as ApprovalDetailItem),
          { label: t('cross_chain_0044'), value: d.tokenName },
          { label: t('cross_chain_0000'), value: d.blockchain },
          {
            label: t('cross_chain_0048'),
            value: authorizedAmountValue,
          },
        ],
      },
      {
        title: t('cross_chain_00115'),
        list: [
          { label: t('cross_chain_0055'), value: thresholdValue },
          {
            label: emailRecipientsLabel,
            value: d.emailRecipientsUpdate || '--',
            showBorder: !emailRecipientsChanged,
          },
          emailRecipientsChanged
            ? ({
                label: `${t('cross_chain_0016')}(${
                  d.emailRecipientsNumberOriginal ?? ''
                }) (${t('cross_chain_00117')})`,
                value: d.emailRecipientsOriginal || '--',
                showBorder: true,
              } as ApprovalDetailItem)
            : ({} as ApprovalDetailItem),
          { label: t('PUB_Creater'), value: d.createdBy },
          {
            label: t('PUB_CreateTime'),
            value: formatTimestamp(Number(d.createdOn)),
            showBorder: true,
          },
        ],
      },
      {
        title: t('cross_chain_00114'),
        list: [
          {
            label: t('cross_chain_0060'),
            value: d.transactionHash || '--',
          },
          {
            label: t('cross_chain_0061'),
            value: formatTimestamp(Number(d.transactionTime)),
            showBorder: true,
          },
          {
            label: t('PUB_Status'),
            value: <ApprovalStatusBadge family="task" status={d.status} />,
            showBorder: true,
          },
        ],
      },
    ];
  }, [d, t]);

  return <ApprovalDetailGrid sections={sections} />;
}

export default LiquidityPoolApproval;
