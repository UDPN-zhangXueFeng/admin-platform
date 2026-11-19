import { formatBlockHeight, formatListAmount, formatPostingAmount, formatTAccountAmount } from './journal-entries-new-format';

describe('journal decimal displays', () => {
  it('groups amounts and block heights without passing them through floating point', () => {
    expect(formatListAmount('9007199254740993.123456789123456789', 'USD'))
      .toBe('9,007,199,254,740,993.123456789123456789 USD');
    expect(formatBlockHeight('9007199254740993')).toBe('9,007,199,254,740,993');
    expect(formatListAmount(null, 'USD')).toBe('--');
  });

  it('pads posting amounts but never rounds token decimals', () => {
    expect(formatPostingAmount('2')).toBe('2.00');
    expect(formatPostingAmount('0.000000000000000001')).toBe('0.000000000000000001');
    expect(formatPostingAmount('unexpected text')).toBe('unexpected text');
  });

  it('keeps nonzero and sub-cent T-account amounts while hiding missing or zero sides', () => {
    expect(formatTAccountAmount('-1200.4')).toBe('-1,200.40');
    expect(formatTAccountAmount('0.000000000000000001')).toBe('0.000000000000000001');
    expect(formatTAccountAmount('-0.000000000000000000')).toBe('');
    expect(formatTAccountAmount(undefined)).toBe('');
  });
});
