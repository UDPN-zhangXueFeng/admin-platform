'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import type { StablecoinOption } from '@myorg/modules/td-admin/data-access';
import type {
  TokenSelectorLabels,
  TokenSelectorMode,
  TokenSelectorOption,
} from '@myorg/modules/td-admin/feature';

const TokenSelector = dynamic(
  () => import('@myorg/modules/td-admin/feature').then((module) => module.TokenSelector),
  { ssr: false },
);


export type StablecoinTabsDisplayMode = TokenSelectorMode;

interface StablecoinTabsProps {
  options: readonly StablecoinOption[];
  value: string | null;
  mode: StablecoinTabsDisplayMode;
  loading?: boolean;
  disabled?: boolean;
  onValueChange: (id: string) => void;
  onModeChange: (mode: StablecoinTabsDisplayMode) => void;
}

function getOptionId(option: StablecoinOption): string {
  return String(option.stablecoinId ?? option.code ?? option.symbol);
}

/** Backend mint-method classifications shared with Token Management. */
function getTokenType(option: StablecoinOption): TokenSelectorOption['type'] {
  const type = Number(option.issueType);
  if (type === 20) return 'M';
  if (type === 5) return 'TD';
  if (type === 10) return 'R-CBDC';
  if (type === 15) return 'W-CBDC';
  return 'S';
}

export function StablecoinTabs(props: StablecoinTabsProps) {
  const t = useTranslations('modules.dashboard');
  const options = React.useMemo<TokenSelectorOption[]>(
    () =>
      props.options.map((option) => ({
        id: getOptionId(option),
        name: option.name ?? option.symbol,
        symbol: option.symbol,
        network: option.blockchainNameAbbreviation,
        type: getTokenType(option),
        status: 'active',
      })),
    [props.options],
  );
  const labels = React.useMemo<TokenSelectorLabels>(
    () => ({
      title: t('tokenTabsLabel'),
      count: (count) => t('tokenCount', { count }),
      search: t('tokenSearch'),
      clearSearch: t('clearSearch'),
      allTokenTypes: t('allTokenTypes'),
      stablecoin: t('stablecoin'),
      tokenizedDeposit: t('tokenizedDeposit'),
      tokenizedMmf: t('tokenizedMmf'),
      retailCbdc: t('retailCbdc'),
      wholesaleCbdc: t('wholesaleCbdc'),
      allNetworks: t('allNetworks'),
      tabView: t('tabView'),
      dropdownView: t('dropdownView'),
      contexts: t('tokenContexts'),
      loading: t('tokenLoading'),
      empty: t('tokenEmpty'),
      noMatch: t('tokenNoMatch'),
      expand: (count) => t('expandTokens', { count }),
      collapse: t('collapseTokens'),
      select: t('selectToken'),
      active: t('tokenActive'),
      pending: t('tokenPending'),
      inactive: t('tokenInactive'),
    }),
    [t],
  );

  return <TokenSelector {...props} options={options} labels={labels} />;
}
