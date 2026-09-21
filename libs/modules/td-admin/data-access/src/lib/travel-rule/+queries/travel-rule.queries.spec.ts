import { matchesFilters } from './travel-rule.queries';
import type { TravelRuleItem, TravelRuleQueryParams } from '../travel-rule.model';

const pendingItem: TravelRuleItem = {
  id: '1',
  transactionHash: '0xabc123',
  tokenName: 'HSBCoin',
  tokenType: 'Stablecoin',
  sendingSP: 'SP001',
  senderWallet: '0x111',
  receivingSP: 'SP002',
  receiverWallet: '0x222',
  blockchain: 'Ethereum',
  transactionType: 'Transfer',
  transactionAmount: '10.00 HSC',
  transactionTime: 1000,
  travelRuleHash: '0xdef456',
  confirmationTime: null,
  verificationStatus: 'Pending',
};

const verifiedItem: TravelRuleItem = {
  ...pendingItem,
  id: '2',
  transactionHash: '0xxyz999',
  transactionType: 'Authorized Transfer',
  transactionTime: 2000,
  confirmationTime: 2000,
  verificationStatus: 'Verified',
};

describe('matchesFilters', () => {
  it('accepts every record when no filters are set', () => {
    const empty: TravelRuleQueryParams = {};
    expect(matchesFilters(pendingItem, empty)).toBe(true);
    expect(matchesFilters(verifiedItem, empty)).toBe(true);
  });

  it('filters by verificationStatus with an exact match', () => {
    expect(matchesFilters(pendingItem, { verificationStatus: 'Pending' })).toBe(true);
    expect(matchesFilters(verifiedItem, { verificationStatus: 'Pending' })).toBe(false);
  });

  it('filters by transactionType with an exact match', () => {
    expect(matchesFilters(verifiedItem, { transactionType: 'Authorized Transfer' })).toBe(true);
    expect(matchesFilters(pendingItem, { transactionType: 'Authorized Transfer' })).toBe(false);
  });

  it('matches text fields case-insensitively by substring', () => {
    expect(matchesFilters(verifiedItem, { transactionHash: 'XYZ' })).toBe(true);
    expect(matchesFilters(pendingItem, { transactionHash: 'xyz' })).toBe(false);
  });

  it('treats an empty-string text filter as "no filter"', () => {
    expect(matchesFilters(pendingItem, { transactionHash: '' })).toBe(true);
  });

  it('excludes records outside the transactionTime range (inclusive bounds)', () => {
    expect(matchesFilters(pendingItem, { transactionTime: [500, 1500] })).toBe(true);
    expect(matchesFilters(verifiedItem, { transactionTime: [500, 1500] })).toBe(false);
  });

  it('excludes records with null confirmationTime when a confirmationTime range is set', () => {
    expect(matchesFilters(pendingItem, { confirmationTime: [1000, 3000] })).toBe(false);
    expect(matchesFilters(verifiedItem, { confirmationTime: [1000, 3000] })).toBe(true);
  });
});
