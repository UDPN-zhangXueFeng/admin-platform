import { parseISO, startOfDay } from 'date-fns';
import type { AuditTrailListFilters } from '@myorg/modules/td-admin/data-access/lib/audit-trail';
import { ALL_VALUE, EMPTY_DISPLAY } from './audit-trail.constants';

export interface AuditTrailFilterForm {
  traceId: string;
  txFrom: string;
  txTo: string;
  txType: string;
  tokenName: string;
  tokenType: string;
  blockchainId: string;
  txTimeFrom: string;
  txTimeTo: string;
  txHash: string;
}

export const EMPTY_FORM: AuditTrailFilterForm = {
  traceId: '',
  txFrom: '',
  txTo: '',
  txType: ALL_VALUE,
  tokenName: ALL_VALUE,
  tokenType: ALL_VALUE,
  blockchainId: ALL_VALUE,
  txTimeFrom: '',
  txTimeTo: '',
  txHash: '',
};

export function toAuditTrailFilters(
  form: AuditTrailFilterForm,
  scope: 'list' | 'export',
): AuditTrailListFilters {
  const { txTimeFrom, txTimeTo } = form;
  const hasRange = !!txTimeFrom && !!txTimeTo;
  const allValue = scope === 'export' ? '' : undefined;
  // The old picker sends local time at whole-second precision.
  const lastDay = hasRange ? parseISO(txTimeTo) : null;
  return {
    traceId: form.traceId || undefined,
    txFrom: form.txFrom || undefined,
    txTo: form.txTo || undefined,
    txType: form.txType === ALL_VALUE ? allValue : Number(form.txType),
    tokenName: form.tokenName === ALL_VALUE ? allValue : form.tokenName,
    tokenType: form.tokenType === ALL_VALUE ? allValue : Number(form.tokenType),
    // The one-off export VO in td-manage does not include blockchainId.
    ...(scope === 'list' && form.blockchainId !== ALL_VALUE ? { blockchainId: form.blockchainId } : {}),
    txStartTime: hasRange ? startOfDay(parseISO(txTimeFrom)).getTime() : '',
    txEndTime: lastDay ? lastDay.setHours(23, 59, 59, 0) : '',
    txHash: form.txHash || undefined,
  };
}

/** Keep all decimal digits; add the old table's grouping and minimum two decimals. */
export function formatAuditAmount(amount?: string | number | null, symbol?: string): string {
  if (amount == null || amount === '') return EMPTY_DISPLAY;
  const text = String(amount);
  const match = /^(-?\d+)(?:\.(\d+))?$/.exec(text);
  const formatted = match
    ? `${match[1].replace(/\B(?=(\d{3})+$)/g, ',')}.${(match[2] ?? '').padEnd(2, '0')}`
    : text;
  return symbol ? `${formatted} ${symbol}` : formatted;
}
