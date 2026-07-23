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
  reSet,
} from '@myorg/modules/approval-manage/util';

/**
 * WithdrawalApproval — 稳定币提现/赎回/销毁审核详情（迁移自 td-manage
 * `src/pages/approval-manage/components/withdrawal.tsx`，147 行）。
 *
 * 1 个 busCode 命中（util BUS_CODE_MAP）：sp_withdraw_token（稳定币提现/赎回/销毁）。
 *
 * 与 top-up 对称：顶部红色加粗 `-{reSet(txAmount)} {tokenSymbol}`。
 *
 * **死代码剔除（迁移文档 §8）**：源 tokenized_deposit_0170 区块注释的
 * manageWalletAddress 字段不迁移。
 *
 * **源 bug 保留（迁移文档 §8 ⑤）**：`reserveTxAmount` 未 reSet（与 top-up 不一致）。
 * 按文档决策保留源样，不修正（待与后端确认）。
 *
 * **字段类型**：detailInfo = approvedDetail.businessContent（宽松 Record，源 BCMP.ANY）。
 */
export function WithdrawalApproval({ detailInfo }: ApprovalComponentProps) {
  const t = useTranslations('modules.approval-manage');
  const d = (detailInfo ?? {}) as Record<string, any>;

  const sections = React.useMemo<ApprovalDetailSection[]>(() => {
    return [
      {
        list: [
          {
            label: t('order_type_2'),
            value: (
              <span className="text-red-600 font-bold">
                {`-${reSet(d.txAmount)} ${d.tokenSymbol ?? ''}`}
              </span>
            ),
          },
        ],
      },
      {
        title: t('tokenized_deposit_0163'),
        list: [
          { label: t('tokenized_deposit_0160'), value: d.spName },
          { label: t('tokenized_deposit_0161'), value: d.walletAddress },
          { label: t('tokenized_deposit_0000'), value: d.tokenName },
          {
            label: t('tokenized_deposit_0062'),
            value:
              d.tokenType != null
                ? t(`token_type_${d.tokenType}`)
                : EMPTY_FIELD_VALUE,
          },
          {
            label: t('tokenized_deposit_0011'),
            value: `1 ${d.tokenSymbol ?? ''} = ${d.tokenPrice ?? ''} ${
              d.currencySymbol ?? ''
            }`,
          },
          {
            label: t('tokenized_deposit_0007'),
            value: d.blockchainName,
            showBorder: true,
          },
          {
            label: t('PUB_CreateTime'),
            value: formatTimestamp(toNumber(d.createTime)),
            showBorder: true,
          },
        ],
      },
      {
        title: t('tokenized_deposit_0170'),
        list: [
          {
            label: t('tokenized_deposit_0089'),
            value: d.txHash || EMPTY_FIELD_VALUE,
          },
          {
            label: t('tokenized_deposit_0086'),
            value: formatTimestamp(toNumber(d.txTime)),
          },
        ],
      },
      {
        title: t('tokenized_deposit_0100'),
        list: [
          { label: t('tokenized_deposit_0101'), value: d.bankOrderNumber },
          // 源 bug 保留（§8 ⑤）：reserveTxAmount 未 reSet（与 top-up 不一致），待后端确认。
          { label: t('tokenized_deposit_0102'), value: d.reserveTxAmount },
          { label: t('tokenized_deposit_0166'), value: d.spBankAccount },
          {
            label: t('tokenized_deposit_0086'),
            value: formatTimestamp(toNumber(d.reserveTxTime)),
            showBorder: true,
          },
          {
            label: t('PUB_Status'),
            value: <ApprovalStatusBadge family="task" status={toNumber(d.status)} />,
            showBorder: true,
          },
        ],
      },
    ];
  }, [d, t]);

  return <ApprovalDetailGrid sections={sections} />;
}

/** 安全 number 化（兼容字符串数字）。 */
function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
