/**
 * KeySignedTransactionsDetailPage — read-only detail view.
 *
 * Reads txRecordId from query string, fetches detail via TanStack Query,
 * and renders three info cards: Signature Details, Transaction Info, Raw Message.
 *
 * Contract notes (vs upstream key-signed-transactions/detail.tsx):
 * - Upstream shows a Back button below the cards (routerBack); kept here.
 * - Status label uses `common_task_status_${n}` guarded by t.has; tone from
 *   `common.approval_task_status_color_${n}` (upstream statusColorMap):
 *   unknown/missing codes degrade to the raw number + neutral badge instead
 *   of throwing.
 * - Token Type label guarded the same way (`token_type_${n}`); the wire may
 *   send unknown numeric codes not present in messages.
 */

'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';

import { formatDate } from '@myorg/shared/util-dates';
import { Alert, Button, CopyableEllipsisText } from '@myorg/shared/ui';

import { useKeySignedTransactionDetailQuery } from '@myorg/modules/td-admin/data-access';
import { transactionTypeLabelMap, signatureTypeMap } from '.';

/** Timestamp display format, matching sibling pages. */
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

interface MessagesAccessor {
  (key: string): string;
  has(key: string): boolean;
}
/** Semantic status color word (common.json) → tailwind badge classes. */
const TONE_CLASS: Record<string, string> = {
  success: 'border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-400',
  processing: 'border-blue-600/40 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  warning: 'border-amber-600/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  error: 'border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-400',
  orange: 'border-orange-600/40 bg-orange-500/10 text-orange-700 dark:text-orange-400',
  gray: 'border-border bg-muted text-muted-foreground',
  default: 'border-border bg-muted text-muted-foreground',
};

/** Format a Unix timestamp (ms) in the shared portal column format. */
function formatTimestamp(ts?: number): string {
  if (!ts) return '--';
  return formatDate(Number(ts), DATETIME_FMT);
}

/** Token Type label — falls back to the raw number for unknown codes. */
function formatTokenType(
  t: MessagesAccessor,
  value: number | string | undefined | null,
): string {
  if (value === undefined || value === null || value === '') return '--';
  const numeric = Number(value);
  if (Number.isFinite(numeric) && t.has(`token_type_${numeric}`)) {
    return t(`token_type_${numeric}`);
  }
  return String(value);
}

/** Status label — raw number fallback for codes missing from messages. */
function formatTaskStatus(
  t: MessagesAccessor,
  raw: number | string | undefined | null,
): string {
  if (raw === undefined || raw === null || raw === '') return '--';
  const status = Number(raw);
  if (Number.isFinite(status) && t.has(`common_task_status_${status}`)) {
    return t(`common_task_status_${status}`);
  }
  return String(raw);
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
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();

  const txRecordId = React.useMemo(() => {
    const raw = searchParams.get('id');
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }, [searchParams]);

  const {
    data: detail,
    isLoading,
    isError,
    error,
    refetch,
  } = useKeySignedTransactionDetailQuery(txRecordId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-64 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-48 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <div className="flex items-center justify-between gap-4">
            <span>{error instanceof Error ? error.message : t('key_management_load_failed')}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t('key_management_retry')}
            </Button>
          </div>
        </Alert>
        <div className="flex justify-end">
          <Button onClick={() => router.back()}>Back</Button>
        </div>
      </div>
    );
  }

  if (!detail) {
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
            {detail.signatureId || '--'}
          </DetailItem>
          <DetailItem label="Status">
            {detail.status !== undefined && detail.status !== null && String(detail.status) !== '' ? (
              (() => {
                const status = Number(detail.status);
                const colorKey = `approval_task_status_color_${status}`;
                const tone =
                  Number.isFinite(status) && tCommon.has(colorKey)
                    ? tCommon(colorKey)
                    : 'default';
                return (
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASS[tone] ?? TONE_CLASS.default}`}
                  >
                    {formatTaskStatus(t, detail.status)}
                  </span>
                );
              })()
            ) : (
              '--'
            )}
          </DetailItem>
          <DetailItem label="Key Service Name">
            {detail.signatureProvider || '--'}
          </DetailItem>
          <DetailItem label="Signature Type">
            {detail.signatureType !== undefined && detail.signatureType !== null
              ? signatureTypeMap[String(detail.signatureType)] ||
                String(detail.signatureType)
              : '--'}
          </DetailItem>
          <DetailItem label="Blockchain">
            {detail.blockchainName || '--'}
          </DetailItem>
          <DetailItem label="Key ID">
            {detail.keyId || '--'}
          </DetailItem>
          <DetailItem label="Wallet Address">
            {detail.walletAddress || '--'}
          </DetailItem>
          <DetailItem label="Signature Time">
            {formatTimestamp(detail.signatureTime)}
          </DetailItem>
          <DetailItem label="Submission Time">
            {formatTimestamp(detail.submissionTime)}
          </DetailItem>
          <DetailItem label="Transaction Hash">
            {detail.transactionHash ? (
              <CopyableEllipsisText value={detail.transactionHash} />
            ) : (
              '--'
            )}
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
            {detail.transactionType
              ? transactionTypeLabelMap[detail.transactionType] ||
                detail.transactionType
              : '--'}
          </DetailItem>
          <DetailItem label="Token">
            {detail.tokenName
              ? `${detail.tokenName} (${
                  detail.tokenType !== undefined && detail.tokenType !== null
                    ? formatTokenType(t, detail.tokenType)
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
            {detail.rawMessage ? (
              <CopyableEllipsisText value={detail.rawMessage} />
            ) : (
              '--'
            )}
          </DetailItem>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => router.back()}>Back</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
