'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import {
  ApprovalDetailGrid,
  type ApprovalDetailSection,
} from '@myorg/modules/approval-manage/ui';
import { ApprovalStatusBadge } from '@myorg/modules/approval-manage/ui';
import {
  EMPTY_FIELD_VALUE,
  formatTimestamp,
  reSet,
} from '@myorg/modules/approval-manage/util';

/**
 * Mint/Melt 审核组件公共实现（迁移自 td-manage
 * `src/pages/approval-manage/components/mint.tsx`（117 行）+ `melt.tsx`（148 行））。
 *
 * 两个组件结构完全对称（增发 vs 销毁），唯一差异：
 * - `isMint=true`  → 绿色 `text-green-500` + `+` 前缀，标题 `tokenized_deposit_0098`（Minting Information），
 *                   表头金额标签 `tokenized_deposit_1`（Minting）。
 * - `isMint=false` → 红色 `text-red-600` + `-` 前缀，标题 `tokenized_deposit_0099`（Melting Information），
 *                   表头金额标签 `tokenized_deposit_2`（Melting）。
 *
 * 抽公共实现避免 mint/melt 两处各写一份（Rule 2/DRY；文档 §7 步骤 6 明确要求抽公共 isMint）。
 *
 * **状态字段**：mint/melt 取 `detailInfo.status`（源 mint.tsx:92 / melt.tsx:92 的
 * `t(\`common_task_status_${detailInfo?.status}\`)`），走 ApprovalStatusBadge task 族。
 *
 * **死代码剔除（文档 §8）**：melt.tsx 末尾注释的 `approvalTaskStatus` / `token_task_status_*`
 * 整段 section（行 101-131）不迁移。
 *
 * **i18n 命名空间**：源用 `useHook(['tokenized-deposit','approval-manage'])` 注入两 namespace，
 * 目标收敛到 `modules.approval-manage`（词条已补齐：tokenized_deposit_* / PUB_*）。
 */

export interface MintMeltApprovalProps {
  /** approvedDetail.businessContent（dispatcher 透传，源 detailInfo）。 */
  detailInfo?: Record<string, unknown>;
  /** true=增发（MintApproval），false=销毁（MeltApproval）。 */
  isMint: boolean;
}

/** 从宽松 detailInfo 安全读取字段（字符串/数字，未知→undefined）。 */
function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  return String(v);
}

/** 读取展示值：无值→EMPTY_FIELD_VALUE（迁移自源各处 `|| '--'` 兜底）。 */
function display(v: unknown): string {
  const s = str(v);
  return s && s.trim() !== '' ? s : EMPTY_FIELD_VALUE;
}

/**
 * 渲染 Mint/Melt 审核详情。
 *
 * section 结构 1:1 对照源 mint.tsx:22-104 / melt.tsx:22-100（剔除 melt 末尾死代码 section）。
 */
export function MintMeltApproval({ detailInfo, isMint }: MintMeltApprovalProps) {
  const t = useTranslations('modules.approval-manage');

  // isMint 控制色/符号/标题（源两组件唯一差异点）。
  const colorClass = isMint
    ? 'text-green-500 font-bold'
    : 'text-red-600 font-bold';
  const sign = isMint ? '+' : '-';
  const headerLabelKey = isMint ? 'tokenized_deposit_1' : 'tokenized_deposit_2';

  const sections = React.useMemo<ApprovalDetailSection[]>(() => {
    const tdSymbol = str(detailInfo?.tdSymbol);
    const amount = reSet(detailInfo?.amount);
    // 金额符号 + 千分位 + 币种（源 mint.tsx:29 / melt.tsx:29 `'+' + reSet(amount) + ' ' + tdSymbol`）。
    const amountValue = (
      <span className={colorClass}>
        {sign + amount + ' ' + (tdSymbol ?? '')}
      </span>
    );

    // 价格展示（源 mint.tsx:49-57 / melt.tsx:49-57）：
    // `${stablecoinCount} ${tdSymbol} = ${usPrice} ${currencySymbol}`。
    const priceValue = [
      str(detailInfo?.stablecoinCount) ?? '',
      tdSymbol ?? '',
      '=',
      str(detailInfo?.usPrice) ?? '',
      str(detailInfo?.currencySymbol) ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    return [
      // section 1：金额（增发 + / 销毁 -）
      {
        list: [{ label: t(headerLabelKey), value: amountValue }],
      },
      // section 2：代币信息
      {
        title: t('tokenized_deposit_0010'),
        list: [
          {
            label: t('tokenized_deposit_0000'),
            value: display(detailInfo?.tdName),
          },
          {
            label: t('tokenized_deposit_0062'),
            value: t(`token_type_${detailInfo?.mintMethod}`),
          },
          { label: t('tokenized_deposit_0011'), value: priceValue },
          {
            label: t('tokenized_deposit_0002'),
            value: display(detailInfo?.decimalPrecision),
          },
          {
            label: t('tokenized_deposit_0007'),
            value: display(detailInfo?.blockchainName),
            showBorder: true,
          },
          {
            label: t('PUB_Creater'),
            value: display(detailInfo?.createUser),
          },
          {
            label: t('PUB_CreateTime'),
            value: formatTimestamp(Number(detailInfo?.createTime)),
            showBorder: true,
          },
        ],
      },
      // section 3：交易信息（含状态）
      {
        title: t('tokenized_deposit_0095'),
        list: [
          {
            label: t('tokenized_deposit_0089'),
            value: display(detailInfo?.txHash),
          },
          {
            label: t('tokenized_deposit_0086'),
            value: formatTimestamp(Number(detailInfo?.txTime)),
            showBorder: true,
          },
          {
            label: t('PUB_Status'),
            value: (
              <ApprovalStatusBadge
                family="task"
                status={
                  detailInfo?.status == null
                    ? undefined
                    : Number(detailInfo.status)
                }
              />
            ),
            showBorder: true,
          },
        ],
      },
    ];
  }, [colorClass, detailInfo, headerLabelKey, sign, t]);

  return <ApprovalDetailGrid sections={sections} />;
}
