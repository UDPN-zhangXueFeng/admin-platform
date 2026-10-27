import '@testing-library/jest-dom';
import { act, renderHook } from '@testing-library/react';
import type { TDEditFormValues } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.model';
import {
  useTokenizedDepositSubmit,
  type UseTokenizedDepositSubmitParams,
} from './use-tokenized-deposit-submit';

const mockCreateMutateAsync = jest.fn().mockResolvedValue({});
const mockEditMutateAsync = jest.fn().mockResolvedValue({});

jest.mock('@myorg/modules/td-admin/data-access/lib/tokenized-deposit/+queries/tokenized-deposit.mutations', () => ({
  useCreateTDApplyMutation: () => ({ mutateAsync: mockCreateMutateAsync }),
  useEditTDOperationMutation: () => ({ mutateAsync: mockEditMutateAsync }),
}));
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const baseValues: TDEditFormValues = {
  blockchainId: '1',
  currencySymbol: 'USD',
  name: 'Example token',
  symbol: 'EX',
  usPrice: '1',
  mintMethod: 1,
  smartContractPackageId: '2',
  decimals: 2,
  keyServiceName: 'ks-1',
  walletAddressContractOwner: 'owner-wallet',
  walletAddressPaymentOfGasFee: 'gas-wallet',
  walletAddressManagementWallet: 'management-wallet',
};

function renderSubmit(overrides: Partial<UseTokenizedDepositSubmitParams> = {}) {
  let confirm: (() => Promise<void> | void) | undefined;
  const hook = renderHook(() => useTokenizedDepositSubmit({
    confirmSubmit: (callback) => { confirm = callback; },
    routerBack: jest.fn(),
    detailInfo: {},
    keyServiceList: [{ keyServiceCode: 'ks-1', storageType: 'key_keystore' }],
    tokenizedDepositCoaData: { status: 'setup_required' },
    stablecoinCoaData: { status: 'configured' },
    stablecoinCoaReadonly: true,
    setTokenizedDepositCoaErrors: jest.fn(),
    setStablecoinCoaErrors: jest.fn(),
    ...overrides,
  }));
  return {
    ...hook,
    async submit(values: TDEditFormValues) {
      act(() => hook.result.current.onSubmit(values));
      const onConfirm = confirm;
      if (!onConfirm) throw new Error('Submission must require confirmation');
      await act(async () => { await onConfirm(); });
    },
  };
}

describe('useTokenizedDepositSubmit', () => {
  beforeEach(() => {
    mockCreateMutateAsync.mockClear();
    mockEditMutateAsync.mockClear();
  });

  it.each([10, 15])('preserves reserve and reconciliation controls for CBDC classification %i', async (mintMethod) => {
    const { submit } = renderSubmit({ reserveAccountId: '9' });
    await submit({
      ...baseValues,
      mintMethod,
      accountTypeList: [1],
      enableReserveAssetReconciliation: 1,
      enableTokenReconciliation: 0,
    });
    expect(mockCreateMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      mintMethod,
      accountTypeList: [1],
      reserveAccountId: 9,
      enableReserveAssetReconciliation: 1,
      enableTokenReconciliation: 0,
    }));
    expect(mockEditMutateAsync).not.toHaveBeenCalled();
  });

  it('retains an existing external custodian when it is no longer listed, without switching to keystore credentials', async () => {
    const { submit } = renderSubmit({
      code: 'TD-1',
      detailInfo: { keyServiceCode: 'ks-old', storageType: 'key_aws_kms' },
      keyServiceList: [],
    });
    await submit({ ...baseValues, keyServiceName: '' });
    expect(mockEditMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      code: 'TD-1',
      storageType: 'key_aws_kms',
      keyServiceCode: 'ks-old',
      roleWalletDTOList: [
        { accountType: 1, walletAddress: 'owner-wallet' },
        { accountType: 2, walletAddress: 'gas-wallet' },
        { accountType: 3, walletAddress: 'management-wallet' },
      ],
    }));
    expect(mockEditMutateAsync.mock.calls[0][0]).not.toHaveProperty('adminWalletDTOList');
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
  });
});
