import { fmtAmount } from './kit';
import { formatRate, formatTokenAmount } from './proto-format';

describe('amount display precision', () => {
  it('groups ordinary amounts and always renders exactly two decimals', () => {
    expect(fmtAmount(1234)).toBe('1,234.00');
    expect(fmtAmount(1234.5)).toBe('1,234.50');
    expect(fmtAmount(1234.567)).toBe('1,234.57');
  });

  it('keeps FX rates and token amounts on their domain precision', () => {
    expect(formatRate(1.2)).toBe('1.2000');
    expect(formatTokenAmount(1.234567)).toBe('1.234567');
  });

  it('renders missing ordinary amounts as a dash', () => {
    expect(fmtAmount(null)).toBe('-');
    expect(fmtAmount(undefined)).toBe('-');
  });
});
