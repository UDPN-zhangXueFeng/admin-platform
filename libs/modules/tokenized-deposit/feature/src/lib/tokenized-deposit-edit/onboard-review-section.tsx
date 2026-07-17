'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Badge, Separator } from '@myorg/shared/ui';
import type { TDEditFormValues } from '@myorg/modules/tokenized-deposit/data-access';
import { RECON_ENABLED } from '@myorg/modules/tokenized-deposit/util';

interface ReviewRowProps {
  label: string;
  value?: React.ReactNode;
}

function ReviewRow({ label, value }: ReviewRowProps): React.JSX.Element {
  return (
    <div className="grid gap-1 border-b py-3 last:border-0 sm:grid-cols-[180px_1fr]">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="break-all text-sm sm:text-right">{value || '—'}</span>
    </div>
  );
}

interface ReviewGroupProps {
  title: string;
  children: React.ReactNode;
}

function ReviewGroup({ title, children }: ReviewGroupProps): React.JSX.Element {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="rounded-md border px-4">{children}</div>
    </section>
  );
}

export interface OnboardReviewSectionProps {
  values: TDEditFormValues;
  tokenTypeLabel: string;
  blockchainLabel: string;
  contractLabel: string;
  reserveLabel: string;
  keyServiceLabel: string;
  financialBookName?: string;
}

export function OnboardReviewSection({
  values,
  tokenTypeLabel,
  blockchainLabel,
  contractLabel,
  reserveLabel,
  keyServiceLabel,
  financialBookName,
}: OnboardReviewSectionProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  return (
    <div className="flex flex-col gap-7">
      <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm font-medium">{t('td_review_ready_title')}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {t('td_review_ready_desc')}
        </p>
      </div>

      <ReviewGroup title={t('td_review_token_details')}>
        <ReviewRow label={t('tokenized_deposit_0062')} value={tokenTypeLabel} />
        <ReviewRow
          label={t('td_review_name_symbol')}
          value={
            values.name || values.symbol
              ? `${values.name ?? ''} (${values.symbol ?? ''})`
              : undefined
          }
        />
        <ReviewRow
          label={t('stablecoin_settings_040')}
          value={
            values.usPrice
              ? `1 ${values.symbol ?? ''} = ${values.usPrice} ${values.currencySymbol ?? ''}`
              : undefined
          }
        />
        {Number(values.mintMethod) === 1 ? (
          <ReviewRow label={t('tokenized_deposit_0174')} value={reserveLabel} />
        ) : null}
        <ReviewRow
          label={t('tokenized_deposit_0007')}
          value={blockchainLabel}
        />
        <ReviewRow label={t('tokenized_deposit_0016')} value={contractLabel} />
        <ReviewRow
          label={t('tokenized_deposit_0090')}
          value={values.metaType === 5 ? t('PUB_Yes') : t('PUB_No')}
        />
      </ReviewGroup>

      <ReviewGroup title={t('td_review_accounting_controls')}>
        <ReviewRow
          label={t('tokenized_deposit_coa_financial_book_name')}
          value={
            Number(values.mintMethod) === 20
              ? t('td_review_not_required')
              : financialBookName
          }
        />
        <ReviewRow
          label={t('tokenized_deposit_recon_token_label')}
          value={
            Number(values.enableTokenReconciliation) === RECON_ENABLED
              ? t('td_review_enabled')
              : t('td_review_disabled')
          }
        />
        {Number(values.mintMethod) === 1 ? (
          <ReviewRow
            label={t('tokenized_deposit_recon_reserve_label')}
            value={
              Number(values.enableReserveAssetReconciliation) === RECON_ENABLED
                ? t('td_review_enabled')
                : t('td_review_disabled')
            }
          />
        ) : null}
      </ReviewGroup>

      <ReviewGroup title={t('td_review_custody_wallets')}>
        <ReviewRow
          label={t('key_custody_label')}
          value={
            keyServiceLabel ? (
              <Badge variant="secondary">{keyServiceLabel}</Badge>
            ) : undefined
          }
        />
        <ReviewRow
          label={t('tokenized_deposit_0112')}
          value={
            <span className="font-mono text-xs">
              {values.walletAddressContractOwner}
            </span>
          }
        />
        <ReviewRow
          label={t('tokenized_deposit_0113')}
          value={
            <span className="font-mono text-xs">
              {values.walletAddressPaymentOfGasFee}
            </span>
          }
        />
        <ReviewRow
          label={t('tokenized_deposit_0114')}
          value={
            <span className="font-mono text-xs">
              {values.walletAddressManagementWallet}
            </span>
          }
        />
      </ReviewGroup>

      <Separator />
      <p className="text-xs leading-5 text-muted-foreground">
        {t('td_review_payload_note')}
      </p>
    </div>
  );
}
