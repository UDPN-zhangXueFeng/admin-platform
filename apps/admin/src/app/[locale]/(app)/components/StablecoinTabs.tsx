'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  TokenSelector,
  type TokenSelectorLabels,
  type TokenSelectorMode,
  type TokenSelectorOption,
} from '@myorg/modules/tokenized-deposit/ui';
import type { StablecoinOption } from '@myorg/modules/dashboard/data-access';

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

function getTokenType(option: StablecoinOption): TokenSelectorOption['type'] {
  const type = option.tokenType ?? option.issueType;
  if (type === '2') return 'M';
  if (type === '3') return 'TD';
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
