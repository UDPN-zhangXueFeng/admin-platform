import { useTranslations } from 'next-intl';
import { type TokenReconBasicDetailRespVo } from '@myorg/modules/td-admin/data-access';
import { CopyableEllipsisText, Skeleton } from '@myorg/shared/ui';
import { EMPTY_FIELD_VALUE } from '../reconciliation.constants';
import { ReconciliationMetricCard } from '../reconciliation-metric-card';
import { ReconciliationSection } from '../reconciliation-section';
import { InfoItem } from '../info-item';
import { formatReconTime } from './format';
import { useRealTimeTokenTypes } from './token-options';

export function RealTimeBasicInfo({ info, loading, error }: {
  info?: TokenReconBasicDetailRespVo;
  loading: boolean;
  error: boolean;
}) {
  const t = useTranslations('modules.reconciliation');
  const types = useRealTimeTokenTypes();
  const typeName = types.find(({ tokenTypeId }) => Number(tokenTypeId) === Number(info?.tokenType))?.tokenTypeName;
  const time = formatReconTime(info?.lastReconciliationTime);
  if (loading) return <Skeleton className="h-48" />;
  if (error) return <p role="alert" className="text-destructive">{t('realTimeLoadError')}</p>;
  return (
    <>
      <ReconciliationSection title={t('reconciliation_0145')}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <InfoItem label={t('reconciliation_0052')}>{info?.tokenName || EMPTY_FIELD_VALUE}</InfoItem>
          <InfoItem label={t('reconciliation_0053')}>{typeName || EMPTY_FIELD_VALUE}</InfoItem>
          <InfoItem label={t('reconciliation_0047')}>{info?.financeBookName || EMPTY_FIELD_VALUE}</InfoItem>
          <InfoItem label={t('reconciliation_0048')}>
            <CopyableEllipsisText value={info?.bookNo} copyLabel={t('common_copy')} showCopyIcon />
          </InfoItem>
          <InfoItem label={t('reconciliation_0032')}>{info?.currencySymbol || EMPTY_FIELD_VALUE}</InfoItem>
          <InfoItem label={t('PUB_Blockchain')}>{info?.blockchainName || EMPTY_FIELD_VALUE}</InfoItem>
          <InfoItem label={t('reconciliation_0076')}>{time}</InfoItem>
          <InfoItem label={t('reconciliation_0140')}>{info?.createdBy || EMPTY_FIELD_VALUE}</InfoItem>
          <InfoItem label={t('reconciliation_0141')}>{formatReconTime(info?.createTime)}</InfoItem>
        </div>
      </ReconciliationSection>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {([
          ['reconciliation_0073', info?.matchedCount || EMPTY_FIELD_VALUE, 'text-success'],
          ['reconciliation_0074', info?.unmatchedCount ?? 0, 'text-destructive'],
          ['reconciliation_0075', info?.actionedCount || EMPTY_FIELD_VALUE, 'text-primary'],
        ] as const).map(([key, value, tone]) => (
          <ReconciliationMetricCard key={key} label={t(key)}
            value={<span className={tone}>{value}</span>}
            extra={<p className="text-xs text-muted-foreground">{t('reconciliation_0142', { time })}</p>} />
        ))}
      </div>
    </>
  );
}
