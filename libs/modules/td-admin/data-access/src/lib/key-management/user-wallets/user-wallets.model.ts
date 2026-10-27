/**
 * User Wallets domain types.
 *
 * Strictly decoupled from UI and networking concerns.
 * Covers the list endpoint (GET, unpaginated server response, frontend pagination).
 */

/**
 * A single row in the user-wallets list.
 *
 * Field names below are the ACTUAL wire keys returned by
 * GET /api/manage/v1/wallets/user/list (verified against a live code=0
 * response with 723 rows), not the keys the upstream page renders:
 *
 * | upstream column          | upstream key           | actual wire key |
 * |--------------------------|------------------------|-----------------|
 * | Wallet Address           | walletAddress          | walletAddress   |
 * | Service Provider Name    | serviceProviderName    | spName          |
 * | Token Name               | tokenName              | tdName          |
 * | Token Type               | tokenType              | tokenType       |
 * | Key Service Name         | keyServiceName         | — (absent)      |
 * | Blockchain               | blockchainName         | blockchainName  |
 * | KYC Required             | kycRequired            | kycRequired     |
 * | Created on               | createdOn              | createTime      |
 * | Status                   | status                 | state           |
 *
 * `keyServiceName` has no wire counterpart — the upstream page permanently
 * renders `--` for it. Treat as a backend gap; do not fabricate a filter or
 * column for it.
 */
export interface UserWalletItem {
  walletId?: number;
  walletAddress?: string;
  /** Service provider name (upstream UI key was `serviceProviderName`). */
  spName?: string;
  /** Token name (upstream UI key was `tokenName`). */
  tdName?: string;
  symbol?: string;
  tokenType?: number;
  kycRequired?: number;
  custodyModel?: number;
  blockchainId?: number;
  blockchainName?: string;
  /** Overall row status (upstream UI key was `status`). */
  state?: number;
  /** Creation timestamp ms (upstream UI key was `createdOn`). */
  createTime?: number;
}

/** GET /wallets/user/list response — `list` (not `rows`), no `page` object; frontend pagination. */
export interface UserWalletListResponse {
  list: UserWalletItem[];
  total: number;
}
