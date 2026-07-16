'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  approvalAdminWallet,
  configureRoleWallet,
  createTDApply,
  deleteTD,
  deployContract,
  editTDOperation,
  generateWalletKeystore,
  issueStablecoin,
  removeStablecoin,
  submitMintMelt,
  updateAdminWallet,
  updateTDStatus,
} from '../tokenized-deposit.api';
import type {
  GenerateWalletResult,
} from '../tokenized-deposit.model';
import { tdKeys } from './tokenized-deposit.keys';

/**
 * Tokenized-Deposit TanStack Query mutations（写操作 hooks）。
 *
 * 对齐 cross-chain / blockchain 模块模式：
 * - 写操作成功后 invalidate 对应分组的查询缓存，确保列表自动刷新。
 * - 调用方在 onSuccess 回调中执行 toast.success + router.push（toast/router 不内置）。
 * - 不自动 toast/redirect —— 由调用方控制 UI 反馈。
 *
 * ## AES 钱包加密（调用方职责）
 *
 * `generateWalletKeystore` 的 body 形态由调用方决定（keystore / rigsec）：
 * - keystore 分支：调用方传明文 password，API 内部 AES 加密（与后端解密一致）。
 * - rigsec 分支：不传 password。
 * mutation 只透传 body，不关心 storageType 分支；password 加密细节见
 * api.ts {@link generateWalletKeystore} 注释 + td-11/td-13 调用方用 getEncryptionData。
 *
 * `updateAdminWallet` 的 password 由调用方在提交前 AES 加密（getEncryptionData）。
 */
export function useSubmitMintMeltMutation() {
  const qc = useQueryClient();
  return useMutation<
    unknown,
    Error,
    Parameters<typeof submitMintMelt>[0]
  >({
    mutationFn: (data) => submitMintMelt(data),
    onSuccess: () => {
      // 刷新储备余额（Mint 后可销毁额变化）+ TD 记录 + apply 标题状态
      void qc.invalidateQueries({ queryKey: tdKeys.overview() });
    },
  });
}

export function useIssueStablecoinMutation() {
  const qc = useQueryClient();
  return useMutation<
    unknown,
    Error,
    Parameters<typeof issueStablecoin>[0]
  >({
    mutationFn: (data) => issueStablecoin(data),
    onSuccess: () => {
      // 刷新稳定币信息（surplusCount 变化）+ 稳定币记录
      void qc.invalidateQueries({ queryKey: tdKeys.view() });
    },
  });
}

export function useRemoveStablecoinMutation() {
  const qc = useQueryClient();
  return useMutation<
    unknown,
    Error,
    Parameters<typeof removeStablecoin>[0]
  >({
    mutationFn: (data) => removeStablecoin(data),
    onSuccess: () => {
      // 刷新稳定币信息（surplusCount 变化）+ 稳定币记录
      void qc.invalidateQueries({ queryKey: tdKeys.view() });
    },
  });
}

export function useDeployContractMutation() {
  const qc = useQueryClient();
  return useMutation<
    unknown,
    Error,
    Parameters<typeof deployContract>[0]
  >({
    mutationFn: (data) => deployContract(data),
    onSuccess: () => {
      // 刷新合约包/合约明细/部署历史/部署步骤 + apply 标题状态
      void qc.invalidateQueries({ queryKey: tdKeys.overview() });
    },
  });
}

/**
 * 启停 TD（updateTDStatus）mutation。
 * enable: 1=启用 / 0=禁用。成功后刷新 apply 标题列表状态。
 */
export function useUpdateTDStatusMutation() {
  const qc = useQueryClient();
  return useMutation<
    unknown,
    Error,
    { code: string; enable: number }
  >({
    mutationFn: ({ code, enable }) => updateTDStatus(code, enable),
    onSuccess: () => {
      // 刷新 apply 标题列表（state 字段变化）
      void qc.invalidateQueries({ queryKey: tdKeys.overviewApplyList() });
    },
  });
}

/**
 * 删除待审批 TD（deleteTD）mutation。
 * 成功后刷新 apply 标题列表。
 */
export function useDeleteTDMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { code: string }>({
    mutationFn: ({ code }) => deleteTD(code),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tdKeys.overviewApplyList() });
    },
  });
}

/**
 * 管理员钱包更新（updateAdminWallet）mutation。
 * password 由调用方在提交前 AES 加密。成功后刷新钱包列表/余额列表。
 */
export function useUpdateAdminWalletMutation() {
  const qc = useQueryClient();
  return useMutation<
    unknown,
    Error,
    Parameters<typeof updateAdminWallet>[0]
  >({
    mutationFn: (data) => updateAdminWallet(data),
    onSuccess: () => {
      // 刷新钱包列表（listPage + balance 两个分支）+ 钱包详情/历史
      void qc.invalidateQueries({ queryKey: tdKeys.wallet() });
    },
  });
}

/**
 * 管理员钱包审批（approvalAdminWallet）mutation。
 * body: recordId / remark / state。成功后刷新钱包列表/详情/历史。
 */
export function useApprovalAdminWalletMutation() {
  const qc = useQueryClient();
  return useMutation<
    unknown,
    Error,
    Parameters<typeof approvalAdminWallet>[0]
  >({
    mutationFn: (data) => approvalAdminWallet(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tdKeys.wallet() });
    },
  });
}

/**
 * 生成钱包 keystore mutation（util/wallet/keystore）。
 *
 * body 形态由调用方决定（keystore / rigsec），mutation 只透传：
 * - keystore 分支：调用方传明文 password，API 内部 AES 加密。
 * - rigsec 分支：不传 password。
 * 返回 keystore + walletAddress 用于回填表单（不自动 invalidate，因这是查询操作非列表写操作）。
 *
 * 用法：
 * ```ts
 * const { mutate: genWallet, isPending, data } = useGenerateWalletKeystoreMutation();
 * genWallet({ chainType: 'evm', storageType: 'key_keystore', password }, {
 *   onSuccess: (res) => {
 *     // res?.keystore, res?.walletAddress 回填表单
 *   },
 * });
 * ```
 */
export function useGenerateWalletKeystoreMutation() {
  return useMutation<
    GenerateWalletResult | undefined,
    Error,
    Parameters<typeof generateWalletKeystore>[0]
  >({
    mutationFn: (data) => generateWalletKeystore(data),
  });
}

/**
 * 新增 TD 提交（createTDApply）mutation。
 * query.code 为空时走此分支。payload 由调用方组装（含 AES password + coaPayload + walletPayload）。
 * 成功后刷新 apply 标题列表 + 编辑详情。
 */
export function useCreateTDApplyMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, Parameters<typeof createTDApply>[0]>({
    mutationFn: (data) => createTDApply(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tdKeys.overview() });
    },
  });
}

/**
 * 编辑 TD 提交（editTDOperation）mutation。
 * query.code 存在时走此分支。成功后刷新 apply 标题列表 + 编辑详情 + 合约。
 */
export function useEditTDOperationMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, Parameters<typeof editTDOperation>[0]>({
    mutationFn: (data) => editTDOperation(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tdKeys.overview() });
      void qc.invalidateQueries({ queryKey: tdKeys.edit() });
    },
  });
}

/**
 * 配置角色钱包（configureRoleWallet）mutation。
 * MOCK - 后端未实装，保留 mock。成功后刷新角色钱包列表。
 */
export function useConfigureRoleWalletMutation() {
  const qc = useQueryClient();
  return useMutation<
    unknown,
    Error,
    Parameters<typeof configureRoleWallet>[0]
  >({
    mutationFn: (params) => configureRoleWallet(params),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tdKeys.roleWallet() });
    },
  });
}
