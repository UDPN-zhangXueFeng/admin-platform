'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import {
  ApprovalDetailGrid,
  ApprovalStatusBadge,
  type ApprovalDetailItem,
  type ApprovalDetailSection,
} from '@myorg/modules/approval-manage/ui';
import { formatTimestamp, reSet } from '@myorg/modules/approval-manage/util';

/**
 * MonitoringResultProcessApproval — 监控结果处理审核详情（迁移自 td-manage
 * `src/pages/approval-manage/components/monitoring-result-process.tsx`，185 行）。
 *
 * 只读展示组件，接收 `detailInfo`（=approvedDetail.businessContent）。
 *
 * 迁移要点（§7 步骤 9）：
 * - **businessType 50/40 条件渲染**：仅 businessType===50||40 时渲染当前值（currentValue +
 *   symbol，reSet 格式化）与对比值（compareValue，label 内嵌 `${day}`=compareToTime）；
 *   description 末尾追加 `% `（50/40）或 screening_monitoring_0081（其他）。
 * - **BusinessName 大写驼峰笔误兜底（§8 源 bug ⑥）**：源用 `detailInfo?.BusinessName`
 *   （疑似后端字段笔误），迁移保留该字段名读取（与后端契约一致，勿「纠正」为 businessName）。
 *
 * **类型策略**：detailInfo 宽松 `Record<string, unknown>`，局部取值。
 * **i18n**：扁平 key；动态前缀（transaction_monitoring_type_/risk_level_type_/
 * risk_level_color_/suggested_action_type_/screening_monitoring_*）T14 统一补全。
 */

type DetailInfo = Record<string, unknown>;

/** 安全取数值。 */
function toNum(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export interface MonitoringResultProcessApprovalProps {
  /** approvedDetail.businessContent（dispatcher 透传，宽松类型）。 */
  detailInfo?: DetailInfo;
}

export function MonitoringResultProcessApproval({
  detailInfo,
}: MonitoringResultProcessApprovalProps) {
  const t = useTranslations('modules.approval-manage');

  const sections: ApprovalDetailSection[] = React.useMemo(() => {
    if (!detailInfo) return [];

    const businessType = toNum(detailInfo.businessType);
    const isPercentageType = businessType === 50 || businessType === 40;
    const resultPriority = toNum(detailInfo.resultPriority);
    const processingType = toNum(detailInfo.processingType);
    const processResult = toNum(detailInfo.processResult);
    const status = toNum(detailInfo.status);

    // description 末尾追加 % （50/40）或 screening_monitoring_0081（源 monitoring-result-process.tsx:85-92）
    const descriptionSuffix = isPercentageType
      ? '% '
      : t('screening_monitoring_0081');

    // 条件渲染项（源 monitoring-result-process.tsx:93-109，仅 50/40）
    const currentValueItem: ApprovalDetailItem = isPercentageType
      ? {
          label: t('screening_monitoring_0058'),
          value: `${reSet(detailInfo.currentValue)} ${detailInfo.symbol ?? ''}`,
        }
      : ({} as ApprovalDetailItem);

    const compareValueItem: ApprovalDetailItem = isPercentageType
      ? {
          // label 内嵌 ${day}=compareToTime（源 .replace('${day}', ...)）
          label: t('screening_monitoring_0059').replace(
            '{day}',
            String(detailInfo.compareToTime ?? ''),
          ),
          value: `${reSet(detailInfo.compareValue)} ${detailInfo.symbol ?? ''}`,
        }
      : ({} as ApprovalDetailItem);

    return [
      {
        list: [
          {
            label: t('screening_monitoring_0076'),
            value:
              processResult !== undefined
                ? t(`transaction_monitoring_type_${processResult}` as never)
                : null,
          },
        ],
      },
      {
        title: t('screening_monitoring_0004'),
        list: [
          { label: t('screening_monitoring_0015'), value: String(detailInfo.walletAddress ?? '') },
          { label: t('screening_monitoring_0001'), value: String(detailInfo.stablecoinName ?? '') },
          { label: t('PUB_Blockchain'), value: String(detailInfo.blockchainName ?? '') },
          {
            label: t('screening_monitoring_0011'),
            value:
              resultPriority !== undefined ? (
                <span
                  style={{
                    color: t(`risk_level_color_${resultPriority}` as never),
                  }}
                >
                  {t(`risk_level_type_${resultPriority}` as never)}
                </span>
              ) : null,
          },
          {
            label: t('screening_monitoring_0074'),
            value:
              processingType !== undefined
                ? t(`suggested_action_type_${processingType}` as never)
                : null,
          },
        ],
      },
      {
        title: t('screening_monitoring_0038'),
        list: [
          { label: t('screening_monitoring_0000'), value: String(detailInfo.ruleName ?? '') },
          // §8 源 bug ⑥：BusinessName 大写驼峰，保留后端字段名（勿纠正为 businessName）。
          { label: t('screening_monitoring_0002'), value: String(detailInfo.BusinessName ?? '') },
          {
            label: t('screening_monitoring_0019'),
            value: `${detailInfo.description ?? ''}${descriptionSuffix}`,
          },
          currentValueItem,
          compareValueItem,
          {
            label: t('screening_monitoring_0016'),
            value: formatTimestamp(toNum(detailInfo.monitorDate)),
          },
        ],
      },
      {
        title: t('screening_monitoring_0060'),
        list: [
          { label: t('PUB_Creater'), value: String(detailInfo.createdBy ?? '') },
          {
            label: t('PUB_CreateTime'),
            value: formatTimestamp(toNum(detailInfo.createdOn)),
            showBorder: true,
          },
          {
            label: t('screening_monitoring_0055'),
            value: detailInfo.comments === '' ? '--' : String(detailInfo.comments ?? ''),
          },
        ],
      },
      {
        title: t('screening_monitoring_0064'),
        list: [
          {
            label: t('screening_monitoring_0062'),
            value:
              detailInfo.transactionHash === null
                ? '--'
                : String(detailInfo.transactionHash ?? ''),
          },
          {
            label: t('screening_monitoring_0063'),
            value: formatTimestamp(toNum(detailInfo.transactionTime)),
            showBorder: true,
          },
          {
            label: t('PUB_Status'),
            value: status !== undefined ? <ApprovalStatusBadge family="task" status={status} /> : null,
            showBorder: true,
          },
        ],
      },
    ];
  }, [detailInfo, t]);

  return <ApprovalDetailGrid sections={sections} />;
}
