/**
 * FinancialNormalizationApproval — 规范化规则审批详情（迁移自 td-manage
 * `src/pages/approval-manage/components/financial-normalization.tsx`，373 行）。
 *
 * 业务语义：审批「规范化规则」请求，展示 Request Information（operationType/status/
 * createdBy/createdOn）+ 规则基本信息（mappingRuleId/sourceEventType/effectiveDate）
 * + mapping 表（targetField/mappingMethod/sourceField/description）。
 *
 * 迁移要点（文档 §7 步骤 11）：
 * - 复用 util `EVENT_TYPE_SOURCE_EVENT_MAP` + `FIELD_LABEL_KEY_MAP` + `getMappingMethodLabelKey`。
 * - sourceEventType label 复用 tx-event-config 命名空间 label key 映射语义（源 getMappingRuleSourceEventTypeLabelKey）。
 * - InfoSection / InfoGrid 单列布局，复用本域 `financial-info-primitives`（勿两处各写）。
 * - operationType 复用 util `inferOperationType`（三级推断全集，含 Activate/Deactivate）。
 *
 * 只读展示组件（不调 API）。i18n：financial_* / PUB_* key 在目标命名空间可能未补全，
 * 经 useFinancialT 缺 key 回退 key 本身（不崩）。state badge 复用 common_task_status_ +
 * approval_task_status_color_（已补全）。
 */
'use client';

import * as React from 'react';

import { CopyableEllipsisText } from '@myorg/shared/ui';
import {
  EVENT_TYPE_SOURCE_EVENT_MAP,
  EMPTY_FIELD_VALUE,
  FIELD_LABEL_KEY_MAP,
  formatFinancialDate,
  formatFinancialDateTime,
  getMappingMethodLabelKey,
  inferOperationType,
} from '@myorg/modules/approval-manage/util';

import {
  FinancialStatusBadge,
  InfoGrid,
  InfoSection,
  pickFirstRaw,
  pickFirstValue,
  useFinancialT,
} from './financial-info-primitives';

/** normalization 组件 props（detailInfo=businessContent + 可选四件套 + busCode）。 */
export interface FinancialNormalizationApprovalProps {
  detailInfo?: Record<string, unknown>;
  approvalInfo?: Record<string, unknown>;
  taskInfo?: {
    taskStatus?: number;
    taskCreateInfo?: Record<string, unknown>;
    [k: string]: unknown;
  };
  approvalStatus?: number;
  busCode?: string;
}

/** mapping 表行（迁移自源 MappingRow）。 */
interface MappingRow {
  key: string;
  targetField: string;
  mappingMethod: string;
  sourceField: string;
  description: string;
}

/**
 * sourceEventType → i18n label key（迁移自源 getSourceEventTypeLabel +
 * getMappingRuleSourceEventTypeLabelKey）。
 *
 * 源从 tx-event-config mock 取 labelKey 函数；目标 util 已合并 EVENT_TYPE_SOURCE_EVENT_MAP，
 * 此处内联 labelKey 映射（与 tx-event-config util / posting-engine util 同构，本地自洽，
 * 避免跨模块耦合，见 util constants 设计取舍注释）。
 */
const SOURCE_EVENT_LABEL_KEY: Record<string, string> = {
  reserveIn: 'financial_0300',
  fundingIn: 'financial_0301',
  mint: 'financial_0302',
  repositoryOut: 'financial_0303',
  transfer: 'financial_0304',
  repositoryIn: 'financial_0305',
  melt: 'financial_0306',
  reserveOut: 'financial_0307',
  fundingOut: 'financial_0308',
};

/** 字段 → i18n label（迁移自源 getFieldLabel，FIELD_LABEL_KEY_MAP 查表）。 */
function getFieldLabel(
  t: (key: string) => string,
  field?: string
): string {
  if (!field) return EMPTY_FIELD_VALUE;
  const key = FIELD_LABEL_KEY_MAP[field];
  return key ? t(key) : field;
}

/** sourceEventType → label（迁移自源 getSourceEventTypeLabel）。 */
function getSourceEventTypeLabel(
  t: (key: string) => string,
  eventType?: number
): string {
  if (!eventType) return EMPTY_FIELD_VALUE;
  const sourceEventType = EVENT_TYPE_SOURCE_EVENT_MAP[eventType];
  if (!sourceEventType) return EMPTY_FIELD_VALUE;
  const labelKey = SOURCE_EVENT_LABEL_KEY[sourceEventType];
  return labelKey ? t(labelKey) : EMPTY_FIELD_VALUE;
}

/** mappingMethod → label（复用 util getMappingMethodLabelKey 取全集，Rule 7）。 */
function getMappingMethodLabel(
  t: (key: string) => string,
  mappingMethod?: number | string
): string {
  const key = getMappingMethodLabelKey(mappingMethod);
  return key ? t(key) : EMPTY_FIELD_VALUE;
}

export function FinancialNormalizationApproval({
  detailInfo,
  approvalInfo,
  taskInfo,
  approvalStatus,
  busCode,
}: FinancialNormalizationApprovalProps) {
  const t = useFinancialT();
  const info = (detailInfo ?? {}) as Record<string, unknown>;
  const taskCreateInfo = (taskInfo?.taskCreateInfo ?? {}) as Record<
    string,
    unknown
  >;
  const approval = (approvalInfo ?? {}) as Record<string, unknown>;

  const operationType = inferOperationType(
    busCode,
    info.recordType as number | string | undefined
  );
  const requestStatus = pickFirstRaw(taskInfo?.taskStatus, approvalStatus);
  const createdBy = pickFirstValue(
    taskCreateInfo.createUserName,
    approval.createUserName,
    approval.createdBy,
    info.createUserName,
    info.createdBy,
    info.creator
  );
  const createdOn = formatFinancialDateTime(
    pickFirstRaw(
      taskCreateInfo.createTime,
      approval.createTime,
      approval.createdOn,
      info.createTime,
      info.createdOn
    ) as number | undefined
  );

  const sourceEventType = Number(info.eventType);

  const mappingRuleId =
    (info.eventCode as string) ||
    (info.versionId as string) ||
    (info.mappingRuleId as string) ||
    (info.normalizationEventId
      ? String(info.normalizationEventId)
      : EMPTY_FIELD_VALUE);

  const mappingRows = React.useMemo<MappingRow[]>(
    () =>
      (Array.isArray(info.mappings) ? info.mappings : []).map(
        (raw, index) => {
          const item = (raw ?? {}) as Record<string, unknown>;
          return {
            key: String(item.normalizationEventMappingId || index),
            targetField: getFieldLabel(
              t,
              (item.targetField as string) || (item.mappingField as string)
            ),
            mappingMethod: getMappingMethodLabel(
              t,
              (item.mappingType as number | string) ||
                (item.mappingMethod as number | string)
            ),
            sourceField: (item.fieldDesc as string) ||
              getFieldLabel(t, item.sourceField as string),
            description:
              (item.description as string) ||
              (item.remarks as string) ||
              (item.fieldValue as string) ||
              EMPTY_FIELD_VALUE,
          };
        }
      ),
    [info.mappings, t]
  );

  return (
    <div className="rounded border bg-card p-5 pb-6">
      <div className="border-b pb-4 text-base font-semibold text-foreground">
        <span>Normalization Rule Update Request Details</span>
      </div>

      <InfoSection title="Request Information">
        <InfoGrid
          columns={1}
          rows={[
            [
              { content: 'Operation Type', isLabel: true },
              { content: operationType },
            ],
            [
              { content: 'Status', isLabel: true },
              {
                content: (
                  <FinancialStatusBadge
                    t={t}
                    status={requestStatus as number | undefined}
                  />
                ),
              },
            ],
            [
              { content: 'Created by', isLabel: true },
              { content: createdBy },
            ],
            [
              { content: 'Created on', isLabel: true },
              { content: createdOn },
            ],
          ]}
        />
      </InfoSection>

      <InfoSection title={t('financial_0320')}>
        <InfoGrid
          columns={1}
          rows={[
            [
              { content: t('financial_0277'), isLabel: true },
              {
                content: (
                  <CopyableEllipsisText
                    value={mappingRuleId}
                    className="!mb-0"
                  />
                ),
              },
            ],
            [
              { content: t('financial_0100'), isLabel: true },
              { content: getSourceEventTypeLabel(t, sourceEventType) },
            ],
            [
              { content: t('financial_0278'), isLabel: true },
              { content: formatFinancialDate(info.effectiveDate as number) },
            ],
          ]}
        />
      </InfoSection>

      <InfoSection title={t('financial_0287')}>
        <MappingTable rows={mappingRows} emptyText={t('PUB_NoData')} />
      </InfoSection>
    </div>
  );
}

/** mapping 表（迁移自源 antd Table → 原生 table，posting 同构）。 */
function MappingTable({
  rows,
  emptyText,
}: {
  rows: MappingRow[];
  emptyText: string;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-sm border border-border px-3 py-3 text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <colgroup>
        <col className="w-[240px]" />
        <col className="w-[160px]" />
        <col className="w-[200px]" />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th className="border border-border bg-muted px-2 py-3 text-left font-normal">
            Target Field
          </th>
          <th className="border border-border bg-muted px-2 py-3 text-left font-normal">
            Mapping Method
          </th>
          <th className="border border-border bg-muted px-2 py-3 text-left font-normal">
            Source Field
          </th>
          <th className="border border-border bg-muted px-2 py-3 text-left font-normal">
            Description
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td className="border border-border px-2 py-3 break-words">
              {row.targetField}
            </td>
            <td className="border border-border px-2 py-3 break-words">
              {row.mappingMethod}
            </td>
            <td className="border border-border px-2 py-3 break-words">
              {row.sourceField}
            </td>
            <td className="border border-border px-2 py-3 break-words">
              {row.description}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
