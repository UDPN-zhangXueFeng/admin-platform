'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import { authKeys } from './auth.keys';
import { authChangePwd, authLogin, authLogout, getBrand, updateBrand } from './auth.api';
import {
  DEFAULT_BRAND,
  type Brand,
  type ChangePwdReq,
  type LoginReq,
  type LoginRespVO,
} from './auth.model';
import { markFirstLoginDone, saveGatewaySession } from './auth.session';

/** 登录（POST /login）——成功副作用：saveGatewaySession 双写 localStorage+cookie。 */
export function useAuthLoginMutation() {
  return useMutation({
    mutationFn: (data: LoginReq) => authLogin(data),
    onSuccess: (resp: LoginRespVO) => {
      // 源 store.login：token + userInfo 全量落 localStorage；目标额外写
      // middleware 读取的 cookie（auth.session.ts）。
      saveGatewaySession(resp);
    },
  });
}

/** 登出（POST /logout）——本地会话清理由调用方 finally 保证（源 store.logout）。 */
export function useAuthLogoutMutation() {
  return useMutation({
    mutationFn: () => authLogout(),
  });
}

/**
 * 自助修改密码（POST /change-pwd）——成功副作用：本地 firstLogin 置 1
 * （源 store.changePwd 成功后 `userInfo.firstLogin = 1` 回写）。
 */
export function useAuthChangePwdMutation() {
  return useMutation({
    mutationFn: (data: ChangePwdReq) => authChangePwd(data),
    onSuccess: () => {
      markFirstLoginDone();
    },
  });
}

/**
 * 品牌信息（公开端点 GET /bankgw/brand，登录前即需）。失败回退默认值，
 * 不进入 error 态（源 getBrand catch → DEFAULT），login 页无需感知错误分支。
 */
export function useBrandQuery(projectId: string) {
  const query = useQuery({
    queryKey: authKeys.brand(projectId),
    queryFn: getBrand,
    staleTime: Infinity,
    retry: false,
  });

  return { ...query, brand: query.data ?? DEFAULT_BRAND };
}

/**
 * 品牌保存（源 system/ui.vue onSave，PUT /brand）。成功副作用由调用方处理
 * （invalidate brand query → BrandProvider 重应用），保持本层薄。
 */
export function useUpdateBrandMutation() {
  return useMutation({
    mutationFn: (data: Brand) => updateBrand(data),
  });
}

/**
 * 品牌恢复默认（源 system/ui.vue onReset，PUT DEFAULT）——与保存同通道，
 * 仅载荷固定为 DEFAULT_BRAND（源 onReset 调 updateBrand(DEFAULT)）。
 */
export function useResetBrandMutation() {
  return useMutation({
    mutationFn: () => updateBrand(DEFAULT_BRAND),
  });
}
