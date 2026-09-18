import {
  DEFAULT_ACTIVE_STATUS_CODE,
  DEFAULT_INACTIVE_STATUS_CODE,
  normalizeCurrencyCode,
  normalizeTextValue,
  resolveStatusCode,
  resolveStatusCodes,
} from './chart-of-accounts.constants';

describe('normalizeCurrencyCode', () => {
  it('uppercases valid codes', () => {
    expect(normalizeCurrencyCode('eur')).toBe('EUR');
    expect(normalizeCurrencyCode('us-dc')).toBe('US-DC');
  });

  it('rejects codes that violate the 2-12 char alnum/-/_ pattern', () => {
    expect(normalizeCurrencyCode('a')).toBeUndefined(); // too short
    expect(normalizeCurrencyCode('thisistoolong')).toBeUndefined(); // > 12
    expect(normalizeCurrencyCode('in valid')).toBeUndefined(); // space
    expect(normalizeCurrencyCode('!!!')).toBeUndefined();
  });

  it('returns undefined for empty / non-string input (drives the fallback path)', () => {
    expect(normalizeCurrencyCode('')).toBeUndefined();
    expect(normalizeCurrencyCode('   ')).toBeUndefined();
    expect(normalizeCurrencyCode(undefined)).toBeUndefined();
    expect(normalizeCurrencyCode(123)).toBeUndefined();
  });
});

describe('normalizeTextValue', () => {
  it('trims and returns non-empty text', () => {
    expect(normalizeTextValue('  abc ')).toBe('abc');
  });

  it('returns undefined for empty / whitespace so no empty filter is submitted', () => {
    expect(normalizeTextValue('   ')).toBeUndefined();
    expect(normalizeTextValue('')).toBeUndefined();
    expect(normalizeTextValue(undefined)).toBeUndefined();
  });
});

describe('resolveStatusCode', () => {
  it('maps active/inactive to the provided active/inactive codes', () => {
    expect(resolveStatusCode('active', 20, 30)).toBe(20);
    expect(resolveStatusCode('inactive', 20, 30)).toBe(30);
  });

  it('adapts to a 1/0 environment (codes are caller-supplied, never hardcoded)', () => {
    expect(resolveStatusCode('active', 1, 0)).toBe(1);
    expect(resolveStatusCode('inactive', 1, 0)).toBe(0);
  });

  it('returns undefined when no status filter is chosen', () => {
    expect(resolveStatusCode('', 20, 30)).toBeUndefined();
    expect(resolveStatusCode(undefined, 20, 30)).toBeUndefined();
  });
});

describe('resolveStatusCodes', () => {
  it('detects a 20/30 environment from returned rows', () => {
    expect(
      resolveStatusCodes([{ status: 20 }, { status: 30 }])
    ).toEqual({ active: 20, inactive: 30 });
  });

  it('detects a 1/0 environment from returned rows', () => {
    expect(resolveStatusCodes([{ status: 1 }, { status: 0 }])).toEqual({
      active: 1,
      inactive: 0,
    });
  });

  it('prefers 20/30 when both systems appear in the data', () => {
    expect(resolveStatusCodes([{ status: 20 }, { status: 1 }])).toEqual({
      active: 20,
      inactive: DEFAULT_INACTIVE_STATUS_CODE,
    });
  });

  it('falls back to defaults when there is no data', () => {
    expect(resolveStatusCodes([])).toEqual({
      active: DEFAULT_ACTIVE_STATUS_CODE,
      inactive: DEFAULT_INACTIVE_STATUS_CODE,
    });
  });

  it('ignores undefined / null status values', () => {
    expect(
      resolveStatusCodes([{ status: undefined }, { status: null }])
    ).toEqual({
      active: DEFAULT_ACTIVE_STATUS_CODE,
      inactive: DEFAULT_INACTIVE_STATUS_CODE,
    });
  });
});
