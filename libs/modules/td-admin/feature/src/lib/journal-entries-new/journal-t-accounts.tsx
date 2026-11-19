import { Card } from '@myorg/shared/ui';
import { useTranslations } from 'next-intl';
import type { JournalDetailData } from '@myorg/modules/td-admin/data-access';
import { formatTAccountAmount } from './journal-entries-new-format';

export function JournalTAccounts({ detail }: { detail?: JournalDetailData | null }) {
  const t = useTranslations('modules.journal-entries-new');
  const rows = detail?.tAccounts ?? detail?.taccounts ?? [];

  return (
    <Card>
      <div className="border-b px-6 py-4 text-base font-semibold">{t('detail.tAccount')}</div>
      <div className="p-6">
        <div className="rounded-md bg-muted/30">
          <div className="flex flex-wrap gap-x-16 gap-y-3 border-b bg-background px-4 py-3 text-sm">
            <div><span className="font-semibold">TRAN_ID:</span> {detail?.tranId || '--'}</div>
            <div><span className="font-semibold">{t('detail.bookId')}:</span> {detail?.bookNo || '--'}</div>
          </div>
          {rows.length ? (
            <div className="flex flex-wrap gap-x-20 gap-y-10 p-6">
              {rows.map((row, index) => (
                <div key={`${row.accountCode || 'account'}-${index}`} className="w-[464px] max-w-full text-sm">
                  <div className="text-center text-base font-semibold">
                    {row.accountCode || '--'}&nbsp;&nbsp;{row.accountName || '--'}
                  </div>
                  <div className="relative mt-6 min-h-[260px]">
                    <div className="absolute left-0 right-0 top-0 border-t-2 border-dashed border-primary/60" />
                    <div className="absolute left-1/2 top-[14px] h-[220px] border-l-2 border-dashed border-primary/60" />
                    <div className="grid grid-cols-2">
                      {(['debit', 'credit'] as const).map((side) => (
                        <div key={side} className="px-6 py-7 text-center">
                          <div className="font-semibold">{t(`detail.${side}`)}</div>
                          <div className="mt-8">{formatTAccountAmount(row[`${side}Amount`])}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-10 text-center text-muted-foreground">{t('empty')}</div>
          )}
        </div>
      </div>
    </Card>
  );
}
