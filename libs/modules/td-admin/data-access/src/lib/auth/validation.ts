/*
 * Form validation schemas for the td-admin auth module.
 *
 * Zod is integrated with react-hook-form via @hookform/resolvers/zod.
 *
 * All schemas are created through factory functions that take a message bag:
 * the admin app is bilingual (en-US / zh-CN) and validation copy must come
 * from next-intl, not from hardcoded English strings.
 *
 * Rule sources (old td-manage `src/pages/index.tsx`):
 * - login form: `loginName` / `password` / `code` are required only — the old
 *   project imposed no length or character restriction on the login form.
 * - 2FA code: required + numeric (`/^[0-9]*$/`).
 * - change password: old / new / confirm required; the new password must
 *   satisfy the four policy rules shown by the old disabled checkbox group
 *   (`login09`-`login12`); the confirmation must equal the new password.
 */
import { z } from 'zod';

/** Special characters accepted by the password policy (old `change-password/index.tsx:108-113`). */
export const PASSWORD_SPECIAL_CHARACTERS = `~!#@$%^*&()_+{}[]|;:'",<.>/?`;

/** Matches a password that contains at least one special character. */
export const PASSWORD_SPECIAL_CHARACTER_PATTERN = /(?=.*?[~!#@$%^*&()_+{}[\]|;:'",<.>/?]){1,}/;

/** Matches a password that contains both an upper-case and a lower-case letter. */
export const PASSWORD_MIXED_CASE_PATTERN = /(?=.*[A-Z])(?=.*[a-z])/;

/** Matches a password that contains at least one digit. */
export const PASSWORD_DIGIT_PATTERN = /(?=.*[0-9])/;

/** Minimum password length required by the policy (old `login09`). */
export const PASSWORD_MIN_LENGTH = 8;

/** Translated copy used by the auth forms. */
export interface AuthValidationMessages {
  usernameRequired: string;
  passwordRequired: string;
  captchaRequired: string;
  twoFactorRequired: string;
  twoFactorInvalid: string;
  oldPasswordRequired: string;
  newPasswordRequired: string;
  confirmPasswordRequired: string;
  passwordMismatch: string;
  passwordPolicyLength: string;
  passwordPolicyMixedCase: string;
  passwordPolicyDigit: string;
  passwordPolicySymbol: string;
}

/** Password login form values. */
export interface LoginFormValues {
  loginName: string;
  password: string;
  code: string;
}

/** Two-factor authentication form values. */
export interface TwoFactorFormValues {
  code: string;
}

/** MetaMask login form values. */
export interface MetaMaskFormValues {
  loginName: string;
}

/** Change password form values. */
export interface ChangePasswordFormValues {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** Password login form — required fields only (old project had no length rule). */
export function createLoginSchema(messages: AuthValidationMessages) {
  return z.object({
    loginName: z.string().min(1, messages.usernameRequired),
    password: z.string().min(1, messages.passwordRequired),
    code: z.string().min(1, messages.captchaRequired),
  });
}

/**
 * Two-factor authentication form.
 *
 * The old project only required a numeric value; the six-digit length is kept
 * because the backend issues TOTP-style six digit codes and the placeholder
 * copy in both locales says "6-digit code".
 */
export function createTwoFactorSchema(messages: AuthValidationMessages) {
  return z.object({
    code: z
      .string()
      .min(1, messages.twoFactorRequired)
      .regex(/^\d{6}$/, messages.twoFactorInvalid),
  });
}

/** MetaMask login form (only needs a username). */
export function createMetaMaskSchema(messages: AuthValidationMessages) {
  return z.object({
    loginName: z.string().min(1, messages.usernameRequired),
  });
}

/** Change password form — old project `src/pages/change-password/index.tsx`. */
export function createChangePasswordSchema(messages: AuthValidationMessages) {
  return z
    .object({
      oldPassword: z.string().min(1, messages.oldPasswordRequired),
      newPassword: z
        .string()
        .min(1, messages.newPasswordRequired)
        .min(PASSWORD_MIN_LENGTH, messages.passwordPolicyLength)
        .regex(PASSWORD_MIXED_CASE_PATTERN, messages.passwordPolicyMixedCase)
        .regex(PASSWORD_DIGIT_PATTERN, messages.passwordPolicyDigit)
        .regex(PASSWORD_SPECIAL_CHARACTER_PATTERN, messages.passwordPolicySymbol),
      confirmPassword: z.string().min(1, messages.confirmPasswordRequired),
    })
    .refine((values) => values.confirmPassword === values.newPassword, {
      message: messages.passwordMismatch,
      path: ['confirmPassword'],
    });
}

/**
 * Evaluates the four password policy rules so the UI can render the same
 * live checklist the old project showed with a disabled checkbox group.
 */
export function evaluatePasswordPolicy(password: string): {
  length: boolean;
  mixedCase: boolean;
  digit: boolean;
  symbol: boolean;
} {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    mixedCase: PASSWORD_MIXED_CASE_PATTERN.test(password),
    digit: PASSWORD_DIGIT_PATTERN.test(password),
    symbol: PASSWORD_SPECIAL_CHARACTER_PATTERN.test(password),
  };
}
