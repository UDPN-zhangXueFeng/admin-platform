'use client';

import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@myorg/shared/util-auth';
import type {
  LoginRespVo,
  LoginFormValues,
  TwoFactorFormValues,
} from '@myorg/modules/auth/util';
import { encrypt } from '@myorg/modules/auth/util';
import { useAuthUIStore } from './auth-ui.store';
import * as authApi from './auth.api';

/**
 * Maps a LoginRespVo to the User shape expected by AuthProvider
 * and delegates to the auth context's `login()`.
 */
function storeSession(data: LoginRespVo, login: ReturnType<typeof useAuth>['login']) {
  const { menuKeyList } = data;
  const permissions = menuKeyList.map((m) => m.menuKey);
  login(
    {
      id: String(data.userId),
      name: data.userName,
      email: data.email,
      roles: [],
      permissions,
      orgName: data.orgName,
      orgType: data.orgType,
      expire: data.expire,
      phoneNumber: data.phoneNumber,
    },
    data.token
  );
}

/** Password + captcha login mutation */
export function useLoginMutation() {
  const { login } = useAuth();

  return useMutation({
    mutationFn: async (values: LoginFormValues & { randomstr: string }) => {
      const encrypted = {
        loginName: encrypt(values.loginName),
        password: encrypt(values.password),
        code: encrypt(values.code),
      };

      const response = await authApi.loginApi(encrypted, values.randomstr);
      const { code, data } = response.data;

      if (code !== 0) {
        throw new Error(response.data.message || 'Login failed');
      }

      return data;
    },
    onSuccess: (data) => {
      // If 2FA is required, don't store session yet — let the UI switch to 2FA form
      if (data.twoFactorAuth) {
        return;
      }
      storeSession(data, login);
    },
  });
}

/** 2FA verification mutation */
export function useTwoFactorMutation() {
  const { login } = useAuth();
  const { setTwoFactorToken, setLoginStep } = useAuthUIStore();

  return useMutation({
    mutationFn: async (params: TwoFactorFormValues & { twoFactorToken: string }) => {
      const response = await authApi.loginTwoFactor({
        code: params.code,
        twoFactorToken: params.twoFactorToken,
      });
      const { code, data } = response.data;

      if (code !== 0) {
        throw new Error(response.data.message || '2FA verification failed');
      }

      return data;
    },
    onSuccess: (data) => {
      setTwoFactorToken(null);
      setLoginStep('password');
      storeSession(data, login);
    },
  });
}
