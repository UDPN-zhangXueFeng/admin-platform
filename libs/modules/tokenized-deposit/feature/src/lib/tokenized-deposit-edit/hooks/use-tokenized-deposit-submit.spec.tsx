import '@testing-library/jest-dom';
import { act, renderHook } from '@testing-library/react';

const mockCreateMutateAsync = jest.fn().mockResolvedValue({});
const mockEditMutateAsync = jest.fn().mockResolvedValue({});

jest.mock('@myorg/modules/tokenized-deposit/data-access', () => ({
  useCreateTDApplyMutation: () => ({ mutateAsync: mockCreateMutateAsync }),
  useEditTDOperationMutation: () => ({ mutateAsync: mockEditMutateAsync }),
}));
jest.mock('@myorg/modules/tokenized-deposit/util', () => ({
  MINT_METHOD: { STABLECOIN: 1, TOKENIZED_DEPOSIT: 5, MMF: 20 },
  RECON_DISABLED: 0,
  RECON_ENABLED: 1,
  getEncryptionData: (value: string) => `encrypted:${value}`,
  hasCoaSetupErrors: () => false,
  mapCoaSetupToPayload: () => ({}),
  validateCoaSetup: () => ({}),
}));
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
jest.mock('sonner', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

import { useTokenizedDepositSubmit } from './use-tokenized-deposit-submit';

describe('useTokenizedDepositSubmit', () => {
  beforeEach(() => {
    mockCreateMutateAsync.mockClear();
    mockEditMutateAsync.mockClear();
  });

  it('submits Stablecoin threshold values so issuer monitoring settings are persisted', async () => {
    let confirmedAction: (() => Promise<void> | void) | undefined;
    const { result } = renderHook(() =>
      useTokenizedDepositSubmit({
        confirmSubmit: (callback) => {
          confirmedAction = callback;
        },
        routerBack: jest.fn(),
        detailInfo: {},
        keyServiceList: [
          { keyServiceCode: 'ks-1', storageType: 'key_keystore' },
        ],
        reserveAccountId: 9,
        tokenizedDepositCoaData: {} as never,
        stablecoinCoaData: {} as never,
        stablecoinCoaReadonly: true,
        setTokenizedDepositCoaErrors: jest.fn(),
        setStablecoinCoaErrors: jest.fn(),
      }),
    );

    act(() => {
      result.current.onSubmit({
        blockchainId: '1',
        currencySymbol: 'USD',
        name: 'USD Coin',
        symbol: 'USDC',
        usPrice: '1',
        mintMethod: 1,
        smartContractPackageId: '2',
        decimals: 2,
        thresholdType: 'txnCount',
        thresholdFrequency: 'monthly',
        thresholdValue: '12.50',
        keyServiceName: 'ks-1',
      });
    });

    await act(async () => {
      await confirmedAction?.();
    });

    expect(mockCreateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        thresholdType: 'txnCount',
        thresholdFrequency: 'monthly',
        thresholdValue: 12.5,
      }),
    );
  });
});
