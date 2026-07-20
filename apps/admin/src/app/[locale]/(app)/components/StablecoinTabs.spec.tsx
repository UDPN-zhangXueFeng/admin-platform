import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, number>) => {
    const messages: Record<string, string> = {
      tokenTabsLabel: 'Stablecoin',
      tokenSearch: 'Search tokens...',
      clearSearch: 'Clear token search',
      allNetworks: 'All',
      tabView: 'Tab view',
      dropdownView: 'Dropdown view',
      tokenContexts: 'Token contexts',
      tokenLoading: 'Loading token contexts',
      tokenEmpty: 'No tokens available',
      tokenNoMatch: 'No matching tokens found',
      collapseTokens: 'Show less',
      selectToken: 'Select token context',
      tokenActive: 'Active',
    };

    if (key === 'tokenCount') return `${values?.count ?? 0} tokens`;
    if (key === 'expandTokens') return `Show all (${values?.count ?? 0} more)`;
    return messages[key] ?? key;
  },
}));

jest.mock('@myorg/shared/ui', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

import { StablecoinTabs } from './StablecoinTabs';
import type { StablecoinOption } from '@myorg/modules/dashboard/data-access';

/**
 * Mock 对齐 `enabled/searches` 真实返回（TdStablecoinRespVo）：
 * 类型字段为数值 issueType —— 1=Stablecoin，5=Tokenized Deposit，20=Tokenized MMF。
 */
const options: StablecoinOption[] = [
  {
    stablecoinId: 101,
    code: 'USDC-BESU',
    symbol: 'USDC',
    name: 'USDCoin',
    blockchainNameAbbreviation: 'Besu',
    issueType: 1,
  },
  {
    stablecoinId: 202,
    code: 'SAR-BESU',
    symbol: 'SAR',
    name: 'SARCoin',
    blockchainNameAbbreviation: 'Besu',
    issueType: 5,
  },
  {
    stablecoinId: 303,
    code: 'MMF-CFLR',
    symbol: 'MMF',
    name: 'mmf-test-1',
    blockchainNameAbbreviation: 'CFLR',
    issueType: 20,
  },
];

describe('StablecoinTabs', () => {
  it('marks S / TD / M by numeric issueType like the Token Management page', () => {
    render(
      <StablecoinTabs
        mode="tabs"
        onModeChange={jest.fn()}
        onValueChange={jest.fn()}
        options={options}
        value="101"
      />,
    );

    expect(
      within(screen.getByRole('tab', { name: /USDCoin/i })).getByText('S'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('tab', { name: /SARCoin/i })).getByText('TD'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('tab', { name: /mmf-test-1/i })).getByText('M'),
    ).toBeInTheDocument();
  });

  it('returns the stable token id because API ordering can change', async () => {
    const user = userEvent.setup();
    const handleValueChange = jest.fn();

    render(
      <StablecoinTabs
        mode="tabs"
        onModeChange={jest.fn()}
        onValueChange={handleValueChange}
        options={options}
        value="101"
      />,
    );

    await user.click(screen.getByRole('tab', { name: /SARCoin/i }));

    expect(handleValueChange).toHaveBeenCalledWith('202');
  });

  it('switches display mode without changing the selected token', async () => {
    const user = userEvent.setup();
    const handleModeChange = jest.fn();
    const handleValueChange = jest.fn();

    render(
      <StablecoinTabs
        mode="dropdown"
        onModeChange={handleModeChange}
        onValueChange={handleValueChange}
        options={options}
        value="101"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Tab view' }));

    expect(handleModeChange).toHaveBeenCalledWith('tabs');
    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it('filters real options by network before selection', async () => {
    const user = userEvent.setup();
    const handleValueChange = jest.fn();

    render(
      <StablecoinTabs
        mode="tabs"
        onModeChange={jest.fn()}
        onValueChange={handleValueChange}
        options={options}
        value="101"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'CFLR' }));

    expect(
      screen.queryByRole('tab', { name: /USDCoin/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /mmf-test-1/i }));
    expect(handleValueChange).toHaveBeenCalledWith('303');
  });

  it('shows loading before empty feedback', () => {
    render(
      <StablecoinTabs
        loading
        mode="tabs"
        onModeChange={jest.fn()}
        onValueChange={jest.fn()}
        options={[]}
        value={null}
      />,
    );

    expect(screen.getByLabelText('Loading token contexts')).toBeInTheDocument();
    expect(screen.queryByText('No tokens available')).not.toBeInTheDocument();
  });

  it('shows empty feedback when the API returns no token contexts', () => {
    render(
      <StablecoinTabs
        mode="tabs"
        onModeChange={jest.fn()}
        onValueChange={jest.fn()}
        options={[]}
        value={null}
      />,
    );

    expect(screen.getByText('No tokens available')).toBeInTheDocument();
  });
});
