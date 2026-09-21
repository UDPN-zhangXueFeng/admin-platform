import {
  parsePrivateKeyCustodyModel,
  parseTransactionPolicy,
  formatTokenKycRequiredLabel,
  serializePrivateKeyCustodyModel,
  serializeTransactionPolicy,
} from './formatters';

describe('sp-access formatters', () => {
  it('parses transactionPolicy into a stable token list because edit hydration must preserve backend state', () => {
    expect(parseTransactionPolicy('2,1')).toEqual(['2', '1']);
  });

  it('serializes transactionPolicy into a sorted comma string because submit payload must round-trip consistently', () => {
    expect(serializeTransactionPolicy(['2', '1', '1'])).toBe('1,1,2');
  });

  it('parses privateKeyCustodyModel into selected options because edit mode relies on backend values', () => {
    expect(parsePrivateKeyCustodyModel('2,1')).toEqual(['2', '1']);
  });

  it('serializes privateKeyCustodyModel into a sorted comma string because persisted configuration must be deterministic', () => {
    expect(serializePrivateKeyCustodyModel(['3', '2'])).toBe('2,3');
  });

  it('returns empty arrays for missing backend values because create mode starts without preselected permissions', () => {
    expect(parseTransactionPolicy(undefined)).toEqual([]);
    expect(parsePrivateKeyCustodyModel(undefined)).toEqual([]);
  });

  it('formats token KYC values with t_edit semantics because token permission detail uses 1 as No and 2 as Yes', () => {
    expect(formatTokenKycRequiredLabel(1)).toBe('No');
    expect(formatTokenKycRequiredLabel(2)).toBe('Yes');
    expect(formatTokenKycRequiredLabel(0)).toBe('No');
  });
});
