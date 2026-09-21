/*
 * @Author: UDPN-zhangXueFeng 84691916+UDPN-zhangXueFeng@users.noreply.github.com
 * @Date: 2026-06-11 15:42:53
 * @LastEditors: UDPN-zhangXueFeng 84691916+UDPN-zhangXueFeng@users.noreply.github.com
 * @LastEditTime: 2026-06-12 16:44:09
 * @FilePath: /admin-platform/libs/modules/auth/util/src/lib/validation.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { z } from 'zod';

/**
 * Form validation schemas for the auth module.
 *
 * Uses Zod for type-safe validation, integrated with react-hook-form
 * via @hookform/resolvers/zod.
 */

/** Password login form */
export const loginSchema = z.object({
  loginName: z.string().min(1, 'Username is required'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(20, 'Password must be at most 20 characters'),
  code: z.string().min(1, 'Captcha is required'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

/** Two-factor authentication form */
export const twoFactorSchema = z.object({
  code: z
    .string()
    .min(6, '2FA code must be 6 digits')
    .max(6, '2FA code must be 6 digits')
    .regex(/^\d{6}$/, '2FA code must be numeric'),
});

export type TwoFactorFormValues = z.infer<typeof twoFactorSchema>;

/** MetaMask login form (only needs a username) */
export const metaMaskSchema = z.object({
  loginName: z.string().min(1, 'Username is required'),
});

export type MetaMaskFormValues = z.infer<typeof metaMaskSchema>;
