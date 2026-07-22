'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';

import {
  useAdminWalletListQuery,
  useGenerateWalletKeystoreMutation,
  type AdminWalletListItem,
  type BlockchainOption,
  type KeyServiceOption,
  type TDEditDetail,
  type TDEditFormValues,
} from '@myorg/modules/tokenized-deposit/data-access';

/**
 * useWalletManagement — 管理员/角色钱包生成与回填 hook（edit 最复杂）。
 *
 * 迁移自 td-manage `edit/hooks/useWalletManagement.tsx`（395 行）。
 * 严格保留源时序、双生成路径、竞态保护、特殊隐藏分支。
 *
 * ## 双生成路径
 *
 * | 路径 | 触发条件 | body | 回填字段 |
 * |------|---------|------|---------|
 * | keystore | selectedKeyService.storageType === 'key_keystore' | chainType + password（明文，**API 内部 AES 加密**）+ walletType=1 + storageType + roleName + blockchainCode + tokenName + ifAdd=true | walletAddress + keyStore + passWord（明文）|
 * | rigsec | storageType !== 'key_keystore' | chainType + walletType（walletAttribute Hot/Cold）+ storageType + roleName + blockchainCode + tokenName + ifAdd=!code | walletAddress + keyStore（无 password）|
 *
 * ### AES 加密说明（关键差异）
 *
 * 源 setWalletInfo 调 `utilWalletKeystoreApi({ password: getEncryptionData(password) })`，
 * 即调用方加密。新架构 `generateWalletKeystore` 的 keystore 分支**内部已 AES 加密**
 * （apiClient 层），故本 hook 传**明文 password**。
 *
 * ## 特殊隐藏分支：Ethereum Sepolia + Huawei KMS
 *
 * selectedBlockchain.value === 'Ethereum Sepolia' && currentKeyService.keyServiceName === 'Huawei KMS'
 * → 隐藏生成按钮 + useAdminWalletListQuery 自动拉取，回填 3 角色钱包地址。
 *
 * ## 竞态保护：tokenName 变化重置钱包
 *
 * shouldResetWalletOnTokenNameChange = shouldHideKeystoreAndPassword && !shouldHideGenerateWalletAction。
 * 即 rigsec/fireblocks 且非特殊隐藏场景下，tokenName 变化时 resetAdminWalletFields()
 * （因 keystore 生成依赖 tokenName，name 变则旧 keystore 失效）。
 * previousTokenNameRef 守卫：仅 name 真实变化（非首次 undefined）才重置。
 *
 * ## 与源差异
 *
 * - antd Form → react-hook-form（form.setValue/getValue/reset）。
 * - utilWalletKeystoreApi（命令式 Promise）→ useGenerateWalletKeystoreMutation + mutateAsync。
 * - tdApplyAdminWalletListApi（命令式）→ useAdminWalletListQuery（声明式 effect）。
 * - modal.confirm（antd）→ confirmOverwrite 回调（调用方用 AlertDialog 实现）。
 * - apiClient 已解包信封 + generateWalletKeystore 内部加密，去掉 res.data.code 检查与
 *   调用方 getEncryptionData(password)。
 *
 * @param params 见 {@link UseWalletManagementParams}
 */
export type WalletRoleType = 1 | 2 | 3;

export interface ModalInfo {
  type: WalletRoleType;
}

export interface UseWalletManagementParams {
  /** 主表单（含 blockchainId/name/钱包 3 角色 9 字段）。 */
  form: UseFormReturn<TDEditFormValues>;
  /** keystore 密码 Modal 表单（含 password）。 */
  form1: UseFormReturn<{ password?: string }>;
  /** 路由 code（存在=编辑态，影响 ifAdd 与 isAdminWalletDisabled）。 */
  code?: string | number;
  /** 编辑详情（applyStatus 用于 isAdminWalletDisabled 判定）。 */
  detailInfo: TDEditDetail;
  blockchainList?: BlockchainOption[];
  keyServiceList?: KeyServiceOption[];
  /** 当前 keyServiceName（form.keyServiceName）。 */
  keyServiceName?: string;
  /** 当前 chainType（edit 页 state）。 */
  chainType: string;
  /** 当前 blockchainId（form.blockchainId），用于自动拉 admin wallet。 */
  blockchain?: string;
  /** 当前 tokenName（form.name），用于竞态保护。 */
  nameValue?: string;
  /** "已有钱包，确认覆盖"确认回调（调用方实现，内部触发 onOk）。 */
  confirmOverwrite: (onOk: () => void) => void;
}

export interface UseWalletManagementReturn {
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  isRigsecModalOpen: boolean;
  setIsRigsecModalOpen: (open: boolean) => void;
  walletAttribute: number;
  setWalletAttribute: (attr: number) => void;
  walletAttributeOptions: Array<{ value: number; label: string }>;
  defaultWalletAttribute: number;
  modalInfo: ModalInfo;
  currentKeyService: KeyServiceOption | undefined;
  shouldHideKeystoreAndPassword: boolean;
  shouldHideGenerateWalletAction: boolean;
  isAdminWalletDisabled: boolean;
  checkWalletAddress: (type: WalletRoleType) => void;
  setWalletInfo: (values: { password?: string }) => Promise<void>;
  handleRigsecSubmit: () => Promise<void>;
  resetAdminWalletFields: () => void;
  setWalletFields: (
    walletList?: Array<{ accountType?: number; walletAddress?: string; keyStore?: string }>,
    includeKeyStore?: boolean,
  ) => void;
  rigsecConfirmLoading: boolean;
}

export function useWalletManagement({
  form,
  form1,
  code,
  detailInfo,
  blockchainList,
  keyServiceList,
  keyServiceName,
  chainType,
  blockchain,
  nameValue,
  confirmOverwrite,
}: UseWalletManagementParams): UseWalletManagementReturn {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRigsecModalOpen, setIsRigsecModalOpen] = useState(false);
  const [walletAttribute, setWalletAttribute] = useState<number>(1);
  const [modalInfo, setModalInfo] = useState<ModalInfo>({ type: 1 });
  const previousTokenNameRef = useRef<string | undefined>(undefined);
  const [rigsecConfirmLoading, setRigsecConfirmLoading] = useState(false);

  const generateWalletMutation = useGenerateWalletKeystoreMutation();
  const t = useTranslations('modules.tokenized-deposit');

  // ── 当前 keyService（按 keyServiceName 匹配）──
  const currentKeyService = useMemo(
    () =>
      keyServiceList?.find(
        (item) => item.keyServiceCode === keyServiceName,
      ),
    [keyServiceList, keyServiceName],
  );

  // ── walletAttribute 候选（Hot=1 / Cold=5，去重）──
  const walletAttributeValues: number[] = useMemo(() => {
    const walletTypes = (
      currentKeyService as (KeyServiceOption & { walletTypes?: unknown }) | undefined
    )?.walletTypes;
    const types = Array.isArray(walletTypes)
      ? walletTypes
          .map(
            (
              item: { walletType?: number } | null | undefined,
            ): number | undefined => item?.walletType,
          )
          .filter(
            (walletType): walletType is number =>
              walletType === 1 || walletType === 5,
          )
      : [];
    return types.length > 0 ? Array.from(new Set(types)) : [5, 1];
  }, [currentKeyService]);

  const walletAttributeOptions: Array<{ value: number; label: string }> =
    useMemo(
      () =>
        walletAttributeValues.map((walletType) => ({
          value: walletType,
          label: walletType === 1 ? 'Hot Wallet' : 'Cold Wallet',
        })),
      [walletAttributeValues],
    );

  const defaultWalletAttribute: number =
    walletAttributeOptions[0]?.value ?? 1;

  // ── storageType 派生标志 ──
  const isDefaultKeystoreService =
    (currentKeyService as (KeyServiceOption & { storageType?: string }) | undefined)
      ?.storageType === 'key_keystore';
  const shouldHideKeystoreAndPassword = !isDefaultKeystoreService;
  const isAdminWalletDisabled =
    (!!code && detailInfo.applyStatus === 35) ||
    shouldHideKeystoreAndPassword;

  // ── Ethereum Sepolia + Huawei KMS 特殊隐藏 ──
  const selectedBlockchain = useMemo(
    () => blockchainList?.find((item) => item.key === blockchain),
    [blockchain, blockchainList],
  );
  const shouldHideGenerateWalletAction =
    selectedBlockchain?.value === 'Ethereum Sepolia' &&
    (currentKeyService as (KeyServiceOption & { keyServiceName?: string }) | undefined)
      ?.keyServiceName === 'Huawei KMS';
  const shouldResetWalletOnTokenNameChange =
    shouldHideKeystoreAndPassword && !shouldHideGenerateWalletAction;

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

  // ── 自动拉 admin wallet（Ethereum Sepolia + Huawei KMS 场景，声明式）──
  const { data: adminWalletListData } = useAdminWalletListQuery(
    shouldHideGenerateWalletAction ? blockchain : undefined,
  );

  useEffect(() => {
    if (!shouldHideGenerateWalletAction || !blockchain) return;
    if (!adminWalletListData) return;
    if (!adminWalletListData.length) return;
    setWalletAddressFields(adminWalletListData as AdminWalletListItem[]);
  }, [
    adminWalletListData,
    blockchain,
    setWalletAddressFields,
    shouldHideGenerateWalletAction,
  ]);

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

  // ── checkWalletAddress：分流 keystore / rigsec 生成入口 ──
  const checkWalletAddress = useCallback(
    (type: WalletRoleType) => {
      const walletAddressContractOwner = form.getValues(
        'walletAddressContractOwner',
      );
      const walletAddressPaymentOfGasFee = form.getValues(
        'walletAddressPaymentOfGasFee',
      );
      const walletAddressManagementWallet = form.getValues(
        'walletAddressManagementWallet',
      );
      const keyStoreContractOwner = form.getValues('keyStoreContractOwner');
      const keyStorePaymentOfGasFee = form.getValues('keyStorePaymentOfGasFee');
      const keyStoreManagementWallet = form.getValues(
        'keyStoreManagementWallet',
      );

      const selectedKeyService = keyServiceList?.find(
        (item) => item.keyServiceCode === keyServiceName,
      );
      const isNotKeystore =
        (selectedKeyService as (KeyServiceOption & { storageType?: string }) | undefined)
          ?.storageType !== 'key_keystore';

      if (isNotKeystore) {
        setModalInfo({ type });
        setWalletAttribute(defaultWalletAttribute);
        setIsRigsecModalOpen(true);
        return;
      }

      const hasExisting =
        (type === 1 &&
          (walletAddressContractOwner || keyStoreContractOwner)) ||
        (type === 2 &&
          (walletAddressPaymentOfGasFee || keyStorePaymentOfGasFee)) ||
        (type === 3 &&
          (walletAddressManagementWallet || keyStoreManagementWallet));

      if (hasExisting) {
        confirmOverwrite(() => {
          setIsModalOpen(true);
          setModalInfo({ type });
        });
      } else {
        setIsModalOpen(true);
        setModalInfo({ type });
      }
    },
    [
      confirmOverwrite,
      defaultWalletAttribute,
      form,
      keyServiceList,
      keyServiceName,
    ],
  );

  // ── setWalletInfo：keystore 路径生成（密码 Modal 提交）──
  const setWalletInfo = useCallback(
    async (values: { password?: string }) => {
      const { password } = values;
      const currentBlockchainId = form.getValues('blockchainId');
      const selectedBlockchainInner = blockchainList?.find(
        (item) => item.key === currentBlockchainId,
      );
      const selectedKeyService = keyServiceList?.find(
        (item) => item.keyServiceCode === keyServiceName,
      );
      const tokenName = form.getValues('name');

      const storageType =
        (selectedKeyService as (KeyServiceOption & { storageType?: string }) | undefined)
          ?.storageType || 'key_keystore';
      const blockchainCode =
        (selectedBlockchainInner as (BlockchainOption & { blockchainCode?: string }) | undefined)
          ?.blockchainCode || '';

      try {
        const res = await generateWalletMutation.mutateAsync({
          chainType,
          // 注意：明文 password，generateWalletKeystore 内部 AES 加密。
          password: password ?? '',
          walletType: 1,
          storageType,
          roleName: String(modalInfo.type),
          blockchainCode,
          tokenName: tokenName ?? '',
          ifAdd: true,
        });

        if (res) {
          const { keystore, walletAddress } = res;
          if (modalInfo.type === 1) {
            form.setValue('walletAddressContractOwner', walletAddress);
            form.setValue('keyStoreContractOwner', keystore);
            (form.setValue as (name: string, value: unknown) => void)(
              'passWordContractOwner',
              password,
            );
          } else if (modalInfo.type === 2) {
            form.setValue('walletAddressPaymentOfGasFee', walletAddress);
            form.setValue('keyStorePaymentOfGasFee', keystore);
            (form.setValue as (name: string, value: unknown) => void)(
              'passWordPaymentOfGasFee',
              password,
            );
          } else {
            form.setValue('walletAddressManagementWallet', walletAddress);
            form.setValue('keyStoreManagementWallet', keystore);
            (form.setValue as (name: string, value: unknown) => void)(
              'passWordManagementWallet',
              password,
            );
          }
        }
        if (res) {
          form1.reset();
          setIsModalOpen(false);
        }
      } catch {
        toast.error(t('td_toast_wallet_generate_failed'));
      }
    },
    [
      blockchainList,
      chainType,
      form,
      form1,
      generateWalletMutation,
      keyServiceList,
      keyServiceName,
      modalInfo.type,
      t,
    ],
  );

  // ── handleRigsecSubmit：rigsec/fireblocks 路径生成（Hot/Cold，无 password）──
  const handleRigsecSubmit = useCallback(async () => {
    try {
      setRigsecConfirmLoading(true);
      const currentBlockchainId = form.getValues('blockchainId');
      const selectedBlockchainInner = blockchainList?.find(
        (item) => item.key === currentBlockchainId,
      );
      const selectedKeyService = keyServiceList?.find(
        (item) => item.keyServiceCode === keyServiceName,
      );
      const tokenName = form.getValues('name');

      const storageType =
        (selectedKeyService as (KeyServiceOption & { storageType?: string }) | undefined)
          ?.storageType || 'key_rigsec';
      const blockchainCode =
        (selectedBlockchainInner as (BlockchainOption & { blockchainCode?: string }) | undefined)
          ?.blockchainCode || '';

      const res = await generateWalletMutation.mutateAsync({
        chainType,
        walletType: walletAttribute,
        storageType,
        roleName: String(modalInfo.type),
        blockchainCode,
        tokenName: tokenName ?? '',
        ifAdd: !code,
      });

      if (res) {
        const { keystore, walletAddress } = res;
        if (modalInfo.type === 1) {
          form.setValue('walletAddressContractOwner', walletAddress);
          form.setValue('keyStoreContractOwner', keystore);
        } else if (modalInfo.type === 2) {
          form.setValue('walletAddressPaymentOfGasFee', walletAddress);
          form.setValue('keyStorePaymentOfGasFee', keystore);
        } else {
          form.setValue('walletAddressManagementWallet', walletAddress);
          form.setValue('keyStoreManagementWallet', keystore);
        }
        setWalletAttribute(defaultWalletAttribute);
      }
    } catch {
      toast.error(t('td_toast_wallet_generate_failed'));
    } finally {
      // 无论成功/失败，均关闭 Modal、重置表单、关闭 loading，避免卡在 loading 态。
      setRigsecConfirmLoading(false);
      setIsRigsecModalOpen(false);
      form1.reset();
    }
  }, [
    blockchainList,
    chainType,
    code,
    defaultWalletAttribute,
    form,
    form1,
    generateWalletMutation,
    keyServiceList,
    keyServiceName,
    modalInfo.type,
    t,
    walletAttribute,
  ]);

  // ── 竞态保护：tokenName 变化重置钱包 ──
  useEffect(() => {
    const previousName = previousTokenNameRef.current;
    previousTokenNameRef.current = nameValue;
    if (!shouldResetWalletOnTokenNameChange) return;
    if (previousName === undefined) return;
    if (nameValue !== previousName) {
      resetAdminWalletFields();
    }
  }, [nameValue, resetAdminWalletFields, shouldResetWalletOnTokenNameChange]);

  return {
    isModalOpen,
    setIsModalOpen,
    isRigsecModalOpen,
    setIsRigsecModalOpen,
    walletAttribute,
    setWalletAttribute,
    walletAttributeOptions,
    defaultWalletAttribute,
    modalInfo,
    currentKeyService,
    shouldHideKeystoreAndPassword,
    shouldHideGenerateWalletAction,
    isAdminWalletDisabled,
    checkWalletAddress,
    setWalletInfo,
    handleRigsecSubmit,
    resetAdminWalletFields,
    setWalletFields,
    rigsecConfirmLoading,
  };
}
