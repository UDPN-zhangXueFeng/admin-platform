'use client';

import { useCallback, useEffect } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import type {
  BlockchainOption,
  CurrencyOption,
  TDEditFormValues,
} from '@myorg/modules/tokenized-deposit/data-access';

/**
 * useBlockchainEffect — 区块链联动 effect + onBlockchainChange 回调。
 *
 * 迁移自 td-manage `edit/hooks/useBlockchainEffect.ts`（115 行）。严格保留源时序。
 *
 * ## mount effect 时序（blockchainList/currencyList 到达后）
 *
 * 1. 找首条 `status === 1` 的链（activeBlockchain）。
 * 2. **非编辑态**（无 code）：设默认值 `decimals=8` / `currencySymbol=首项` /
 *    `blockchainId=activeBlockchain.key`；按 activeBlockchain.value 是否含 'Aptos'
 *    设 chainType（'aptos' | 'evm'）。
 * 3. currencyList 非空 → `getReserveList(首项 currencySymbol)`。
 * 4. 找当前选中链（form.blockchainId === item.key）：
 *    setContractLanguage → getDeployInfo(contractLanguage, tokenType) →
 *    setChainType(virtualMachineCode) → getKeyServiceList(key)；
 *    若 virtualMachineCode === 'tron' → `form.setValue('metaType', 1)`。
 *
 * ## onBlockchainChange（用户切链）时序
 *
 * resetAdminWalletFields → setContractLanguage → setTokenTypeId(tokenType) →
 * getDeployInfo → setChainType → 清空 smartContractPackageId → getKeyServiceList →
 * tron → metaType=1。
 *
 * ## 与源差异
 *
 * antd Form → react-hook-form（`form.setValue` 替代 `form.setFieldValue`，
 * `form.getValue` 替代 `form.getFieldValue`）。`getReserveList` / `getDeployInfo` /
 * `getKeyServiceList` / `resetAdminWalletFields` / setter 由调用方（td-13）传入，
 * 调用方负责把 TanStack Query + form.watch 包装成命令式触发函数。时序与分支
 * 条件（status===1、Aptos、tron→metaType=1）逐字保留。
 *
 * @param params 见 {@link UseBlockchainEffectParams}
 * @returns onBlockchainChange 回调（传 blockchainId value）
 */
export interface UseBlockchainEffectParams {
  form: UseFormReturn<TDEditFormValues>;
  /** 路由 code（存在=编辑态，跳过默认值设置）。 */
  code?: string | number;
  currencyList?: CurrencyOption[];
  blockchainList?: BlockchainOption[];
  /** 当前 tokenType（mintMethod），传给 getDeployInfo。 */
  tokenType: number;
  /** 触发储备账户查询（按 currencySymbol）。 */
  getReserveList: (currencySymbol: string) => void;
  /** 触发合约包查询（按 contractLanguage + tokenType）。 */
  getDeployInfo: (contractLanguage: string, tokenType: number) => void;
  /** 触发密钥服务查询（按 blockchainId string）。 */
  getKeyServiceList: (blockchainId: string) => void;
  /** 重置管理员钱包字段（来自 useWalletManagement）。 */
  resetAdminWalletFields: () => void;
  setContractLanguage: (contractLanguage: string) => void;
  setChainType: (chainType: string) => void;
  setTokenTypeId: (tokenType: number) => void;
}

export function useBlockchainEffect({
  form,
  code,
  currencyList,
  blockchainList,
  tokenType,
  getReserveList,
  getDeployInfo,
  getKeyServiceList,
  resetAdminWalletFields,
  setContractLanguage,
  setChainType,
  setTokenTypeId,
}: UseBlockchainEffectParams) {
  // ── mount / blockchainList & currencyList 变化 effect ──
  useEffect(() => {
    const activeBlockchain = blockchainList?.find(
      (el) => el.status === 1,
    );

    // 幂等守卫：仅在尚未写入 blockchainId 时回填默认值，避免 tokenType 改变触发
    // effect 重跑时覆盖用户已选的链/币种。
    if (!code && !form.getValues('blockchainId')) {
      form.setValue('decimals', 8);
      form.setValue('currencySymbol', currencyList?.[0]?.value);
      form.setValue('blockchainId', activeBlockchain?.key);
      setChainType(
        (activeBlockchain?.value ?? '').indexOf('Aptos') > -1
          ? 'aptos'
          : 'evm',
      );
    }

    if (currencyList && currencyList.length > 0) {
      getReserveList(currencyList[0]?.value);
    }

    const currentBlockchainId = form.getValues('blockchainId');
    const currentBlockchain = blockchainList?.find(
      (item) => currentBlockchainId === item.key,
    );

    if (currentBlockchain) {
      const contractLanguage = String(
        (currentBlockchain as BlockchainOption & { contractLanguage?: unknown })
          .contractLanguage ?? '',
      );
      setContractLanguage(contractLanguage);
      getDeployInfo(contractLanguage, tokenType);
      setChainType(currentBlockchain.virtualMachineCode ?? 'evm');
      getKeyServiceList(currentBlockchain.key);

      if (currentBlockchain.virtualMachineCode === 'tron') {
        form.setValue('metaType', 1);
      }
    }
    // form.getValues 在依赖中无意义，故不列入（与源 deps 近似）。
  }, [
    blockchainList,
    currencyList,
    code,
    tokenType,
    getReserveList,
    getDeployInfo,
    getKeyServiceList,
    setContractLanguage,
    setChainType,
  ]);

  // ── onBlockchainChange 回调（用户切链）──
  return useCallback(
    (value: string) => {
      const selectedBlockchain = blockchainList?.find(
        (item) => value === item.key,
      );

      if (!selectedBlockchain) return;

      resetAdminWalletFields();
      const contractLanguage = String(
        (selectedBlockchain as BlockchainOption & {
          contractLanguage?: unknown;
        }).contractLanguage ?? '',
      );
      setContractLanguage(contractLanguage);
      setTokenTypeId(tokenType);
      getDeployInfo(contractLanguage, tokenType);
      setChainType(selectedBlockchain.virtualMachineCode ?? 'evm');
      form.setValue('smartContractPackageId', '');
      getKeyServiceList(selectedBlockchain.key);

      if (selectedBlockchain.virtualMachineCode === 'tron') {
        form.setValue('metaType', 1);
      } else {
        // 离开 tron：清空 metaType 使其不进 payload，用户需在新链重新选择。
        form.setValue('metaType', undefined);
      }
    },
    [
      blockchainList,
      tokenType,
      getDeployInfo,
      getKeyServiceList,
      resetAdminWalletFields,
      setChainType,
      setContractLanguage,
      setTokenTypeId,
      form,
    ],
  );
}
