'use client';

/**
 * auth 域 mutation hooks（源 `src/store/user.ts` login/logout/changePwd
 * 的副作用语义落在 onSuccess/onSettled）。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { lpAuthKeys } from './auth.keys';
import { authChangePwd, authLogin, authLogout } from './auth.api';
import type { ChangePwdReq, LoginReq } from './auth.model';
import {
  clearLpSession,
  markFirstLoginDone,
  saveLpSession,
} from './auth.session';

/**
 * 登录（POST /lp/login）——成功副作用：token + LoginRespVO（含 menuTree）
 * 整体持久化（源 store.login：localStorage 双写；目标补写 middleware cookie）。
 */
export function useAuthLoginMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LoginReq) => authLogin(data),
    onSuccess: (resp) => {
      saveLpSession(resp);
      queryClient.invalidateQueries({ queryKey: lpAuthKeys.session(projectId) });
    },
  });
}

/**
 * 登出（POST /lp/logout）——源 store.logout：`try{await logout()}finally{clear()}`，
 * 后端登出失败也清本地，故清会话放 onSettled（成功/失败均执行）。
 */
export function useAuthLogoutMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authLogout(),
    onSettled: () => {
      clearLpSession();
      queryClient.invalidateQueries({ queryKey: lpAuthKeys.session(projectId) });
    },
  });
}

/**
 * 修改密码（POST /lp/change-pwd）——成功副作用：本地 firstLogin 置 1
 * （源 store.changePwd 成功后 `userInfo.firstLogin = 1` 回写，守卫因此放行）。
 *
 * 注：源 profile 页改密不经 store、不动 firstLogin；但守卫保证 profile 页
 * 只在 firstLogin!==0 时可达，故此处统一置 1 无语义偏差。
 */
export function useAuthChangePwdMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ChangePwdReq) => authChangePwd(data),
    onSuccess: () => {
      markFirstLoginDone();
      queryClient.invalidateQueries({ queryKey: lpAuthKeys.session(projectId) });
    },
  });
}
