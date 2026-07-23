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
 * TopUpApproval — 稳定币充值/铸造审核详情（迁移自 td-manage
 * `src/pages/approval-manage/components/top-up.tsx`，152 行）。
 *
 * 1 个 busCode 命中（util BUS_CODE_MAP）：sp_buy_token（稳定币充值/铸造）。
 *
 * **金额展示**：顶部 order_type_1 区块，绿色加粗 `+{reSet(txAmount)} {tokenSymbol}`
 * （reSet 千分位格式化，源同）。
 *
 * **字段类型**：detailInfo = approvedDetail.businessContent（宽松 Record，源 BCMP.ANY）。
 * reserveTxAmount 用 reSet 格式化（与 withdrawal 对称；源 top-up 此处已 reSet，
 * withdrawal 未 reSet 属源 bug，本批次按文档要点保留 withdrawal 原样不 reSet）。
 */
export function TopUpApproval({ detailInfo }: ApprovalComponentProps) {
  const t = useTranslations('modules.approval-manage');
  const d = (detailInfo ?? {}) as Record<string, any>;

  const sections = React.useMemo<ApprovalDetailSection[]>(() => {
    return [
      {
        list: [
          {
            label: t('order_type_1'),
            value: (
              <span className="text-green-500 font-bold">
                {`+${reSet(d.txAmount)} ${d.tokenSymbol ?? ''}`}
              </span>
            ),
          },
        ],
      },
      {
        title: t('tokenized_deposit_0162'),
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
        title: t('tokenized_deposit_0164'),
        list: [
          { label: t('tokenized_deposit_0101'), value: d.bankOrderNumber },
          { label: t('tokenized_deposit_0166'), value: d.spBankAccount },
          {
            label: t('tokenized_deposit_0167'),
            value: d.reserveAssetName || EMPTY_FIELD_VALUE,
          },
          {
            label: t('tokenized_deposit_0029'),
            value: `${reSet(d.reserveTxAmount)} ${d.currencySymbol ?? ''}`,
          },
          {
            label: t('tokenized_deposit_0086'),
            value: formatTimestamp(toNumber(d.reserveTxTime)),
            showBorder: true,
          },
        ],
      },
      {
        title: t('tokenized_deposit_0169'),
        list: [
          {
            label: t('tokenized_deposit_0089'),
            value: d.txHash || EMPTY_FIELD_VALUE,
          },
          {
            label: t('tokenized_deposit_0086'),
            value: formatTimestamp(toNumber(d.txTime)),
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
