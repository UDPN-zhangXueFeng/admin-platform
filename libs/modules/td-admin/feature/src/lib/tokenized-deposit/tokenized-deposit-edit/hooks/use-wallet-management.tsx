'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { useAdminWalletListQuery } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/+queries/tokenized-deposit.queries';
import type { AdminWalletListItem, KeyServiceOption, TDEditDetail, TDEditFormValues } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.model';
import type { BlockchainOption } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit';

import { useWalletGeneration } from './use-wallet-generation';
import { useWalletFieldSync } from './use-wallet-field-sync';

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

  const {
    setWalletFields,
    setWalletAddressFields,
    resetAdminWalletFields,
  } = useWalletFieldSync(form);

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

  const {
    rigsecConfirmLoading,
    checkWalletAddress,
    setWalletInfo,
    handleRigsecSubmit,
  } = useWalletGeneration({
    form,
    form1,
    code,
    blockchainList,
    keyServiceList,
    keyServiceName,
    chainType,
    modalInfo,
    walletAttribute,
    defaultWalletAttribute,
    confirmOverwrite,
    setModalInfo,
    setIsModalOpen,
    setIsRigsecModalOpen,
    setWalletAttribute,
  });

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
