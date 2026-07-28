import { useQuery } from '@tanstack/react-query';import { fetchAccessKey, fetchMetaMaskHistory, fetchUserInfo, fetchTwoFactorStatus, fetchQrCode } from '../account-manage.api';
export const useAccessKey = (key?: string) => useQuery({ queryKey: ['account-manage', 'accessKey', key], queryFn: () => fetchAccessKey(key) });
export const useUserInfo = () => useQuery({ queryKey: ['account-manage', 'userInfo'], queryFn: fetchUserInfo });
export const useMetaMaskHistory = () => useQuery({ queryKey: ['account-manage', 'mmHistory'], queryFn: fetchMetaMaskHistory });
export const useTwoFactorStatus = () => useQuery({ queryKey: ['account-manage', '2fa'], queryFn: fetchTwoFactorStatus });
export const useQrCode = () => useQuery({ queryKey: ['account-manage', 'qrCode'], queryFn: fetchQrCode, enabled: true });
