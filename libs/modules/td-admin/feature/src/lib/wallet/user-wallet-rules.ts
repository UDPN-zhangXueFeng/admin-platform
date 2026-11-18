import type { UserWallet } from '@myorg/modules/td-admin/data-access';
import { parseISO } from 'date-fns';
import { formatAdminDate, formatAdminTimestamp } from '../format-admin-time';
import { ALL_VALUE, EMPTY_DISPLAY } from './wallet.constants';
import { toMillis } from './wallet.helpers';

export const USER_WALLET_PERMISSIONS = {
  detail: 'ccf222ca2d1f4cefada9f9a2787eee91',
  history: '8f66cf8a9c8d48dd86d03c15d4db1ece',
  changeWalletType: 'ebc3310a711f4113b03e86a62444c5c5',
  freezeWallet: '8f06e26c48f543a786be79f5f0843bc0',
  unfreezeWallet: 'bd04109044714ba7b289881f69a7664e',
  freezeFunds: 'ca15ffb61ba3455ab80dfdb96b7517eb',
  unfreezeFunds: '301d308f705248cb9fe6b53f56d08f14',
  operationDetail: '9e022c4075dd43ab8173c8a01ed4e99c',
} as const;

export type UserWalletAction = 'changeWalletType' | 'freezeWallet' | 'unfreezeWallet' | 'freezeFunds' | 'unfreezeFunds';

export const walletActionRules: Record<UserWalletAction, (row: UserWallet) => boolean> = {
  changeWalletType: (row) => row.state === 1 && row.walletTypeChangeRecordId === null && row.tdState !== 2,
  freezeWallet: (row) => row.walletState === 1 && row.tdState !== 2,
  unfreezeWallet: (row) => row.walletState === 3 && row.tdState !== 2,
  freezeFunds: (row) => row.state !== 3 && row.walletState !== 0 && row.stablecoinFreezeRecordId === null && row.tdState !== 2,
  unfreezeFunds: (row) => /^(?=.*[1-9])\d+(?:\.\d+)?$/.test(String(row.freezeCount ?? '')) && row.stablecoinUnfreezeRecordId === null && row.tdState !== 2,
};

export function amountWithSymbol(value?: string | number | null, symbol?: string, fixed = true) {
  if (value == null || value === '') return EMPTY_DISPLAY;
  if (!fixed) return [value, symbol].filter((part) => part != null && part !== '').join(' ');
  // String input preserves BigDecimal precision; Intl handles grouping and rounding.
  const decimal = String(value);
  if (!/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(decimal)) return EMPTY_DISPLAY;
  const formatted = amountFormatter.format(decimal as `${number}`);
  return symbol ? `${formatted} ${symbol}` : formatted;
}

const amountFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function walletLimit(value?: string | number, symbol?: string) {
  const integer = /^0*(\d+)(?:\.|$)/.exec(String(value))?.[1];
  if (integer && (integer.length > 12 || integer === '999999999999')) return symbol ? `∞ ${symbol}` : '∞';
  return amountWithSymbol(value, symbol);
}

export function walletTime(value?: number | string | null, dateOnly = false) {
  if (!value) return EMPTY_DISPLAY;
  const numeric = Number(value);
  const time = Number.isFinite(numeric) ? toMillis(numeric) : Date.parse(String(value));
  return dateOnly ? formatAdminDate(time) : formatAdminTimestamp(time);
}

export function dayBoundary(value: string, end = false) {
  if (!value) return undefined;
  const date = parseISO(value);
  const time = end ? date.setHours(23, 59, 59, 0) : date.setHours(0, 0, 0, 0);
  return Number.isFinite(time) ? time : undefined;
}

export function walletFilterNumber(value: string) {
  if (!value || value === ALL_VALUE) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
