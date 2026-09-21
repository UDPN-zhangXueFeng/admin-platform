/**
 * User Wallets domain types.
 *
 * Strictly decoupled from UI and networking concerns.
 * Covers the list endpoint (GET, unpaginated server response, frontend pagination).
 */

/** A single row in the user-wallets list. */
export interface UserWalletItem {
  walletAddress?: string;
  serviceProviderName?: string;
  custodyModel?: number;
  blockchainName?: string;
  tokenName?: string;
  tokenType?: number;
  kycRequired?: number;
  createdOn?: number;
  status?: number;
  id?: number;
}

/** GET /wallets/user/list response — `list` (not `rows`), no `page` object; frontend pagination. */
export interface UserWalletListResponse {
  list: UserWalletItem[];
  total: number;
}
