'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  downloadSmartContract,
  editNode,
  saveNode,
  updateNodeState,
} from '../blockchain.api';
import type {
  DownloadParams,
  NodeEditReqVO,
  NodeSaveReqVO,
  NodeUpdateStateReqVO,
} from '../blockchain.model';
import { blockchainKeys } from './blockchain.keys';

/**
 * blockchain 模块 mutations（写操作）。
 *
 * 从 queries.ts 中拆分出来，单独管理写入语义的 hooks。
 * queries.ts 中保留同名的 re-export，避免调用方 import 路径变更。
 */

/**
 * 新增节点 mutation。
 *
 * 成功后失效所有 node 查询缓存（列表/详情/参数明细），确保列表刷新。
 * 调用方在 onSuccess 回调中执行 message.success + router.push。
 *
 * 用法：
 * ```ts
 * const { mutate: add, isPending } = useSaveNodeMutation();
 * add(dto, { onSuccess: () => { toast.success('ok'); router.push('/blockchain/node'); } });
 * ```
 */
export function useSaveNodeMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, NodeSaveReqVO>({
    mutationFn: (dto) => saveNode(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: blockchainKeys.node() });
    },
  });
}

/**
 * 编辑节点 mutation。
 *
 * 成功后失效所有 node 查询缓存（列表/详情/参数明细），确保列表刷新。
 * 调用方在 onSuccess 回调中执行 message.success + router.push。
 *
 * 用法：
 * ```ts
 * const { mutate: edit, isPending } = useEditNodeMutation();
 * edit(dto, { onSuccess: () => { toast.success('ok'); router.push('/blockchain/node'); } });
 * ```
 */
export function useEditNodeMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, NodeEditReqVO>({
    mutationFn: (dto) => editNode(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: blockchainKeys.node() });
    },
  });
}

/**
 * 更新节点状态 mutation（启停删共用，state 区分）。
 *
 * state: 1 启用 / 2 禁用 / 3 删除。
 * 启停直接调；删除在 Modal 内 onFinish 调。
 * 成功后失效所有 node 查询缓存，确保列表刷新。
 *
 * 用法：
 * ```ts
 * const { mutate: updateState, isPending } = useUpdateNodeStateMutation();
 * // 启用
 * updateState({ blockchainId, nodeLocationId, state: 1 });
 * // 禁用
 * updateState({ blockchainId, nodeLocationId, state: 2 });
 * // 删除（Modal 确认后）
 * updateState({ blockchainId, nodeLocationId, state: 3 });
 * ```
 */
export function useUpdateNodeStateMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, NodeUpdateStateReqVO>({
    mutationFn: (dto) => updateNodeState(dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: blockchainKeys.node() });
    },
  });
}

/**
 * 下载智能合约包 mutation（blob + <a> 触发）。
 *
 * 成功后失效 smart-contract 列表缓存。
 * 调用方在 onSuccess 回调中执行 message.success toast。
 *
 * 用法：
 * ```ts
 * const { mutate: download, isPending } = useDownloadSmartContractMutation();
 * download({ busId, busType }, {
 *   onSuccess: () => toast.success('Download success'),
 *   onError: () => toast.error('Download failed'),
 * });
 * ```
 */
export function useDownloadSmartContractMutation() {
  const qc = useQueryClient();
  return useMutation<void, Error, DownloadParams>({
    mutationFn: (params) => downloadSmartContract(params),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: blockchainKeys.smartContract() });
    },
  });
}
