/**
 * KeySignedTransactionsDetailPage — read-only detail view.
 *
 * Reads txRecordId from query string, fetches detail via TanStack Query,
 * and renders three info cards: Signature Details, Transaction Info, Raw Message.
 */

'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { Button } from '@myorg/shared/ui';

import { useKeySignedTransactionDetailQuery } from '@myorg/modules/key-management/data-access';
import { transactionTypeLabelMap, signatureTypeMap } from '@myorg/modules/key-management/util';

/** Format a Unix timestamp (ms) to a locale string. */
function formatTimestamp(ts?: number): string {
  if (!ts) return '--';
  return new Date(ts).toLocaleString();
}

interface DetailItemProps {
  label: string;
  children: React.ReactNode;
}

function DetailItem({ label, children }: DetailItemProps) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

export function KeySignedTransactionsDetailPage() {
  const t = useTranslations('modules.key-management');
  const router = useRouter();
  const searchParams = useSearchParams();

  const txRecordId = React.useMemo(() => {
    const raw = searchParams.get('id');
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }, [searchParams]);

  const { data: detail, isLoading } = useKeySignedTransactionDetailQuery(txRecordId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-64 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-48 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (!detail && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <h2 className="text-2xl font-bold">{t('key_management_0060')}</h2>
        <Button onClick={() => router.back()}>Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Signature Details */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="text-2xl font-semibold leading-none tracking-tight">Signature Details</h3>
        </div>
        <div className="p-6 pt-0 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="Signature ID">
            {detail?.signatureId || '--'}
          </DetailItem>
          <DetailItem label="Status">
            {typeof detail?.status !== 'undefined' ? (
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                {t(`common_task_status_${detail.status}`)}
              </span>
            ) : (
              '--'
            )}
          </DetailItem>
          <DetailItem label="Key Service Name">
            {detail?.signatureProvider || '--'}
          </DetailItem>
          <DetailItem label="Signature Type">
            {typeof detail?.signatureType !== 'undefined'
              ? signatureTypeMap[String(detail.signatureType)] ||
                String(detail.signatureType)
              : '--'}
          </DetailItem>
          <DetailItem label="Blockchain">
            {detail?.blockchainName || '--'}
          </DetailItem>
          <DetailItem label="Key ID">
            {detail?.keyId || '--'}
          </DetailItem>
          <DetailItem label="Wallet Address">
            {detail?.walletAddress || '--'}
          </DetailItem>
          <DetailItem label="Signature Time">
            {formatTimestamp(detail?.signatureTime)}
          </DetailItem>
          <DetailItem label="Submission Time">
            {formatTimestamp(detail?.submissionTime)}
          </DetailItem>
          <DetailItem label="Transaction Hash">
            {detail?.transactionHash || '--'}
          </DetailItem>
        </div>
      </div>

      {/* Transaction Info */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="text-2xl font-semibold leading-none tracking-tight">Transaction Info</h3>
        </div>
        <div className="p-6 pt-0 grid grid-cols-1 gap-6 md:grid-cols-2">
          <DetailItem label="Transaction Type">
            {detail?.transactionType
              ? transactionTypeLabelMap[detail.transactionType] ||
                detail.transactionType
              : '--'}
          </DetailItem>
          <DetailItem label="Token">
            {detail?.tokenName
              ? `${detail.tokenName} (${
                  typeof detail.tokenType !== 'undefined'
                    ? t(`token_type_${Number(detail.tokenType)}`)
                    : '--'
                })`
              : '--'}
          </DetailItem>
        </div>
      </div>

      {/* Raw Message */}
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="text-2xl font-semibold leading-none tracking-tight">Raw Message</h3>
        </div>
        <div className="p-6 pt-0">
          <DetailItem label="Raw Message / Unsigned Data">
            {detail?.rawMessage ? (
              <div className="break-all max-w-[60rem] text-sm font-mono bg-muted p-4 rounded-md">
                {detail.rawMessage}
              </div>
            ) : (
              '--'
            )}
          </DetailItem>
          <div className="flex justify-end pt-4 mt-4">
            <Button onClick={() => router.back()}>Back</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
