import { EMPTY_FORM, formatAuditAmount, toAuditTrailFilters } from './audit-trail.filters';

it('keeps the full string amount and formats integer and zero amounts', () => {
  expect(formatAuditAmount('12345678901234567890.01234567890123456789', 'USDF'))
    .toBe('12,345,678,901,234,567,890.01234567890123456789 USDF');
  expect(formatAuditAmount(0, 'USDF')).toBe('0.00 USDF');
  expect(formatAuditAmount('-1234.5')).toBe('-1,234.50');
  expect(formatAuditAmount()).toBe('--');
});

it('preserves read filters and sends a local inclusive whole-second range', () => {
  const txHash = '0x000000000000000000000000000000000000000000000000fedcba9876543210';
  const form = {
    ...EMPTY_FORM,
    txHash,
    txType: '3',
    tokenType: '20',
    blockchainId: '123',
    txTimeFrom: '2026-11-01',
    txTimeTo: '2026-11-02',
  };
  expect(toAuditTrailFilters(form, 'list')).toEqual({
    txHash, txType: 3, tokenType: 20, blockchainId: '123',
    txStartTime: new Date(2026, 10, 1).getTime(),
    txEndTime: new Date(2026, 10, 2, 23, 59, 59).getTime(),
  });
  expect(toAuditTrailFilters(form, 'export')).not.toHaveProperty('blockchainId');
  expect(JSON.parse(JSON.stringify(toAuditTrailFilters(EMPTY_FORM, 'list')))).toEqual({ txStartTime: '', txEndTime: '' });
  expect(toAuditTrailFilters(EMPTY_FORM, 'export')).toMatchObject({ txType: '', tokenType: '', tokenName: '' });
});
