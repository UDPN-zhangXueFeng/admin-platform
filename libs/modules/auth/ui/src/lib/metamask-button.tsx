'use client';

import { useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input, Label } from '@myorg/shared/ui';
import { encrypt } from '@myorg/modules/auth/util';
import {
  checkMetaMaskStatus,
  metaMaskLogin,
  useAuthUIStore,
} from '@myorg/modules/auth/data-access';
import { useAuth } from '@myorg/shared/util-auth';

function MetaMaskIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      <path
        fill="#E2761B"
        d="M21 3l-7.4 5.5L15 5.2 21 3ZM3 3l7.3 5.6L9 5.2 3 3Z"
      />
      <path
        fill="#E4761B"
        d="m18.3 16.1-2 3.1 4.3 1.2 1.2-4.2-3.5-.1ZM2.2 16.2l1.2 4.2 4.3-1.2-2-3.1-3.5.1Z"
      />
      <path
        fill="#F6851B"
        d="m7.5 10.9-1.8 2.8 4.2.2-.2-4.5-2.2 1.5Zm9 0-2.3-1.6-.1 4.6 4.2-.2-1.8-2.8Z"
      />
      <path
        fill="#C0AD9E"
        d="m7.7 19.2 2.6-1.3-2.2-1.7-.4 3Zm6-1.3 2.6 1.3-.4-3-2.2 1.7Z"
      />
      <path
        fill="#161616"
        d="m8.1 16.2 2.2 1.7-.3-2.3-1.9.6Zm5.6 1.7 2.2-1.7-1.9-.6-.3 2.3Z"
      />
      <path
        fill="#763D16"
        d="m7.7 19.2 2.3-1.1-.2 1.8v.7l-2.1-1.4Zm8.6 0-2.3-1.1.2 1.8v.7l2.1-1.4Z"
      />
      <path fill="#F6851B" d="m9.9 15.6.3 2.3.4 2.1h2.8l.4-2.1.3-2.3-4.2 0Z" />
    </svg>
  );
}

/**
 * MetaMask wallet login — username input + Connect button.
 *
 * Flow:
 *  1. User types a username → debounced check if MetaMask login is enabled
 *  2. User clicks "Connect MetaMask" → detect provider → request permissions
 *  3. Sign a message (keccak256 of username) → extract R, S, V from signature
 *  4. Send R, S, V + username to backend login endpoint
 */
export function MetaMaskButton() {
  const t = useTranslations('auth');
  const { login } = useAuth();
  const { randomstr } = useAuthUIStore();

  const [loginName, setLoginName] = useState('');
  const [metaMaskAllowed, setMetaMaskAllowed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Debounced check: is MetaMask login enabled for this username? */
  const handleUsernameChange = useCallback((value: string) => {
    setLoginName(value);
    setError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value) {
      setMetaMaskAllowed(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await checkMetaMaskStatus({
          loginName: encrypt(value),
        });
        setMetaMaskAllowed(
          res.data.code === 0 && res.data.data?.result === true,
        );
      } catch {
        setMetaMaskAllowed(false);
      }
    }, 300);
  }, []);

  /** Extract R, S, V from a 65-byte ECDSA signature (132 hex chars with 0x prefix) */
  function convertTxHashToRSV(signature: string): {
    r: string;
    s: string;
    v: string;
  } {
    if (signature.length !== 132 || !signature.startsWith('0x')) {
      return { r: '0', s: '0', v: '0' };
    }
    const hash = signature.slice(2);
    return {
      r: hash.slice(0, 64),
      s: hash.slice(64, 128),
      v: hash.slice(128),
    };
  }

  /** Sign a message using MetaMask and extract RSV */
  async function signWithMetaMask(
    message: string,
  ): Promise<{ r: string; s: string; v: string } | null> {
    const ethereum = (window as any).ethereum as any;
    if (!ethereum) return null;

    // Dynamic import — ethers is large and only needed when the user clicks Connect
    const { ethers } = await import('ethers');
    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();

    try {
      const signature = await signer.signMessage(
        ethers.keccak256(ethers.toUtf8Bytes(message)),
      );
      return convertTxHashToRSV(signature);
    } catch {
      return null;
    }
  }

  const handleConnect = async () => {
    if (!loginName) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Detect MetaMask
      const detectProvider = (await import('@metamask/detect-provider'))
        .default;
      const provider = await detectProvider();

      if (!provider) {
        setError(t('metaMaskNotInstalled'));
        if (typeof window !== 'undefined') {
          window.open('https://metamask.io/download/', '_blank');
        }
        return;
      }

      // 2. Request wallet permissions
      try {
        await (provider as any).request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
      } catch {
        setError(t('metaMaskRejected'));
        return;
      }

      // 3. Sign message
      const rsv = await signWithMetaMask(loginName);
      if (!rsv) {
        setError(t('metaMaskSignFailed'));
        return;
      }

      // 4. Login with RSV — all fields must be encrypted to match backend expectations
      const response = await metaMaskLogin(
        {
          loginName: encrypt(loginName),
          signR: encrypt(rsv.r),
          signS: encrypt(rsv.s),
          signV: encrypt(rsv.v),
        },
        randomstr,
      );

      const { code, data } = response.data;
      if (code !== 0) {
        setError(response.data.message || t('loginFailed'));
        return;
      }

      // 5. Store session
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
        data.token,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t('metaMaskError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        <Label
          htmlFor="metaMaskUsername"
          className="text-sm font-normal uppercase text-slate-700"
        >
          <span className="mr-1 text-red-500" aria-hidden="true">
            *
          </span>
          {t('username')}
        </Label>
        <Input
          id="metaMaskUsername"
          autoComplete="username"
          placeholder={t('usernamePlaceholder')}
          className="h-11 rounded-md border-slate-300 bg-white shadow-sm focus-visible:ring-[#554eea]"
          value={loginName}
          onChange={(e) => handleUsernameChange(e.target.value)}
        />
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full border-slate-300 bg-slate-50 text-slate-600 shadow-sm hover:bg-slate-100"
        disabled={!metaMaskAllowed || loading}
        onClick={handleConnect}
      >
        <MetaMaskIcon />
        {loading ? t('connecting') : t('connectMetaMask')}
      </Button>

      <p className="text-center text-sm text-[#554eea]">{t('metaMaskHint')}</p>

      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
