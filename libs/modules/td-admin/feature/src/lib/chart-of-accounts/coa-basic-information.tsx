'use client';

import { useTranslations } from 'next-intl';
import { CopyableEllipsisText, DetailField, DetailGrid, DetailSection } from '@myorg/shared/ui';
import { FIXED_TOKEN_TYPES, resolveBasicInfoStatus, type ChartOfAccountsBasicInfoResp } from '@myorg/modules/td-admin/data-access';
import { formatAdminTimestamp } from '../format-admin-time';
import { formatEodCutoffTime, formatLastEodPostingRun } from './book-time';
import { ChartOfAccountsStatusTag } from './coa-status-tag';

export function CoaBasicInformation({ info, bookNo, loading, error, onRetry }: {
  info?: ChartOfAccountsBasicInfoResp;
  bookNo: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations('modules.chart-of-accounts');
  const common = useTranslations('common');
  const status = resolveBasicInfoStatus(info?.status, info?.statusName);
  const tokenType = info?.tokenType;
  const tokens = info?.tokens?.map((token) => token.tokenName?.trim()).filter(Boolean).join(', ');
  return (
    <DetailSection
      title={t('detail.basicInformationTitle')}
      loading={loading}
      error={error ? { message: t('common.loadFailed'), retryLabel: t('common.retry'), onRetry } : undefined}
    >
      {info ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:p-5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{t('field.bookName')}</p>
              <p className="mt-1 break-words text-lg font-semibold">{info.bookName || '--'}</p>
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="text-xs font-medium text-muted-foreground">{t('field.bookId')}</span>
                <CopyableEllipsisText
                  value={info.bookNo || bookNo}
                  maxWidth={200}
                  className="font-medium text-foreground"
                />
              </div>
            </div>
            <ChartOfAccountsStatusTag
              tone={status}
              label={t(`status.${status}`)}
              className="self-start"
            />
          </div>
          <DetailGrid className="sm:grid-cols-2 lg:grid-cols-3">
            <DetailField label={t('field.reserveAssetName')} value={info.reserveAssetName} />
            <DetailField label={t('field.currency')} value={info.currencyCode} />
            <DetailField label={t('field.tokenType')} value={tokenType == null ? undefined :
              FIXED_TOKEN_TYPES.some((type) => type === tokenType) ? t(`tokenType.${tokenType}`) : tokenType} />
            <DetailField label={t('field.tokens')} value={<CopyableEllipsisText value={tokens} maxWidth={320} />} />
            <DetailField label={t('field.eodCutoffTime')} value={formatEodCutoffTime(info.eodCutoffTime, info.timeZone)} />
            <DetailField label={t('field.lastEodPostingRun')} value={formatLastEodPostingRun(info.lastEodPostingRun)} />
            <DetailField label={t('field.createdBy')} value={info.createdBy} />
            <DetailField label={t('field.createdOn')} value={formatAdminTimestamp(info.createdOn)} />
          </DetailGrid>
        </div>
      ) : <p className="text-sm text-muted-foreground">{common('noData')}</p>}
    </DetailSection>
  );
}
