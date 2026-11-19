'use client';

import { useTranslations } from 'next-intl';
import { CopyableEllipsisText } from '@myorg/shared/ui';
import { textOrDash, type SuspenseAdjustmentDetail } from '@myorg/modules/td-admin/data-access';

export function SuspenseEntryTable({ detail }: { detail: SuspenseAdjustmentDetail }) {
  const t = useTranslations('modules.suspense-adjustment');
  const entries = detail.suspenseEntries;
  const first = entries[0];
  const transactionId = detail.transactionId || first?.transactionId;
  const columns = ['postingDate', 'transactionId', 'drCr', 'account', 'exceptionContext', 'createdBy', 'createdOn'] as const;
  const cell = 'px-4 py-3 align-top';

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[980px] border-collapse text-left text-sm">
        <thead className="bg-muted/40">
          <tr>
            {columns.map((key) => (
              <th
                key={key}
                scope="col"
                className="whitespace-nowrap border-b px-4 py-3 text-xs font-medium text-muted-foreground"
              >
                {t(`field.${key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {entries.map((entry, index) => (
            <tr key={`${entry.drCr}-${entry.accountCode}-${index}`}>
              {index === 0 && <>
                <td className={cell} rowSpan={entries.length}>{textOrDash(detail.postingDate || first?.postingDate)}</td>
                <td className={cell} rowSpan={entries.length}><CopyableEllipsisText value={transactionId} showCopyIcon maxWidth={260} /></td>
              </>}
              <td className={cell}>{entry.drCr}</td>
              <td className={cell}>{textOrDash(entry.accountDisplay)}</td>
              {index === 0 && <>
                <td className={cell} rowSpan={entries.length}>{textOrDash(detail.exceptionContext || first?.exceptionContext)}</td>
                <td className={cell} rowSpan={entries.length}>{textOrDash(first?.createdBy || detail.createdBy)}</td>
                <td className={cell} rowSpan={entries.length}>{textOrDash(first?.createdOn || detail.createdOn)}</td>
              </>}
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td className={`${cell} text-center text-muted-foreground`} colSpan={columns.length}>--</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
