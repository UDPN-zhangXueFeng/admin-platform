'use client';

import * as React from 'react';
import {
  getCaptcha,
  useAuthUIStore,
} from '@myorg/modules/td-admin/data-access/lib/auth';

/** Result of a captcha refresh — carries the headers the backend sent along. */
export interface CaptchaRefreshResult {
  /** `randomstr` header — must be echoed back on the login request. */
  randomstr: string;
  /** `captchacode` header — only populated by the dev backend. */
  captchaCode: string;
}

/**
 * Shared captcha source for the login page.
 *
 * The captcha image and the `randomstr` nonce must always come from the same
 * response, otherwise the backend rejects the login as a captcha mismatch.
 * Keeping both in the auth UI store guarantees they are written together.
 *
 * @example
 * const { captchaUrl, randomstr, refreshCaptcha } = useCaptcha();
 */
export function useCaptcha() {
  const { captchaUrl, randomstr, setCaptcha } = useAuthUIStore();
  const createdUrlRef = React.useRef<string | null>(null);

  const refreshCaptcha = React.useCallback(async (): Promise<CaptchaRefreshResult> => {
    const response = await getCaptcha();
    const url = URL.createObjectURL(response.data);
    const nextRandomstr = response.headers['randomstr'] ?? '';
    const captchaCode = response.headers['captchacode'];

    createdUrlRef.current = url;
    setCaptcha(url, nextRandomstr);

    return {
      randomstr: nextRandomstr,
      captchaCode: typeof captchaCode === 'string' ? captchaCode : '',
    };
  }, [setCaptcha]);

  // Release the object URL of the image that is still mounted when the page unmounts.
  React.useEffect(() => {
    return () => {
      if (createdUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(createdUrlRef.current);
        createdUrlRef.current = null;
      }
    };
  }, []);

  return { captchaUrl, randomstr, refreshCaptcha };
}
