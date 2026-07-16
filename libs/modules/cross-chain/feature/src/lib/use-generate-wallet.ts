'use client';

import * as React from 'react';
import {
  type Path,
  type UseFormGetValues,
  type UseFormSetValue,
  type UseFormTrigger,
} from 'react-hook-form';
import {
  useGenerateWalletKeystoreMutation,
  type WalletKeystoreData,
} from '@myorg/modules/cross-chain/data-access';
import { getEncryptionData } from '@myorg/modules/cross-chain/util';

/**
 * 生成钱包 Modal 状态机 + wallet/keystore 调用逻辑。
 *
 * 迁移自 td-manage src/pages/cross-chain/liquidity-pool/edit.tsx 的
 * `checkWalletAddress` + `setWalletInfo` + `isModalOpen` 三段逻辑。
 *
 * 抽成 hook 的原因（cc-15 summary 建议）：liquidity-pool-edit 主表单已较大，
 * 生成钱包含「校验 → 覆盖确认 AlertDialog → Modal password → AES 加密 →
 * wallet/keystore → 回填 4 字段」整条时序，单文件承载易触发 nx lazy 误报，
 * 故剥离为独立 hook（对齐 statements/journal-entries 拆 content 的先例）。
 *
 * 完整搬运源码时序（勿简化）：
 * 1. `checkWalletAddress()`：
 *    - `form.validateFields(['liquidityPoolWalletAddress'])`（react-hook-form 用
 *      `trigger('liquidityPoolWalletAddress')`）。
 *    - 无论校验通过与否，只要 `liquidityPoolWalletAddress || keystore` 已有值，
 *      就弹覆盖确认 AlertDialog（cross_chain_00134 标题 + 00135/00143 文案），
 *      确认后才开 Modal；否则直接开 Modal。
 *    - 源码 catch 分支与 then 分支行为完全相同（仅有值判断），此处合并为单一逻辑。
 * 2. `setWalletInfo({ password })`：
 *    - chainType：`blockName === 'Aptos' ? 'aptos' : 'evm'`。
 *    - password 经 `getEncryptionData`（AES-CBC）加密后传 wallet/keystore。
 *    - code===0（apiClient 已解包成功），回填 keystore / keystorePassword（明文，
 *      提交时再加密）/ liquidityPoolWalletAddress，关 Modal，重置 password 输入。
 *
 * @param form - 主表单 react-hook-form 实例（用于 trigger / getValues / setValue）。
 * @param blockName - 当前 token 区块链名（Aptos → aptos，否则 evm）。
 */
export interface UseGenerateWalletArgs<TFormValues extends {
  liquidityPoolWalletAddress?: string;
  keystore?: string;
  keystorePassword?: string;
}> {
  /** 主表单实例的子集（trigger / getValues / setValue），由调用方从 useForm 解构传入。 */
  form: {
    trigger: UseFormTrigger<TFormValues>;
    getValues: UseFormGetValues<TFormValues>;
    setValue: UseFormSetValue<TFormValues>;
  };
  /** 当前 token 的 blockName（决定 chainType：Aptos→aptos，否则 evm）。 */
  blockName: string;
}

export interface UseGenerateWalletReturn {
  /** 生成钱包 Modal 开关。 */
  isModalOpen: boolean;
  /** 关闭 Modal（重置 password 输入）。 */
  closeModal: () => void;
  /** Modal password 字段值。 */
  password: string;
  /** Modal password 字段 setter。 */
  setPassword: (v: string) => void;
  /** wallet/keystore mutation（isPending 用于禁用 Modal 提交按钮）。 */
  isPending: boolean;
  /** 覆盖确认 AlertDialog 开关。 */
  confirmOpen: boolean;
  /** 关闭覆盖确认 AlertDialog。 */
  closeConfirm: () => void;
  /** 确认覆盖后开生成钱包 Modal（AlertDialog onOk）。 */
  confirmOverwrite: () => void;
  /** 「生成钱包」入口点击（校验地址 → 视情况弹覆盖确认 → 开 Modal）。 */
  handleGenerateWallet: () => Promise<void>;
  /** Modal「确认」提交（AES 加密 password → wallet/keystore → 回填 4 字段）。 */
  handleConfirmGenerate: () => Promise<void>;
}

/**
 * 生成钱包 Modal + wallet/keystore 调用 hook。
 *
 * @see UseGenerateWalletArgs
 */
export function useGenerateWallet<TFormValues extends {
  liquidityPoolWalletAddress?: string;
  keystore?: string;
  keystorePassword?: string;
}>({
  form,
  blockName,
}: UseGenerateWalletArgs<TFormValues>): UseGenerateWalletReturn {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const genWalletMutation = useGenerateWalletKeystoreMutation();

  const closeModal = React.useCallback(() => {
    setIsModalOpen(false);
    setPassword('');
  }, []);

  const closeConfirm = React.useCallback(() => {
    setConfirmOpen(false);
  }, []);

  const confirmOverwrite = React.useCallback(() => {
    setConfirmOpen(false);
    setIsModalOpen(true);
  }, []);

  /**
   * 「生成钱包」入口（源码 checkWalletAddress）。
   *
   * trigger 返回 false 时仍走同一分支（源码 then / catch 行为一致），
   * 仅据 liquidityPoolWalletAddress || keystore 是否有值决定是否弹覆盖确认。
   */
  const handleGenerateWallet = React.useCallback(async () => {
    // 触发地址字段校验（源码 validateFields(['liquidityPoolWalletAddress'])）。
    // 无视校验结果——校验态由字段自身渲染决定，此处只为满足源码「先校验」时序。
    await form
      .trigger('liquidityPoolWalletAddress' as Path<TFormValues>)
      .catch(() => false);
    const values = form.getValues();
    const hasValue = !!(
      values.liquidityPoolWalletAddress || values.keystore
    );
    if (hasValue) {
      // 已有值：弹覆盖确认（源码 modal.confirm）。
      setConfirmOpen(true);
    } else {
      // 无值：直接开生成钱包 Modal。
      setIsModalOpen(true);
    }
  }, [form]);

  /**
   * Modal「确认」提交（源码 setWalletInfo）。
   *
   * AES 加密 password → wallet/keystore（chainType 按 blockName 分支）→
   * code===0 回填 keystore / keystorePassword（明文）/ liquidityPoolWalletAddress，
   * 关 Modal + 重置 password。
   */
  const handleConfirmGenerate = React.useCallback(async () => {
    if (!password) return;
    genWalletMutation.mutate(
      {
        chainType: blockName === 'Aptos' ? 'aptos' : 'evm',
        password: getEncryptionData(password),
      },
      {
        onSuccess: (data: WalletKeystoreData | undefined) => {
          if (!data) return;
          // 回填 3 字段（keystorePassword 存明文，提交时再加密）。
          (form.setValue as UseFormSetValue<TFormValues>)(
            'keystore' as never,
            (data.keystore ?? '') as never,
          );
          (form.setValue as UseFormSetValue<TFormValues>)(
            'keystorePassword' as never,
            password as never,
          );
          (form.setValue as UseFormSetValue<TFormValues>)(
            'liquidityPoolWalletAddress' as never,
            (data.walletAddress ?? '') as never,
          );
          // 关 Modal + 重置 password 输入（源码 setIsModalOpen(false) + form1.resetFields()）。
          setIsModalOpen(false);
          setPassword('');
        },
        // wallet/keystore 失败：源码未显式 toast，与同模块 mutation 一致
        // （API 错误由 apiClient 统一拦截），此处不补 toast 避免硬编码英文。
      },
    );
  }, [password, blockName, genWalletMutation, form]);

  return {
    isModalOpen,
    closeModal,
    password,
    setPassword,
    isPending: genWalletMutation.isPending,
    confirmOpen,
    closeConfirm,
    confirmOverwrite,
    handleGenerateWallet,
    handleConfirmGenerate,
  };
}
