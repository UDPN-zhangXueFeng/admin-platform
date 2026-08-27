'use client';

/**
 * 实例密钥域 mutation hooks（源 api/instance-key.ts 下载/重置操作）。
 * 下载（GET public / POST private）无服务端副作用不失效缓存；
 * 重置（upstream/downstream）后失效视图缓存（源 drawer 重置成功后重载 view）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  downloadPrivateKey,
  downloadPublicKey,
  resetInstanceKey,
} from './instance-key.api';
import { instanceKeyKeys } from './instance-key.keys';
import type { KeyPrivateDownloadReq, KeyResetReq } from './instance-key.model';

/** 公钥下载（GET /instance/key/public/download，PEM 文本落 Blob）。 */
export function usePublicKeyDownloadMutation() {
  return useMutation({ mutationFn: () => downloadPublicKey() });
}

/** 私钥下载（POST /instance/key/private/download，口令二次确认）。 */
export function usePrivateKeyDownloadMutation() {
  return useMutation({
    mutationFn: (data: KeyPrivateDownloadReq) => downloadPrivateKey(data),
  });
}

/** 密钥重置（POST /instance/key/reset）→ 失效实例密钥视图缓存。 */
export function useResetInstanceKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: KeyResetReq) => resetInstanceKey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: instanceKeyKeys.all });
    },
  });
}
