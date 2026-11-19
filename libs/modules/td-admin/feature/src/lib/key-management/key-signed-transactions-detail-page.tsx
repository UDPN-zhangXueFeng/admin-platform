/**
 * KeySignedTransactionsDetailPage — read-only detail view.
 *
 * Reads txRecordId from query string, fetches detail via TanStack Query,
 * and renders three info cards: Signature Details, Transaction Info, Raw Message.
 *
 * Contract notes (vs upstream key-signed-transactions/detail.tsx):
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

import {
  Alert,
  Button,
  CopyableEllipsisText,
  DetailField,
  DetailGrid,
  DetailSection,
  PageHeader,
} from '@myorg/shared/ui';

import { useKeySignedTransactionDetailQuery } from '@myorg/modules/td-admin/data-access';
import { formatAdminTimestamp } from '../format-admin-time';
import { transactionTypeLabelMap, signatureTypeMap } from '.';


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

  const hasStatus =
    detail?.status !== undefined &&
    detail?.status !== null &&
    String(detail.status) !== '';
  const statusNumber = hasStatus ? Number(detail?.status) : NaN;
  const statusTone =
    hasStatus &&
    Number.isFinite(statusNumber) &&
    tCommon.has(`approval_task_status_color_${statusNumber}`)
      ? tCommon(`approval_task_status_color_${statusNumber}`)
      : 'default';
  const statusLabel = formatTaskStatus(t, detail?.status);

  const header = (
    <PageHeader
      backLabel={t('key_management_0056')}
      onBack={() => router.back()}
      title={t('key_management_0104')}
      actions={
        hasStatus ? (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
              TONE_CLASS[statusTone] ?? TONE_CLASS.default
            }`}
          >
            {statusLabel}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">--</span>
        )
      }
    />
  );

  if (isError) {
    return (
      <div className="space-y-4">
        {header}
        <Alert variant="destructive">
          <div className="flex items-center justify-between gap-4">
            <span>{error instanceof Error ? error.message : t('key_management_load_failed')}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t('key_management_retry')}
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (!isLoading && !detail) {
    return (
      <div className="space-y-4">
        {header}
        <div className="flex min-h-[50vh] items-center justify-center">
          <h2 className="text-2xl font-bold">{t('key_management_0060')}</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <DetailSection
        title={t('key_management_0104')}
        loading={isLoading}
      >
        <DetailGrid>
          <DetailField
            label={t('key_management_0099')}
            value={
              detail?.signatureId ? (
                <CopyableEllipsisText
                  value={detail.signatureId}
                  showCopyIcon
                  copyLabel={t('KP_Copy')}
                  maxWidth={320}
                />
              ) : undefined
            }
            span="full"
          />
          <DetailField
            label={t('key_management_0001')}
            value={detail?.signatureProvider}
          />
          <DetailField
            label={t('key_management_0101')}
            value={
              detail?.signatureType !== undefined &&
              detail?.signatureType !== null
                ? signatureTypeMap[String(detail.signatureType)] ||
                  String(detail.signatureType)
                : undefined
            }
          />
          <DetailField
            label={t('key_management_0063')}
            value={detail?.blockchainName}
          />
          <DetailField
            label={t('key_management_0074')}
            value={
              detail?.keyId ? (
                <CopyableEllipsisText
                  value={detail.keyId}
                  showCopyIcon
                  copyLabel={t('KP_Copy')}
                  maxWidth={320}
                />
              ) : undefined
            }
          />
          <DetailField
            label={t('key_management_0076')}
            value={
              detail?.walletAddress ? (
                <CopyableEllipsisText
                  value={detail.walletAddress}
                  showCopyIcon
                  copyLabel={t('KP_Copy')}
                  maxWidth={320}
                />
              ) : undefined
            }
            span="full"
          />
          <DetailField
            label={t('key_management_0102')}
            value={formatAdminTimestamp(detail?.signatureTime)}
          />
          <DetailField
            label={t('key_management_0103')}
            value={formatAdminTimestamp(detail?.submissionTime)}
          />
          <DetailField
            label={t('key_management_0078')}
            value={
              detail?.transactionHash ? (
                <CopyableEllipsisText
                  value={detail.transactionHash}
                  showCopyIcon
                  copyLabel={t('KP_Copy')}
                  maxWidth={1000}
                />
              ) : undefined
            }
            span="full"
          />
        </DetailGrid>
      </DetailSection>

      <DetailSection
        title={t('key_management_0105')}
        loading={isLoading}
      >
        <DetailGrid>
          <DetailField
            label={t('key_management_0100')}
            value={
              detail?.transactionType
                ? transactionTypeLabelMap[detail.transactionType] ||
                  detail.transactionType
                : undefined
            }
          />
          <DetailField
            label={t('key_management_0075')}
            value={
              detail?.tokenName
                ? `${detail.tokenName} (${
                    detail.tokenType !== undefined &&
                    detail.tokenType !== null
                      ? formatTokenType(t, detail.tokenType)
                      : '--'
                  })`
                : undefined
            }
          />
        </DetailGrid>
      </DetailSection>

      <DetailSection
        title={t('key_management_0106')}
        loading={isLoading}
      >
        <DetailGrid className="sm:grid-cols-1">
          <DetailField
            label={t('key_management_0153')}
            value={
              detail?.rawMessage ? (
                <CopyableEllipsisText
                  value={detail.rawMessage}
                  showCopyIcon
                  copyLabel={t('KP_Copy')}
                  maxWidth={1000}
                />
              ) : undefined
            }
          />
        </DetailGrid>
      </DetailSection>
    </div>
  );
}
