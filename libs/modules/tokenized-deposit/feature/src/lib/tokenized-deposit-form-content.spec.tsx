/**
 * useTokenizedDepositForm hook 集成测试（add 路径核心业务逻辑）。
 *
 * 对照 add-page-logic.md 验收：
 *   - P0-1-switch：1→5→20→5 连续切换后 accountTypeList/reserveAccountId/recon 无跨类型残留。
 *   - G2：handleReset 后钱包字段为空。
 *   - DRAFT-GAP-1：scoped draft key 按 userId 隔离（不同 user 互不串读）。
 *   - 草稿 mount 检测：sessionStorage 有草稿时 draftBanner 非空。
 *
 * renderHook + 桩 data-access（query/mutation 直接返回，无需 QueryClient/provider）。
 */
import '@testing-library/jest-dom';
import { renderHook, act } from '@testing-library/react';

// ── 桩依赖（辅助函数定义在工厂内部，避免 jest.mock 提升导致的 TDZ）──
jest.mock('@myorg/modules/tokenized-deposit/data-access', () => {
  const q = (data: unknown) => ({ data, isError: false, isLoading: false });
  const m = () => ({ mutateAsync: jest.fn().mockResolvedValue({}) });
  return {
    useBlockchainOptionsQuery: () =>
      q([{ key: 'b1', value: 'ChainA', status: 1, virtualMachineCode: 'evm' }]),
    useCurrencyOptionsQuery: () => q([{ value: 'USD' }]),
    useTokenTypeOptionsQuery: () =>
      q([{ tokenTypeId: 1, tokenTypeName: 'Stablecoin' }]),
    useReserveListQuery: () =>
      q([{ reserveAccountId: 9, reserveAccountName: 'Res-A' }]),
    useSmartContractOptionsQuery: () => q([{ key: 'sc1', value: 'Pkg-A' }]),
    useKeyServiceListQuery: () =>
      q([
        {
          keyServiceCode: 'ks1',
          keyServiceName: 'KS1',
          storageType: 'key_keystore',
        },
      ]),
    useFinanceBookByReserveQuery: () => q(undefined),
    useFinanceTemplateQuery: () => q(undefined),
    useTimezoneOptionsQuery: () => q(undefined),
    useTDOperationEditDetailQuery: () => q(undefined),
    useAdminWalletListQuery: () => q(undefined),
    useCreateTDApplyMutation: m,
    useEditTDOperationMutation: m,
    useGenerateWalletKeystoreMutation: m,
  };
});

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
jest.mock('@myorg/shared/util-i18n', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));
jest.mock('@myorg/shared/util-auth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

import { useTokenizedDepositForm } from './tokenized-deposit-form-content';

describe('useTokenizedDepositForm — add 路径', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    jest.resetModules();
  });

  it('P0-1-switch: 1→5→20→5 连续切换，accountTypeList/reserveAccountId/recon 无跨类型残留', async () => {
    const { result } = renderHook(() => useTokenizedDepositForm({ mode: 'add' }));

    // Stablecoin(1)：accountTypeList=[1]，保留 reserve 供 Stablecoin 使用
    await act(async () => {
      result.current.onTokenTypeChange(1);
    });
    let v = result.current.form.getValues();
    expect(v.accountTypeList).toEqual([1]);

    // 切 TD(5)：accountTypeList=[1]、清 reserve、关 reserve recon
    await act(async () => {
      result.current.onTokenTypeChange(5);
    });
    v = result.current.form.getValues();
    expect(v.accountTypeList).toEqual([1]);
    expect(v.reserveAccountId === undefined || v.reserveAccountId === null || v.reserveAccountId === ('' as never)).toBe(true);
    expect(Number(v.enableReserveAssetReconciliation)).toBe(0);

    // 切 MMF(20)：accountTypeList=[3]、reserve 仍清空
    await act(async () => {
      result.current.onTokenTypeChange(20);
    });
    v = result.current.form.getValues();
    expect(v.accountTypeList).toEqual([3]);
    expect(v.enableReserveAssetReconciliation === 0 || v.enableReserveAssetReconciliation === undefined).toBe(true);

    // 再切回 TD(5)：accountTypeList 必须恢复 [1]，不能残留 MMF 的 [3]
    await act(async () => {
      result.current.onTokenTypeChange(5);
    });
    v = result.current.form.getValues();
    expect(v.accountTypeList).toEqual([1]);
    expect(v.accountTypeList).not.toContain(3);
  });

  it('新建默认选择 Stablecoin，且合约查询状态与默认 mint method 一致', () => {
    const { result } = renderHook(() => useTokenizedDepositForm({ mode: 'add' }));

    expect(result.current.form.getValues('mintMethod')).toBe(1);
    expect(result.current.tokenType).toBe(1);
    expect(result.current.flag).toBe(false);
  });

  it('Continue 校验失败时定位到首个无效字段，避免用户在当前步骤中自行查找', async () => {
    document.body.innerHTML = '<input id="field-name" />';
    const input = document.getElementById('field-name') as HTMLInputElement;
    input.scrollIntoView = jest.fn();
    window.requestAnimationFrame = (callback) => {
      callback(0);
      return 0;
    };

    const { result } = renderHook(() => useTokenizedDepositForm({ mode: 'add' }));
    result.current.form.register('name', { required: true });

    await act(async () => {
      await result.current.handleNextStep();
    });

    expect(input.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
    expect(document.activeElement).toBe(input);
  });

  it('G2: handleReset 后钱包/keystore/password 字段为空', async () => {
    const { result } = renderHook(() => useTokenizedDepositForm({ mode: 'add' }));
    // 先写入一些钱包值
    await act(async () => {
      result.current.form.setValue('walletAddressContractOwner', '0xabc');
      result.current.form.setValue('keyStoreContractOwner', '{"x":1}');
      result.current.form.setValue('passWordContractOwner', 'secret');
      result.current.form.setValue('accountTypeList', [3]);
    });
    await act(async () => {
      result.current.handleReset();
    });
    const v = result.current.form.getValues();
    expect(v.walletAddressContractOwner).toBe('');
    expect(v.keyStoreContractOwner).toBe('');
    expect(v.passWordContractOwner).toBe('');
    // accountTypeList 回默认 [1]
    expect(v.accountTypeList).toEqual([1]);
    expect(v.mintMethod).toBe(1);
    expect(result.current.tokenType).toBe(1);
  });

  it('草稿 mount 检测：sessionStorage 有当前 user 草稿时 draftBanner 非空', async () => {
    // 写入一份 scoped 草稿（userId=u1）
    const raw = JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      formValues: { mintMethod: 5, name: 'TD-X' },
      coa: {},
    });
    // draftKey 形如 td-manage:u1:tokenized-deposit:add-draft:v1
    window.sessionStorage.setItem(
      'td-manage:u1:tokenized-deposit:add-draft:v1',
      raw,
    );

    const { result } = renderHook(() => useTokenizedDepositForm({ mode: 'add' }));
    // mount effect 在 act 后执行
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.draftBanner).not.toBeNull();
    expect(typeof result.current.draftBanner?.savedAt).toBe('number');
  });

  it('DRAFT-GAP-1 scoped 隔离：其它 userId 的草稿不被读取', async () => {
    // user=u2 的草稿不应被 u1 读到（useAuth 桩返回 u1）
    window.sessionStorage.setItem(
      'td-manage:u2:tokenized-deposit:add-draft:v1',
      JSON.stringify({ version: 1, savedAt: Date.now(), formValues: {}, coa: {} }),
    );
    const { result } = renderHook(() => useTokenizedDepositForm({ mode: 'add' }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.draftBanner).toBeNull();
  });
});
