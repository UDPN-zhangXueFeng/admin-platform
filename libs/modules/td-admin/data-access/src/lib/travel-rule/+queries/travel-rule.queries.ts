'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { PaginatedResponse } from '@myorg/shared/model';
import type { TravelRuleItem, TravelRuleQueryParams } from '../travel-rule.model';
import { travelRuleKeys } from './travel-rule.keys';

// ── Mock data (PRD §3/§8: no real API yet) ───────────────────────────
// Two sample records, 1:1 from the source page (td-manage financial/travel-rule).
// To switch to the real backend, replace the `queryFn` body below with:
//   ({ signal }) => getTravelRules(params, { signal })
// — the return shape is identical, so no page changes are needed.
const TRAVEL_RULE_MOCK_DATA: TravelRuleItem[] = [
  {
    id: '1',
    transactionHash: '0xb1c7...d1fa',
    tokenName: 'HSBCoin',
    tokenType: 'Stablecoin',
    sendingSP: 'SP001',
    senderWallet: '0x9721...679',
    receivingSP: 'SP002',
    receiverWallet: '0x34f2...82dd',
    blockchain: 'Ethereum Sepolia',
    transactionType: 'Transfer',
    transactionAmount: '10,000.00 HSC',
    transactionTime: 1709606592000,
    travelRuleHash: '0xa8924...c015',
    confirmationTime: null,
    verificationStatus: 'Pending',
  },
  {
    id: '2',
    transactionHash: '0x879c...db2c',
    tokenName: 'HSBCoin',
    tokenType: 'Tokenized Deposit',
    sendingSP: 'SP001',
    senderWallet: '0x9721...679',
    receivingSP: 'SP002',
    receiverWallet: '0x9e19...5db6',
    blockchain: 'Ethereum Sepolia',
    transactionType: 'Authorized Transfer',
    transactionAmount: '10,000.00 HSC',
    transactionTime: 1709606592000,
    travelRuleHash: '0xd764...a011',
    confirmationTime: 1709606592000,
    verificationStatus: 'Verified',
  },
];

/**
 * Client-side predicate matching the query-form filters.
 *
 * Text fields use case-insensitive substring match; enum fields use exact
 * match; date ranges are inclusive `[from, to]`. A record whose
 * `confirmationTime` is `null` never satisfies a confirmation-time range.
 */
export function matchesFilters(item: TravelRuleItem, params: TravelRuleQueryParams): boolean {
  const includes = (needle: string | undefined, haystack: string) =>
    !needle || haystack.toLowerCase().includes(needle.toLowerCase());

  if (!includes(params.transactionHash, item.transactionHash)) return false;
  if (!includes(params.senderWallet, item.senderWallet)) return false;
  if (!includes(params.receivingSP, item.receivingSP)) return false;
  if (!includes(params.receiverWallet, item.receiverWallet)) return false;
  if (!includes(params.travelRuleHash, item.travelRuleHash)) return false;
  if (!includes(params.tokenName, item.tokenName)) return false;
  if (!includes(params.sendingSP, item.sendingSP)) return false;

  if (params.transactionType && item.transactionType !== params.transactionType) return false;
  if (params.verificationStatus && item.verificationStatus !== params.verificationStatus) return false;

  if (params.transactionTime) {
    const [from, to] = params.transactionTime;
    if (item.transactionTime < from || item.transactionTime > to) return false;
  }

  if (params.confirmationTime) {
    const [from, to] = params.confirmationTime;
    if (item.confirmationTime == null || item.confirmationTime < from || item.confirmationTime > to) {
      return false;
    }
  }

  return true;
}

/**
 * Resolve the mock list as a `PaginatedResponse` so the UI can treat it
 * exactly like a real backend payload (pagination metadata included).
 */
function loadMockTravelRules(params: TravelRuleQueryParams): PaginatedResponse<TravelRuleItem> {
  const filtered = TRAVEL_RULE_MOCK_DATA.filter((item) => matchesFilters(item, params));

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return {
    code: 0,
    data: paged,
    message: 'ok',
    pagination: {
      page,
      pageSize,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    },
  };
}

/**
 * Hook for fetching the (currently mock) travel-rule list.
 *
 * Accepts `projectId` + query params. Uses `keepPreviousData` so the current
 * page stays visible while the next filter result is resolving.
 */
export function useTravelRulesQuery(projectId: string, params: TravelRuleQueryParams) {
  return useQuery({
    queryKey: travelRuleKeys.list(projectId, params),
    queryFn: () => loadMockTravelRules(params),
    placeholderData: keepPreviousData,
  });
}
