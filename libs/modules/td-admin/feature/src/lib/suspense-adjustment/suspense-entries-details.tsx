'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Card, CopyableEllipsisText } from '@myorg/shared/ui';

import {
  CLEAR_STATUS_MAP,
  formatAmount,
  textOrDash,
  type SuspenseAdjustmentDetail,
} from '@myorg/modules/td-admin/data-access';
import { SuspenseStatusBadge } from './suspense-status-badge';

interface MetaCell {
  key: string;
  label: string;
  value: React.ReactNode;
}

/**
 * SuspenseEntriesDetails — 调账编辑页的「Suspense Entries Details」只读区。
 *
 * 1:1 迁移自 td-manage `pages/financial/adjustments/edit.tsx` 的
 * `SuspenseEntriesDetails`：顶部 Status/Age 标签 + 元信息表（Suspense Txn ID /
 * Source Type / Transaction Type / Finance Book / Book ID / Created By / Created On）+
 * 分录明细表（Posting Date / Transaction ID / Dr-Cr / Account / Debit Amount /
 * Credit Amount / Exception Context）。
 */
export function SuspenseEntriesDetails({
  detail,
}: {
  detail: SuspenseAdjustmentDetail;
}) {
  const t = useTranslations('modules.suspense-adjustment');
  const statusMeta = CLEAR_STATUS_MAP[detail.status];

  const metaCells: MetaCell[] = [
    {
      key: 'suspenseTxnId',
      label: t('field.suspenseTxnId'),
      value: <CopyableEllipsisText value={detail.suspenseTxnId} />,
    },
    {
      key: 'sourceType',
      label: t('field.sourceType'),
      value: textOrDash(detail.sourceTypeLabel),
    },
    {
      key: 'transactionType',
      label: t('field.transactionType'),
      value: textOrDash(detail.transactionTypeLabel),
    },
    {
      key: 'financeBookName',
      label: t('field.financeBookName'),
      value: textOrDash(detail.financeBookName),
    },
    {
      key: 'bookId',
      label: t('field.bookId'),
      value: (
        <CopyableEllipsisText value={textOrDash(detail.bookNo || detail.bookId)} />
      ),
    },
    {
      key: 'createdBy',
      label: t('field.createdBy'),
      value: textOrDash(detail.createdBy),
    },
    {
      key: 'createdOn',
      label: t('field.createdOn'),
      value: textOrDash(detail.createdOn),
    },
  ];

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div className="text-sm font-semibold">
          {t('edit.suspenseEntriesDetails')}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SuspenseStatusBadge
            tone={statusMeta?.color ?? 'default'}
            label={`${t('field.status')}: ${detail.statusLabel}`}
          />
          <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {t('field.age')}: {t('ageDays', { count: detail.age })}
          </span>
        </div>
      </div>

      <div className="space-y-5 px-5 pb-5 pt-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] table-fixed border-collapse text-left text-sm">
            <thead>
              <tr className="bg-muted/30">
                {metaCells.map((cell) => (
                  <th
                    key={cell.key}
                    className="border px-3 py-3 font-normal text-muted-foreground"
                  >
                    {cell.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {metaCells.map((cell) => (
                  <td key={cell.key} className="break-all border px-3 py-3">
                    {cell.value}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] table-fixed border-collapse text-left text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th className="w-[140px] border px-3 py-3 font-normal text-muted-foreground">
                  {t('field.postingDate')}
                </th>
                <th className="w-[140px] border px-3 py-3 font-normal text-muted-foreground">
                  {t('field.transactionId')}
                </th>
                <th className="w-[70px] border px-3 py-3 font-normal text-muted-foreground">
                  {t('field.drCr')}
                </th>
                <th className="w-[360px] border px-3 py-3 font-normal text-muted-foreground">
                  {t('field.account')}
                </th>
                <th className="w-[170px] border px-3 py-3 font-normal text-muted-foreground">
                  {t('field.debitAmount')}
                </th>
                <th className="w-[170px] border px-3 py-3 font-normal text-muted-foreground">
                  {t('field.creditAmount')}
                </th>
                <th className="w-[420px] border px-3 py-3 font-normal text-muted-foreground">
                  {t('field.exceptionContext')}
                </th>
              </tr>
            </thead>
            <tbody>
              {detail.suspenseEntries.length ? (
                detail.suspenseEntries.map((line, index) => (
                  <tr key={`${line.drCr}-${line.accountCode}-${index}`}>
                    <td className="border px-3 py-3">
                      {textOrDash(line.postingDate)}
                    </td>
                    <td className="border px-3 py-3">
                      {line.transactionId ? (
                        <CopyableEllipsisText value={line.transactionId} />
                      ) : (
                        '--'
                      )}
                    </td>
                    <td
                      className={`border px-3 py-3 font-medium ${
                        line.drCr === 'Dr' ? 'text-primary' : 'text-red-600'
                      }`}
                    >
                      {line.drCr}
                    </td>
                    <td className="border px-3 py-3">
                      {textOrDash(line.accountDisplay)}
                    </td>
                    <td className="border px-3 py-3">
                      {line.debitAmount != null
                        ? formatAmount(line.debitAmount, detail.currency)
                        : '--'}
                    </td>
                    <td className="border px-3 py-3">
                      {line.creditAmount != null
                        ? formatAmount(line.creditAmount, detail.currency)
                        : '--'}
                    </td>
                    <td className="border px-3 py-3">
                      {textOrDash(
                        line.exceptionContext || detail.exceptionContext,
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="border px-3 py-8 text-center text-muted-foreground"
                  >
                    {t('empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
