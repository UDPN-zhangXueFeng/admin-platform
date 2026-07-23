/**
 * FinancialPostingRuleApproval — 记账规则审批详情（迁移自 td-manage
 * `src/pages/approval-manage/components/financial-posting-rule.tsx`，410 行）。
 *
 * 业务语义：审批「记账规则（Posting Rule）」请求，展示 Request Information
 * （operationType/status/createdBy/createdOn）+ Posting Rule 信息（postingRuleId/
 * sourceEventType/versionId/effectiveDate/financialBook/currency/tokenType）
 * + Normalized Target Fields 标签组 + Entry Template 表（Dr/Cr + account + method + value）。
 *
 * 与 {@link FinancialNormalizationApproval} 高度同构（同族 financial 审核组件），
 * 复用 `financial-info-primitives`（InfoSection/InfoGrid/FinancialStatusBadge/
 * pickFirstValue/pickFirstRaw/useFinancialT，勿两处各写，Rule 7/8）。
 *
 * 迁移要点（文档 §7 步骤 11）：
 * - operationType 复用 util `inferOperationType`，**传 allowActivateDeactivate:false**
 *   收窄为 posting 2 态子集（Update/Create，屏蔽 Activate/Deactivate）。
 * - status 20/35 特殊态：FinancialStatusBadge 传 `succeedKey='PUB_Succeed'` 覆盖文案（源 renderStatus）。
 * - getDirectionLabel（Dr/Cr）复用 util（源 financial-posting-rule.tsx:94）。
 * - getMappingMethodLabel 复用 util `getMappingMethodLabelKey`（取 normalization 全集超集，posting 调用方无须区分）。
 * - DEFAULT_AMOUNT_EXPRESSION='Transaction Amount'（源内联常量，amountExpression 缺失时兜底）。
 * - InfoGrid 用 columns=2 的 4 格行（与 normalization 单列布局不同）。
 *
 * 只读展示组件（不调 API）。i18n：financial_* / PUB_* key 在目标命名空间可能未补全，
 * 经 useFinancialT 缺 key 回退 key 本身（不崩）。
 */
'use client';

import * as React from 'react';

import { CopyableEllipsisText } from '@myorg/shared/ui';
import {
  EMPTY_FIELD_VALUE,
  EVENT_TYPE_SOURCE_EVENT_MAP,
  getDirectionLabel,
  getMappingMethodLabelKey,
  inferOperationType,
  formatFinancialDate,
  formatFinancialDateTime,
} from '@myorg/modules/approval-manage/util';

import {
  FinancialStatusBadge,
  InfoGrid,
  InfoSection,
  pickFirstRaw,
  pickFirstValue,
  useFinancialT,
} from './financial-info-primitives';

/** posting-rule 组件 props（同 normalization，detailInfo=businessContent + 四件套 + busCode）。 */
export interface FinancialPostingRuleApprovalProps {
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

/** Entry Template 表行（迁移自源 EntryTemplateRow）。 */
interface EntryTemplateRow {
  key: string;
  drCr: string;
  account: string;
  method: string;
  value: string;
}

/**
 * amountExpression 缺失时的兜底文案（迁移自源 DEFAULT_AMOUNT_EXPRESSION）。
 * 源硬编码 'Transaction Amount'，目标保留语义（无 i18n key，直接展示英文）。
 */
const DEFAULT_AMOUNT_EXPRESSION = 'Transaction Amount';

/**
 * sourceEventType → i18n label key（与 normalization 同构，本地内联保持自洽，
 * 避免跨模块耦合，见 util constants 设计取舍注释）。键值与 normalization 相同。
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

/** mappingMethod → label（复用 util getMappingMethodLabelKey 全集超集）。 */
function getMappingMethodLabel(
  t: (key: string) => string,
  mappingMethod?: number | string
): string {
  const key = getMappingMethodLabelKey(mappingMethod);
  return key ? t(key) : EMPTY_FIELD_VALUE;
}

/** accountCode + accountName → 'code - name'（迁移自源 getAccountLabel）。 */
function getAccountLabel(
  accountCode?: string,
  accountName?: string
): string {
  const parts = [accountCode, accountName].filter(Boolean);
  return parts.length > 0 ? parts.join(' - ') : EMPTY_FIELD_VALUE;
}

/**
 * tokenType label（迁移自源 getTokenTypeLabel）。
 *
 * 源从 runtimeInfo 多别名（token/tokenInfo/tokenDetail/tokens[0]）挖 tokenTypeName，
 * 缺失则 token_type_${n}。目标保留全部别名兜底逻辑（后端字段命名不统一，文档 §8）。
 * token_type_ key 可能未补全，经 useFinancialT 回退 key 本身。
 */
function getTokenTypeLabel(
  t: (key: string) => string,
  runtimeInfo: Record<string, unknown>
): string {
  const tokenInfo =
    (runtimeInfo.token as Record<string, unknown>) ||
    (runtimeInfo.tokenInfo as Record<string, unknown>) ||
    (runtimeInfo.tokenDetail as Record<string, unknown>) ||
    ((runtimeInfo.tokens as Array<Record<string, unknown>> | undefined)?.[0] ??
      {});
  const tokenTypeName =
    (tokenInfo.tokenTypeName as string) ||
    (tokenInfo.tokenTypeLabel as string) ||
    (runtimeInfo.tokenTypeName as string) ||
    (runtimeInfo.tokenTypeLabel as string);
  const tokenType =
    tokenInfo.tokenType ??
    tokenInfo.issueType ??
    tokenInfo.mintMethod ??
    runtimeInfo.tokenType ??
    runtimeInfo.issueType ??
    runtimeInfo.mintMethod;

  if (tokenTypeName) return String(tokenTypeName);
  if (tokenType === undefined || tokenType === null || tokenType === '') {
    return EMPTY_FIELD_VALUE;
  }
  return t(`token_type_${tokenType}`);
}

export function FinancialPostingRuleApproval({
  detailInfo,
  approvalInfo,
  taskInfo,
  approvalStatus,
  busCode,
}: FinancialPostingRuleApprovalProps) {
  const t = useFinancialT();
  const info = (detailInfo ?? {}) as Record<string, unknown>;
  const taskCreateInfo = (taskInfo?.taskCreateInfo ?? {}) as Record<
    string,
    unknown
  >;
  const approval = (approvalInfo ?? {}) as Record<string, unknown>;

  // operationType：posting 2 态子集（allowActivateDeactivate:false），源 getOperationType。
  const operationType = inferOperationType(
    busCode,
    info.recordType as number | string | undefined,
    undefined,
    { allowActivateDeactivate: false }
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

  const postingRuleId = pickFirstValue(
    info.eventCode as string,
    info.postingRuleId as string,
    info.postingEventId as string
  );
  const versionId = pickFirstValue(info.versionId as string);

  const targetFields = React.useMemo<string[]>(
    () =>
      (Array.isArray(info.normalizedTargetFields)
        ? info.normalizedTargetFields
        : []
      )
        .map(
          (field) =>
            ((field as Record<string, unknown>)?.targetField as string) ??
            EMPTY_FIELD_VALUE
        )
        .filter((field) => field && field !== EMPTY_FIELD_VALUE),
    [info.normalizedTargetFields]
  );

  const entryTemplateRows = React.useMemo<EntryTemplateRow[]>(
    () =>
      (Array.isArray(info.mappings) ? info.mappings : [])
        .slice()
        .sort(
          (leftRaw, rightRaw) => {
            const left = (leftRaw ?? {}) as Record<string, unknown>;
            const right = (rightRaw ?? {}) as Record<string, unknown>;
            return (
              (Number(left.sortOrder) || 0) -
                (Number(right.sortOrder) || 0) ||
              (Number(left.direction) || 0) - (Number(right.direction) || 0)
            );
          }
        )
        .map((mappingRaw, index) => {
          const mapping = (mappingRaw ?? {}) as Record<string, unknown>;
          return {
            key: String(mapping.postingEventAccountMappingId || index),
            drCr: getDirectionLabel(
              mapping.direction as number | string | undefined
            ),
            account: getAccountLabel(
              mapping.accountCode as string,
              mapping.accountName as string
            ),
            method: getMappingMethodLabel(
              t,
              mapping.mappingMethod as number | string | undefined
            ),
            value:
              (mapping.amountExpression as string) || DEFAULT_AMOUNT_EXPRESSION,
          };
        }),
    [info.mappings, t]
  );

  return (
    <div className="rounded border bg-card p-5 pb-6">
      <div className="border-b pb-4 text-base font-semibold text-foreground">
        <span>Posting Rule Update Request Details</span>
      </div>

      <InfoSection title="Request Information">
        <InfoGrid
          columns={2}
          rows={[
            [
              { content: 'Operation Type', isLabel: true },
              { content: operationType },
              { content: 'Status', isLabel: true },
              {
                content: (
                  <FinancialStatusBadge
                    t={t}
                    status={requestStatus as number | undefined}
                    succeedKey="PUB_Succeed"
                  />
                ),
              },
            ],
            [
              { content: 'Created by', isLabel: true },
              { content: createdBy },
              { content: 'Created on', isLabel: true },
              { content: createdOn },
            ],
          ]}
        />
      </InfoSection>

      <InfoSection title={t('financial_0360')}>
        <InfoGrid
          columns={2}
          rows={[
            [
              { content: t('financial_0330'), isLabel: true },
              {
                content: (
                  <CopyableEllipsisText
                    value={postingRuleId}
                    className="!mb-0"
                  />
                ),
              },
              { content: t('financial_0100'), isLabel: true },
              {
                content: getSourceEventTypeLabel(
                  t,
                  Number(info.eventType)
                ),
              },
            ],
            [
              { content: t('financial_0331'), isLabel: true },
              {
                content: (
                  <CopyableEllipsisText
                    value={versionId}
                    className="!mb-0"
                  />
                ),
              },
              { content: t('financial_0278'), isLabel: true },
              { content: formatFinancialDate(info.effectiveDate as number) },
            ],
            [
              { content: t('financial_0215'), isLabel: true },
              {
                content: pickFirstValue(
                  info.bookName as string,
                  info.financialBookName as string
                ),
              },
              { content: t('financial_0216'), isLabel: true },
              { content: pickFirstValue(info.bookNo as string, info.bookId as string) },
            ],
            [
              { content: t('financial_0218'), isLabel: true },
              {
                content: pickFirstValue(
                  info.currencyCode as string,
                  info.accountCurrency as string
                ),
              },
              { content: t('financial_0219'), isLabel: true },
              { content: getTokenTypeLabel(t, info) },
            ],
          ]}
        />
      </InfoSection>

      <InfoSection title="Normalized Target Fields">
        <div className="flex flex-wrap gap-4 rounded-sm border border-border p-4">
          {(targetFields.length > 0
            ? targetFields
            : [EMPTY_FIELD_VALUE]
          ).map((field) => (
            <span
              key={field}
              className="rounded border border-border bg-muted px-5 py-3"
            >
              {field}
            </span>
          ))}
        </div>
      </InfoSection>

      <InfoSection title="Entry Template">
        <EntryTemplateTable
          rows={entryTemplateRows}
          emptyText={t('PUB_NoData')}
        />
      </InfoSection>
    </div>
  );
}

/** Entry Template 表（迁移自源 antd Table → 原生 table，4 列）。 */
function EntryTemplateTable({
  rows,
  emptyText,
}: {
  rows: EntryTemplateRow[];
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
        <col className="w-[90px]" />
        <col className="w-[360px]" />
        <col className="w-[220px]" />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th className="border border-border bg-muted px-2 py-3 text-left font-normal">
            Dr/Cr
          </th>
          <th className="border border-border bg-muted px-2 py-3 text-left font-normal">
            Account
          </th>
          <th className="border border-border bg-muted px-2 py-3 text-left font-normal">
            Method
          </th>
          <th className="border border-border bg-muted px-2 py-3 text-left font-normal">
            Value
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td className="border border-border px-2 py-3 break-words">
              {row.drCr}
            </td>
            <td className="border border-border px-2 py-3 break-words">
              {row.account}
            </td>
            <td className="border border-border px-2 py-3 break-words">
              {row.method}
            </td>
            <td className="border border-border px-2 py-3 break-words">
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
