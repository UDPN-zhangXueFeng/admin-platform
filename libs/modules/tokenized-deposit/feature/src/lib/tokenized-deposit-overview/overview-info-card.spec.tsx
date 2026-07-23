import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import type { ApplyListItem } from '@myorg/modules/tokenized-deposit/data-access';

const messages: Record<string, string> = {
  tokenized_deposit_0000: 'Token Name',
  tokenized_deposit_0001: 'Token Symbol',
  tokenized_deposit_0007: 'Blockchain',
  tokenized_deposit_0011: 'Token Price',
  tokenized_deposit_0062: 'Token Type',
  tokenized_deposit_0064: 'Total Top-ups (Minting)',
  tokenized_deposit_0065: 'Total Withdrawals (Melting)',
  tokenized_deposit_0071: 'Reserve Balance',
  tokenized_deposit_0175: 'Reserve Asset Name',
  stablecoin_settings_009: 'Decimal Precision',
  token_type_1: 'Stablecoin',
  token_type_5: 'Tokenized Deposit',
  dashboard_0002: '**** in Circulation',
  dashboard_0003: 'Repository Balance',
  dashboard_0004: 'Total Minted',
  dashboard_0005: 'Total Melted',
};

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => messages[key] ?? key,
}));

jest.mock('@myorg/shared/util-formatting', () => ({
  formatNumber: (
    value: number,
    locale: string,
    options: Intl.NumberFormatOptions,
  ) => new Intl.NumberFormat(locale, options).format(value),
}));

jest.mock('@myorg/modules/tokenized-deposit/ui', () => ({
  TokenizedDepositCopy: ({ text }: { text?: string }) => (
    <span>{text ?? '--'}</span>
  ),
}));

jest.mock('@myorg/modules/tokenized-deposit/util', () => ({
  TD_STATE_ICON_COLOR: { 0: '#d4865f', 1: '#87ca87', 2: '#fe5945' },
}));

import { OverviewInfoCard } from './overview-info-card';

describe('OverviewInfoCard', () => {
  it('保留质押稳定币的储备信息与四项统计，且零值不会被当成缺失数据', () => {
    const td: ApplyListItem = {
      id: 'tusd',
      mintMethod: 1,
      pledgeType: 1,
      name: 'USD Coin',
      symbol: 'tUSD',
      currencySymbol: 'USD',
      reserveAccount: 1,
      reserveBalance: 103352999,
      surplusCount: 0,
      circulationCount: 3344880,
      issueCount: 3397036,
      removeCount: 52156,
    };

    render(<OverviewInfoCard td={td} />);

    expect(screen.getByText('Reserve Asset Name:')).toBeInTheDocument();
    expect(screen.getByText('Reserve Balance:')).toBeInTheDocument();
    expect(screen.getByText('Repository Balance')).toBeInTheDocument();
    expect(screen.getByText('TUSD in Circulation')).toBeInTheDocument();
    expect(screen.getByText('Total Minted')).toBeInTheDocument();
    expect(screen.getByText('Total Melted')).toBeInTheDocument();
    expect(screen.getByText('0.00 tUSD')).toBeInTheDocument();
  });

  it('对非稳定币隐藏储备区，并仅展示其业务定义的三项统计', () => {
    const td: ApplyListItem = {
      id: 'td-usd',
      mintMethod: 5,
      name: 'USD Deposit',
      symbol: 'tdUSD',
      circulationCount: 100,
      issueCount: 120,
      removeCount: 20,
    };

    render(<OverviewInfoCard td={td} />);

    expect(screen.queryByText('Reserve Asset Name:')).not.toBeInTheDocument();
    expect(screen.queryByText('Repository Balance')).not.toBeInTheDocument();
    expect(screen.getByText('TDUSD in Circulation')).toBeInTheDocument();
    expect(screen.getByText('Total Top-ups (Minting)')).toBeInTheDocument();
    expect(screen.getByText('Total Withdrawals (Melting)')).toBeInTheDocument();
  });
});
