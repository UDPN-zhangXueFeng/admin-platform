'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@myorg/shared/util-i18n';
import { useTranslations } from 'next-intl';
import { Button, Card, PageHeader } from '@myorg/shared/ui';
import { toast } from 'sonner';

import { useJournalDetailQuery } from '@myorg/modules/td-admin/data-access';
import { resolveTxTypeMessageKey } from './journal-entries-new.constants';
import { formatBlockHeight } from './journal-entries-new-format';
import { JournalPostingEntry } from './journal-posting-entry';
import { JournalTAccounts } from './journal-t-accounts';
import { formatAdminTimestamp } from '../format-admin-time';

const EMPTY_DISPLAY = '--';

interface BasicKvRow {
  key: string;
  label: string;
  value: string;
}

/** Keep the positive decimal identifier intact rather than rounding it through Number. */
function parseTdTxId(value: string | null) {
  const id = value?.trim().replace(/^0+/u, '');
  return id && /^[1-9]\d*$/u.test(id) ? id : undefined;
}

/** 1:1 迁移自源项目 `toTextValue`：空值 → '--'，其余转字符串。 */
function toTextValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return EMPTY_DISPLAY;
  if (typeof value === 'string') return value;
  return String(value);
}

/** 1:1 迁移自源项目 `formatJsonText`：对象/JSON 字符串美化，异常回退原值。 */
function formatJsonText(value: unknown): string {
  if (value === null || value === undefined || value === '') return EMPTY_DISPLAY;
  try {
    const parsedValue = typeof value === 'string' ? JSON.parse(value) : value;
    return JSON.stringify(parsedValue, null, 2);
  } catch {
    return String(value);
  }
}

export function JournalEntriesNewDetailPage() {
  const t = useTranslations('modules.journal-entries-new');
  const router = useRouter();
  const searchParams = useSearchParams();

  const tdTxId = parseTdTxId(searchParams.get('tdTxId'));
  const { data: detailData, error, isError, isLoading } = useJournalDetailQuery(tdTxId);

  const rawDataRows = React.useMemo<BasicKvRow[]>(() => {
    const rawData = detailData?.rawData;
    if (!rawData) return [];

    const txTypeKey = resolveTxTypeMessageKey(rawData.txType);

    return [
      { key: 'tdTxId', label: 'tdTxId', value: toTextValue(rawData.tdTxId) },
      { key: 'fromAddress', label: t('field.from'), value: toTextValue(rawData.fromAddress) },
      { key: 'toAddress', label: t('field.to'), value: toTextValue(rawData.toAddress) },
      { key: 'txHash', label: t('field.transactionHash'), value: toTextValue(rawData.txHash) },
      { key: 'tdCount', label: t('field.transactionAmount'), value: toTextValue(rawData.tdCount) },
      { key: 'txType', label: t('field.transactionType'), value: txTypeKey ? t(txTypeKey) : EMPTY_DISPLAY },
      { key: 'txTime', label: t('field.transactionTime'), value: formatAdminTimestamp(rawData.txTime) },
      { key: 'blockHeight', label: t('detail.blockHeight'), value: formatBlockHeight(rawData.blockHeight) },
      { key: 'blockHash', label: t('detail.blockHash'), value: toTextValue(rawData.blockHash) },
      { key: 'contractAddress', label: t('field.contractAddress'), value: toTextValue(rawData.contractAddress) },
      { key: 'blockDate', label: t('detail.blockTime'), value: formatAdminTimestamp(rawData.blockDate) },
    ];
  }, [detailData?.rawData, t]);

  const normalizedJsonString = React.useMemo(() => {
    const normalizedJson = detailData?.normalizedJson;
    if (!normalizedJson) return EMPTY_DISPLAY;
    return JSON.stringify(normalizedJson, null, 2);
  }, [detailData?.normalizedJson]);

  const blockDataString = React.useMemo(
    () => formatJsonText(detailData?.rawData?.blockData),
    [detailData?.rawData?.blockData]
  );

  const iso20022PayloadString = React.useMemo(
    () => formatJsonText(detailData?.iso20022Payload),
    [detailData?.iso20022Payload]
  );

  const handleCopyIso20022Payload = React.useCallback(async () => {
    if (iso20022PayloadString === EMPTY_DISPLAY) return;
    try {
      await navigator.clipboard.writeText(iso20022PayloadString);
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  }, [iso20022PayloadString, t]);

  const onBack = () => router.back();
  const header = <PageHeader backLabel={t('action.back')} onBack={onBack} title={t('title')} />;

  if (!tdTxId) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="p-6"><p className="text-sm text-muted-foreground">{t('detail.invalidId')}</p></Card>
      </div>
    );
  }
  if (isLoading || isError) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="p-6">
          {isError
            ? <p role="alert" className="text-sm text-destructive">{error.message}</p>
            : <p role="status" className="text-sm text-muted-foreground">{t('detail.loading')}</p>}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      {/* Raw Data */}
      <Card>
        <div className="border-b px-6 py-4 text-base font-semibold">
          {t('detail.rawData')}
        </div>
        <div className="p-4 md:p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="min-w-0 rounded-md border bg-muted/30 p-4">
              <div className="max-h-[420px] overflow-auto">
                <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[13px] leading-6 text-muted-foreground">
                  {blockDataString}
                </pre>
              </div>
            </div>
            <div className="min-w-0 overflow-x-auto rounded-md border">
              <table className="w-full table-fixed border-collapse text-sm">
                <tbody>
                  {rawDataRows.length ? (
                    rawDataRows.map((row) => (
                      <tr key={row.key}>
                        <td className="w-[34%] border bg-muted/30 px-4 py-3 font-medium">
                          {row.label}
                        </td>
                        <td className="break-all border px-4 py-3">{row.value}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="border px-4 py-8 text-center text-muted-foreground">
                        {t('empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>

      {/* Normalization Engine */}
      <Card>
        <div className="border-b px-6 py-4 text-base font-semibold">
          {t('detail.normalizationEngine')}
        </div>
        <div className="p-6">
          <div className="max-h-[360px] overflow-auto rounded-md bg-muted/30 p-6 text-[13px] leading-6 text-muted-foreground">
            <pre className="m-0 whitespace-pre-wrap break-all font-mono">
              {normalizedJsonString}
            </pre>
          </div>
        </div>
      </Card>

      <JournalPostingEntry detail={detailData} />
      <JournalTAccounts detail={detailData} />

      {/* ISO 20022 Payload */}
      <Card>
        <div className="flex items-center justify-between gap-4 border-b px-6 py-4">
          <div className="text-base font-semibold">
            {t('detail.iso20022Payload')}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopyIso20022Payload}
            disabled={iso20022PayloadString === EMPTY_DISPLAY}
          >
            {t('copy')}
          </Button>
        </div>
        <div className="p-6">
          <div className="max-h-[360px] overflow-auto rounded-md bg-muted/30 p-6 text-[13px] leading-6 text-muted-foreground">
            <pre className="m-0 whitespace-pre-wrap break-all font-mono">
              {iso20022PayloadString}
            </pre>
          </div>
        </div>
      </Card>
    </div>
  );
}
