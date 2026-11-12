'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMetaMask,
  addTwoFactor,
  disableMetaMask,
  disableTwoFactor,
  editMetaMask,
  fetchAccessKey,
  fetchMetaMaskHistory,
  fetchQrCode,
  fetchTwoFactorStatus,
  fetchUserInfo,
} from '../account-manage.api';
import { accountManageKeys } from './account-manage.keys';

/**
 * Query/mutation hooks for account-manage.
 *
 * Wallet write operations invalidate both `userInfo` (bound address/status)
 * and `metaMaskHistory` — the old page refreshed both after add/edit/disable
 * (`td-manage src/pages/account-manage/index.tsx:76-105,229-247`).
 *
 * Toast/redirect stay in the page layer; hooks only own cache invalidation.
 */

export const useAccessKey = (key = '') =>
  useQuery({
    queryKey: accountManageKeys.accessKey(key),
    queryFn: () => fetchAccessKey(key),
    placeholderData: keepPreviousData,
  });

export const useUserInfo = () =>
  useQuery({
    queryKey: accountManageKeys.userInfo(),
    queryFn: fetchUserInfo,
  });

export const useMetaMaskHistory = () =>
  useQuery({
    queryKey: accountManageKeys.metaMaskHistory(),
    queryFn: fetchMetaMaskHistory,
  });

export const useTwoFactorStatus = () =>
  useQuery({
    queryKey: accountManageKeys.twoFactorStatus(),
    queryFn: fetchTwoFactorStatus,
  });

/**
 * QR code for 2FA registration.
 *
 * Only the enable branch of the register page needs it, so callers pass
 * `enabled` (old page requested it only when `query.type === 1`).
 */
export const useQrCode = (enabled = true) =>
  useQuery({
    queryKey: accountManageKeys.qrCode(),
    queryFn: fetchQrCode,
    enabled,
  });

export function useAddMetaMaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountKey: string) => addMetaMask(accountKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: accountManageKeys.userInfo(),
      });
      void queryClient.invalidateQueries({
        queryKey: accountManageKeys.metaMaskHistory(),
      });
    },
  });
}

export function useEditMetaMaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountKey: string) => editMetaMask(accountKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: accountManageKeys.userInfo(),
      });
      void queryClient.invalidateQueries({
        queryKey: accountManageKeys.metaMaskHistory(),
      });
    },
  });
}

export function useDisableMetaMaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => disableMetaMask(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: accountManageKeys.userInfo(),
      });
      void queryClient.invalidateQueries({
        queryKey: accountManageKeys.metaMaskHistory(),
      });
    },
  });
}

export function useAddTwoFactorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { code: string; password: string }) =>
      addTwoFactor(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: accountManageKeys.twoFactorStatus(),
      });
      void queryClient.invalidateQueries({
        queryKey: accountManageKeys.qrCode(),
      });
    },
  });
}

export function useDisableTwoFactorMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { password: string }) => disableTwoFactor(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: accountManageKeys.twoFactorStatus(),
      });
    },
  });
}
