'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  editLiquidityPool,
  editRdBridge,
  editTokenPair,
  generateWalletKeystore,
  reauthorizeLiquidityPool,
  saveLiquidityPool,
  saveRdBridge,
  saveTokenPair,
  transferOutLiquidityPool,
  updateRdBridge,
  updateTokenPair,
} from '../cross-chain.api';
import type {
  LiquidityPoolEditReq,
  LiquidityPoolReauthorizeReq,
  LiquidityPoolSaveReq,
  LiquidityPoolTransferOutReq,
  RdBridgeEditReq,
  RdBridgeSaveReq,
  RdBridgeUpdateReq,
  TokenPairEditReq,
  TokenPairSaveReq,
  TokenPairUpdateReq,
  WalletKeystoreReq,
  WalletKeystoreData,
} from '../cross-chain.model';
import { crossChainKeys } from './cross-chain.keys';

/**
 * Cross-Chain TanStack Query mutations（写操作 hooks）。
 *
 * 对齐 blockchain 模块模式：
 * - 写操作成功后 invalidate 对应子模块的列表查询，确保列表自动刷新。
 * - 调用方在 onSuccess 回调中执行 toast.success + router.push。
 * - 不自动 toast/redirect —— 由调用方控制 UI 反馈。
 *
 * key constraint（cc-5 summary）:
 * - rd-bridge update status 传 35/50（ENABLE/DISABLE，非列表显示值）。
 * - token-pair update status 传 35/50（与列表显示 1/3/5/10 不同语义）。
 * - generateWalletKeystore 调 wallet/keystore，chainType 由调用方按 blockName 分支。
 * - 全部 mutation 成功后 invalidate 对应子模块的 list key（非 detail key）。
 */

// ======================================================================
// 1. RD-Bridge 写操作（save / edit / update）
// ======================================================================

/**
 * 新增 RD-Bridge（注册）mutation。
 *
 * 成功后失效所有 rd-bridge 查询缓存，确保列表刷新。
 * 调用方在 onSuccess 中 toast.success + router.push。
 *
 * 用法：
 * ```ts
 * const { mutate: save, isPending } = useSaveRdBridgeMutation();
 * save(dto, { onSuccess: () => { toast.success('ok'); router.push('/cross-chain/rd-bridge'); } });
 * ```
 */
export function useSaveRdBridgeMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, RdBridgeSaveReq>({
    mutationFn: (dto) => saveRdBridge(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: crossChainKeys.rdBridge() });
    },
  });
}

/**
 * 编辑 RD-Bridge mutation。
 *
 * 编辑态剔除 endpointId/blockchainId（不可改），仅可改合约地址/监控配置/邮箱。
 * 成功后失效所有 rd-bridge 查询缓存。
 *
 * 用法：
 * ```ts
 * const { mutate: edit, isPending } = useEditRdBridgeMutation();
 * edit(dto, { onSuccess: () => { toast.success('ok'); router.push('/cross-chain/rd-bridge'); } });
 * ```
 */
export function useEditRdBridgeMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, RdBridgeEditReq>({
    mutationFn: (dto) => editRdBridge(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: crossChainKeys.rdBridge() });
    },
  });
}

/**
 * 更新 RD-Bridge 状态 mutation（启用 35 / 禁用 50）。
 *
 * 禁用时若 isTokenPaired===1 调用方需先弹 warning Modal 拦截（rd-bridge/index 业务逻辑）。
 * 成功后失效所有 rd-bridge 查询缓存。
 *
 * 用法：
 * ```ts
 * const { mutate: update, isPending } = useUpdateRdBridgeMutation();
 * // 启用
 * update({ crossChainId, status: 35, remarks });
 * // 禁用
 * update({ crossChainId, status: 50, remarks });
 * ```
 */
export function useUpdateRdBridgeMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, RdBridgeUpdateReq>({
    mutationFn: (dto) => updateRdBridge(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: crossChainKeys.rdBridge() });
    },
  });
}

// ======================================================================
// 2. Liquidity-Pool 写操作（save / edit / reauthorize / transferOut / generateWallet）
// ======================================================================

/**
 * 新增流动性池 mutation。
 *
 * keystorePassword 提交前由调用方 AES 加密。
 * 成功后失效所有 liquidity-pool 查询缓存。
 *
 * 用法：
 * ```ts
 * const { mutate: save, isPending } = useSaveLiquidityPoolMutation();
 * save(dto, { onSuccess: () => { toast.success('ok'); router.push('/cross-chain/liquidity-pool'); } });
 * ```
 */
export function useSaveLiquidityPoolMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, LiquidityPoolSaveReq>({
    mutationFn: (dto) => saveLiquidityPool(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: crossChainKeys.liquidityPool() });
    },
  });
}

/**
 * 编辑流动性池 mutation。
 *
 * 编辑态剔除 tokenId；keystorePassword 未改则原样传，否则调用方 AES 加密。
 * 成功后失效所有 liquidity-pool 查询缓存。
 *
 * 用法：
 * ```ts
 * const { mutate: edit, isPending } = useEditLiquidityPoolMutation();
 * edit(dto, { onSuccess: () => { toast.success('ok'); router.push('/cross-chain/liquidity-pool'); } });
 * ```
 */
export function useEditLiquidityPoolMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, LiquidityPoolEditReq>({
    mutationFn: (dto) => editLiquidityPool(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: crossChainKeys.liquidityPool() });
    },
  });
}

/**
 * 流动性池重新授权 mutation。
 *
 * 传 liquidityPoolId + deductibleAmount，成功刷新列表。
 * （仅 status===5 已授权 的行可用）。
 *
 * 用法：
 * ```ts
 * const { mutate: reauth, isPending } = useReauthorizeLiquidityPoolMutation();
 * reauth({ liquidityPoolId, deductibleAmount }, { onSuccess: () => toast.success('ok') });
 * ```
 */
export function useReauthorizeLiquidityPoolMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, LiquidityPoolReauthorizeReq>({
    mutationFn: (dto) => reauthorizeLiquidityPool(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: crossChainKeys.liquidityPool() });
    },
  });
}

/**
 * 流动性池转出 mutation。
 *
 * 传 amount + receiverWalletAddress + keystorePassword（调用方 AES 加密），成功刷新列表。
 * （仅 status===5 已授权 的行可用）。
 *
 * 用法：
 * ```ts
 * const { mutate: transfer, isPending } = useTransferOutLiquidityPoolMutation();
 * transfer({ liquidityPoolId, amount, receiverWalletAddress, keystorePassword }, { onSuccess: () => toast.success('ok') });
 * ```
 */
export function useTransferOutLiquidityPoolMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, LiquidityPoolTransferOutReq>({
    mutationFn: (dto) => transferOutLiquidityPool(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: crossChainKeys.liquidityPool() });
    },
  });
}

/**
 * 生成钱包 mutation（wallet/keystore，来自 common.ts）。
 *
 * chainType 由调用方按 blockName 分支：blockName==='Aptos' ? 'aptos' : 'evm'。
 * password 提交前由调用方 AES 加密。
 * 返回 keystore + walletAddress 用于回填表单（不自动 invalidate，因为这是查询操作不是列表写操作）。
 *
 * 用法：
 * ```ts
 * const { mutate: genWallet, isPending, data } = useGenerateWalletKeystoreMutation();
 * genWallet({ chainType: 'evm', password }, {
 *   onSuccess: (data) => {
 *     // data.keystore, data.walletAddress 回填表单
 *     setValue('keystore', data?.keystore ?? '');
 *     setValue('keystorePassword', password);
 *     setValue('liquidityPoolWalletAddress', data?.walletAddress ?? '');
 *   }
 * });
 * ```
 */
export function useGenerateWalletKeystoreMutation() {
  return useMutation<WalletKeystoreData | undefined, Error, WalletKeystoreReq>({
    mutationFn: (dto) => generateWalletKeystore(dto),
  });
}

// ======================================================================
// 3. Token-Pair 写操作（save / edit / update）
// ======================================================================

/**
 * 新增代币对 mutation。
 *
 * send/receive 全字段，crossChainFee 经调用方小数位校验后提交。
 * 成功后失效所有 token-pair 查询缓存。
 *
 * 用法：
 * ```ts
 * const { mutate: save, isPending } = useSaveTokenPairMutation();
 * save(dto, { onSuccess: () => { toast.success('ok'); router.push('/cross-chain/token-pair'); } });
 * ```
 */
export function useSaveTokenPairMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, TokenPairSaveReq>({
    mutationFn: (dto) => saveTokenPair(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: crossChainKeys.tokenPair() });
    },
  });
}

/**
 * 编辑代币对 mutation。
 *
 * 编辑态仅 crossChainFee 可改（其余字段 disabled）。
 * 成功后失效所有 token-pair 查询缓存。
 *
 * 用法：
 * ```ts
 * const { mutate: edit, isPending } = useEditTokenPairMutation();
 * edit(dto, { onSuccess: () => { toast.success('ok'); router.push('/cross-chain/token-pair'); } });
 * ```
 */
export function useEditTokenPairMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, TokenPairEditReq>({
    mutationFn: (dto) => editTokenPair(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: crossChainKeys.tokenPair() });
    },
  });
}

/**
 * 更新代币对状态 mutation（启用 35 / 禁用 50）。
 *
 * 注意：update 传 35/50（非列表显示值 1/3/5/10）。
 * - TOKEN_PAIR_UPDATE_STATE.ENABLE = 35
 * - TOKEN_PAIR_UPDATE_STATE.DISABLE = 50
 * 调用方用常量而非硬编码。
 * 成功后失效所有 token-pair 查询缓存。
 *
 * 用法：
 * ```ts
 * const { mutate: update, isPending } = useUpdateTokenPairMutation();
 * // 启用
 * update({ tokenCrossChainId, status: 35, remarks });
 * // 禁用
 * update({ tokenCrossChainId, status: 50, remarks });
 * ```
 */
export function useUpdateTokenPairMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, TokenPairUpdateReq>({
    mutationFn: (dto) => updateTokenPair(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: crossChainKeys.tokenPair() });
    },
  });
}
