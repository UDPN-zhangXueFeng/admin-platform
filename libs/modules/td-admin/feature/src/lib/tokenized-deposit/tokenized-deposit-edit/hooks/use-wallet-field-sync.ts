'use client';

import { useCallback } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import type { TDEditFormValues } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.model';

/**
 * useWalletFieldSync — 管理员钱包 3 角色字段的回填/重置
 * （setWalletFields / setWalletAddressFields / resetAdminWalletFields）。
 * 源: use-wallet-management.tsx 195-264、283-303（纯代码搬移，逻辑不变）。
 */
export function useWalletFieldSync(form: UseFormReturn<TDEditFormValues>) {
  // ── setWalletFields：回填 3 角色钱包（含可选 keyStore）──
  const setWalletFields = useCallback(
    (
      walletList: Array<{
        accountType?: number;
        walletAddress?: string;
        keyStore?: string;
      }> = [],
      includeKeyStore = true,
    ) => {
      if (!walletList.length) return;
      const walletMap = walletList.reduce<
        Record<number, (typeof walletList)[number]>
      >((acc, current) => {
        if (current?.accountType) {
          acc[current.accountType] = current;
        }
        return acc;
      }, {});

      form.setValue('walletAddressContractOwner', walletMap[1]?.walletAddress);
      form.setValue(
        'walletAddressPaymentOfGasFee',
        walletMap[2]?.walletAddress,
      );
      form.setValue(
        'walletAddressManagementWallet',
        walletMap[3]?.walletAddress,
      );

      if (includeKeyStore) {
        form.setValue('keyStoreContractOwner', walletMap[1]?.keyStore);
        form.setValue('keyStorePaymentOfGasFee', walletMap[2]?.keyStore);
        form.setValue('keyStoreManagementWallet', walletMap[3]?.keyStore);
      } else {
        form.setValue('keyStoreContractOwner', undefined);
        form.setValue('keyStorePaymentOfGasFee', undefined);
        form.setValue('keyStoreManagementWallet', undefined);
      }
    },
    [form],
  );

  // ── setWalletAddressFields：仅地址（admin wallet 自动拉取回填）──
  const setWalletAddressFields = useCallback(
    (
      walletList: Array<{ accountType?: number; walletAddress?: string }> = [],
    ) => {
      if (!walletList.length) return;
      const walletMap = walletList.reduce<
        Record<number, (typeof walletList)[number]>
      >((acc, current) => {
        if (current?.accountType) {
          acc[current.accountType] = current;
        }
        return acc;
      }, {});

      form.setValue('walletAddressContractOwner', walletMap[1]?.walletAddress);
      form.setValue(
        'walletAddressPaymentOfGasFee',
        walletMap[2]?.walletAddress,
      );
      form.setValue(
        'walletAddressManagementWallet',
        walletMap[3]?.walletAddress,
      );
    },
    [form],
  );

  // ── resetAdminWalletFields：清空 9 字段 ──
  const resetAdminWalletFields = useCallback(() => {
    form.setValue('walletAddressContractOwner', undefined);
    form.setValue('walletAddressPaymentOfGasFee', undefined);
    form.setValue('walletAddressManagementWallet', undefined);
    form.setValue('keyStoreContractOwner', undefined);
    form.setValue('keyStorePaymentOfGasFee', undefined);
    form.setValue('keyStoreManagementWallet', undefined);
    (form.setValue as (name: string, value: unknown) => void)(
      'passWordContractOwner',
      undefined,
    );
    (form.setValue as (name: string, value: unknown) => void)(
      'passWordPaymentOfGasFee',
      undefined,
    );
    (form.setValue as (name: string, value: unknown) => void)(
      'passWordManagementWallet',
      undefined,
    );
  }, [form]);

  return {
    setWalletFields,
    setWalletAddressFields,
    resetAdminWalletFields,
  };
}
