'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { AuthValidationMessages } from '@myorg/modules/td-admin/data-access';

/**
 * Translated copy for every auth form validation rule.
 *
 * The admin app is bilingual, so zod messages must come from next-intl rather
 * than from hardcoded English strings. One hook keeps the three auth forms
 * (password / 2FA / change password) on the same message set.
 */
export function useAuthValidationMessages(): AuthValidationMessages {
  const t = useTranslations('auth');

  return React.useMemo<AuthValidationMessages>(
    () => ({
      usernameRequired: t('usernameRequired'),
      passwordRequired: t('passwordRequired'),
      captchaRequired: t('captchaRequired'),
      twoFactorRequired: t('twoFactorRequired'),
      twoFactorInvalid: t('twoFactorInvalid'),
      oldPasswordRequired: t('oldPasswordRequired'),
      newPasswordRequired: t('newPasswordRequired'),
      confirmPasswordRequired: t('confirmPasswordRequired'),
      passwordMismatch: t('passwordMismatch'),
      passwordPolicyLength: t('passwordPolicyLength'),
      passwordPolicyMixedCase: t('passwordPolicyMixedCase'),
      passwordPolicyDigit: t('passwordPolicyDigit'),
      passwordPolicySymbol: t('passwordPolicySymbol'),
    }),
    [t]
  );
}
