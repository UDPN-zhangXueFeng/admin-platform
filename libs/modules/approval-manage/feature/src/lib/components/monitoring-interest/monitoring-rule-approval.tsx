'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import {
  ApprovalDetailGrid,
  ApprovalStatusBadge,
  type ApprovalDetailItem,
  type ApprovalDetailSection,
} from '@myorg/modules/approval-manage/ui';
import { formatTimestamp } from '@myorg/modules/approval-manage/util';

/**
 * MonitoringRuleApproval — 监控规则审核详情（迁移自 td-manage
 * `src/pages/approval-manage/components/monitoring-rule.tsx`，245 行）。
 *
 * 只读展示组件，接收 `detailInfo`（=approvedDetail.businessContent，dispatcher 透传）
 * 与可选 `type`（busCode 派生的操作类型 1/2/3/4 = save/update/activate/deactivate）。
 *
 * 迁移要点（§7 步骤 9）：
 * - **阈值区间表新旧差异**：type===2（update）时额外渲染 oldDetailList 旧值表
 *   （label 追加 `approval_manage_0039` 「(Before)」后缀）；非 update 仅 detailList。
 * - **risk_level 动态 i18n**：alertList label 模板 `screening_monitoring_0053`
 *   内嵌 `${type}`（risk_level_type_）+ `${total}`（contactInfo 逗号计数）；
 *   表格 priority 列文案 `risk_level_type_${n}` + 颜色 `risk_level_color_${n}`（行内 style）。
 * - **alertList 动态 label**：每个告警等级一行，contactInfo 展示在灰底滚动区。
 *
 * **类型策略（Rule 8/3）**：detailInfo 来自 dispatcher 透传的
 * `Record<string, unknown>`，组件内用局部宽松类型取值（不重建业务实体类型）。
 *
 * **i18n**：扁平 key（namespace 已是 modules.approval-manage，无双重前缀）。
 * 动态前缀 key（monitoring_rule_type_/risk_level_type_/risk_level_color_/rule_action_/
 * screening_monitoring_*）在 T14 i18n 注册阶段统一补全。
 */

/** 阈值区间行（detailList / oldDetailList 元素，宽松类型）。 */
interface ThresholdRow {
  minValue?: number | string;
  maxValue?: number | string;
  riskScoring?: string | number;
  priority?: number;
  handleType?: number;
}

/** 告警等级项（alertList 元素）。 */
interface AlertItem {
  priority?: number;
  contactInfo?: string;
}

/** 字段取值辅助：detailInfo 宽松取值。 */
type DetailInfo = Record<string, unknown>;

/** 安全读取阈值区间行数组。 */
function readRows(value: unknown): ThresholdRow[] {
  return Array.isArray(value) ? (value as ThresholdRow[]) : [];
}

/** 安全读取告警数组。 */
function readAlerts(value: unknown): AlertItem[] {
  return Array.isArray(value) ? (value as AlertItem[]) : [];
}

/** 安全取数值。 */
function toNum(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** 区间单元格（minValue - maxValue，unit===2 追加 %）。迁移自源 columns.render。 */
function renderRangeCell(row: ThresholdRow, unit: unknown): string {
  const suffix = Number(unit) === 2 ? ' % ' : '';
  return `${row.minValue ?? ''}${suffix}- ${row.maxValue ?? ''}${suffix}`;
}

/**
 * 阈值区间表（迁移自源 antd <Table>，columns：区间/风险评分/风险等级/处理方式）。
 *
 * 用原生 <table>（同 posting-engine book-detail 模式），非 DataTable（DataTable 绑定
 * id 字段 + 分页，此处为静态无分页小表）。
 */
function ThresholdTable({
  rows,
  unit,
}: {
  rows: ThresholdRow[];
  unit: unknown;
}) {
  const t = useTranslations('modules.approval-manage');
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/40">
            <th className="w-[20%] border px-2 py-1.5 text-left font-medium">
              {t('screening_monitoring_0041')}
            </th>
            <th className="w-[28%] border px-2 py-1.5 text-left font-medium">
              {t('screening_monitoring_0010')}
            </th>
            <th className="border px-2 py-1.5 text-left font-medium">
              {t('screening_monitoring_0011')}
            </th>
            <th className="w-[100px] border px-2 py-1.5 text-left font-medium">
              {t('screening_monitoring_0032')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const priority = toNum(row.priority);
            const handleType = toNum(row.handleType);
            return (
              <tr key={idx}>
                <td className="border px-2 py-1.5">{renderRangeCell(row, unit)}</td>
                <td className="border px-2 py-1.5">{row.riskScoring ?? ''}</td>
                <td className="border px-2 py-1.5">
                  {priority !== undefined ? (
                    <span
                      style={{
                        color: t(`risk_level_color_${priority}` as never),
                      }}
                    >
                      {t(`risk_level_type_${priority}` as never)}
                    </span>
                  ) : null}
                </td>
                <td className="border px-2 py-1.5">
                  {handleType !== undefined
                    ? t(`rule_action_${handleType}` as never)
                    : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export interface MonitoringRuleApprovalProps {
  /** approvedDetail.businessContent（dispatcher 透传，宽松类型）。 */
  detailInfo?: DetailInfo;
  /** 操作类型 1/2/3/4 = save/update/activate/deactivate（busCode 派生）。 */
  type?: number;
}

export function MonitoringRuleApproval({
  detailInfo,
  type,
}: MonitoringRuleApprovalProps) {
  const t = useTranslations('modules.approval-manage');

  const sections = React.useMemo<ApprovalDetailSection[]>(() => {
    if (!detailInfo) return [];

    const opType = type ?? 0;
    const detailList = readRows(detailInfo.detailList);
    const oldDetailList = readRows(detailInfo.oldDetailList);
    const alertList = readAlerts(detailInfo.alertList);
    const status = toNum(detailInfo.status);

    // alertList 动态 label（源 monitoring-rule.tsx:27-41）
    // 模板 screening_monitoring_0053 内嵌 ${type}（risk_level_type_）+ ${total}（contactInfo 计数）。
    const alertItems: ApprovalDetailItem[] = alertList
      .map((el): ApprovalDetailItem | null => {
        const priority = toNum(el.priority);
        if (priority === undefined) return null;
        const contactInfo = el.contactInfo ?? '';
        const total = contactInfo ? contactInfo.split(',').length : 0;
        const label = t('screening_monitoring_0053')
          .replace('{type}', t(`risk_level_type_${priority}` as never))
          .replace('{total}', String(total));
        return {
          label,
          isTable: true,
          value: (
            <div className="h-20 overflow-y-auto break-all rounded bg-muted p-2 text-sm">
              {contactInfo}
            </div>
          ),
        };
      })
      .filter((v): v is ApprovalDetailItem => v !== null);

    return [
      {
        list: [
          {
            label: t('tokenized_deposit_0042'),
            value: t(`monitoring_rule_type_${opType}` as never),
          },
        ],
      },
      {
        title: t('screening_monitoring_0004'),
        list: [
          { label: t('screening_monitoring_0000'), value: String(detailInfo.ruleName ?? '') },
          { label: t('screening_monitoring_0001'), value: String(detailInfo.tokenName ?? '') },
          { label: t('PUB_Blockchain'), value: String(detailInfo.blockchainName ?? '') },
          { label: t('screening_monitoring_0002'), value: String(detailInfo.businessName ?? '') },
        ],
      },
      {
        title: t('screening_monitoring_0038'),
        list: [
          {
            label: t('screening_monitoring_0003'),
            // update 且频率名变更时展示「Updated from X to Y」（源 monitoring-rule.tsx:79-88）
            value:
              opType === 2 &&
              detailInfo.oldMonitorFrequencyName !== detailInfo.monitorFrequencyName
                ? `${t('approval_manage_0042')} ${detailInfo.oldMonitorFrequencyName ?? ''} ${t('approval_manage_0043')} ${detailInfo.monitorFrequencyName ?? ''}`
                : String(detailInfo.monitorFrequencyName ?? ''),
          },
          {
            // label 追加「(After)」后缀（仅 update，源 approval_manage_0038）
            label:
              t('screening_monitoring_0040') +
              (opType === 2 ? t('approval_manage_0038') : ''),
            isTable: true,
            value: <ThresholdTable rows={detailList} unit={detailInfo.unit} />,
          },
          // update：额外渲染旧值表（label 追加 approval_manage_0039 「(Before)」）
          ...(opType === 2
            ? [
                {
                  label:
                    t('screening_monitoring_0040') + t('approval_manage_0039'),
                  isTable: true,
                  value: (
                    <ThresholdTable
                      rows={oldDetailList}
                      unit={detailInfo.unit}
                    />
                  ),
                } as ApprovalDetailItem,
              ]
            : []),
        ].filter((item): item is ApprovalDetailItem => item !== null),
      },
      // alertList section（源 monitoring-rule.tsx:198-201：有数据才显示 title）
      ...(alertItems.length > 0
        ? [{ title: t('screening_monitoring_0039'), list: alertItems }]
        : []),
      {
        list: [
          { label: t('PUB_Creater'), value: String(detailInfo.createUser ?? '') },
          {
            label: t('PUB_CreateTime'),
            value: formatTimestamp(toNum(detailInfo.createDate)),
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
  }, [detailInfo, type, t]);

  return <ApprovalDetailGrid sections={sections} />;
}
