import { buildEodStatementRows, formatMoneyWithCurrency, getUtc8DayTimestampRange } from './chart-of-accounts-eod.utils';
import { buildTrialBalanceActivityRows } from './chart-of-accounts-trial-balance.utils';

describe('Chart of Accounts amount and date mapping', () => {
  it('rounds large signed decimal strings without passing through a number', () => {
    expect(formatMoneyWithCurrency('9007199254740993.005', 'USD')).toBe('9,007,199,254,740,993.01 USD');
    expect(formatMoneyWithCurrency('-0.125', 'USD')).toBe('-0.13 USD');
  });

  it('retains a cent of variance on large EOD balances', () => {
    const [row] = buildEodStatementRows({ rows: [{
      postingDate: '2026-10-23', totalAssets: '9007199254740993.01',
      totalLiabilities: '9007199254740993.00', currencyCode: 'USD',
    }] });
    expect(row.variance).toBe('0.01 USD');
  });

  it('uses precise debit/credit arithmetic for fallback running balances', () => {
    const rows = buildTrialBalanceActivityRows([
      { direction: 1, amount: '9007199254740993.01' },
      { direction: 2, amount: '9007199254740993.00' },
    ], { currencyCode: 'USD' });
    expect(rows[1].runningBalance).toBe('0.01 USD');
  });

  it('includes the complete selected calendar days in UTC+8', () => {
    expect(getUtc8DayTimestampRange('2026-10-20', '2026-10-21')).toEqual({
      startDate: Date.parse('2026-10-19T16:00:00.000Z'),
      endDate: Date.parse('2026-10-21T15:59:59.999Z'),
    });
    expect(getUtc8DayTimestampRange('2026-10-21', '2026-10-20')).toBeUndefined();
  });
});
