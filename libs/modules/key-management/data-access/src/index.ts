/**
 * Key-Management data-access barrel.
 *
 * Re-exports all public APIs for key-signed-transactions and managed-wallets.
 */

export {
  type KeySignedTransaction,
  type KeySignedTransactionDetail,
  type KeyServicePlatform,
  type StablecoinOption,
  type BlockchainOption,
  type KeySignedTransactionListFilters,
  type KeySignedTransactionListParams,
  type KeySignedTransactionListResponse,
  type KeyServiceConfiguration,
  type KeyServiceConfigurationFilters,
  type KeyServiceConfigurationListParams,
  type KeyServiceConfigurationListResponse,
} from './lib/key-signed-transactions/key-signed-transactions.model';

export {
  getKeySignedTransactions,
  getKeySignedTransactionDetail,
  getKeyServicePlatforms,
  getStablecoinOptions,
  getBlockchainOptions,
  getKeyServiceConfigurations,
} from './lib/key-signed-transactions/key-signed-transactions.api';

export { keySignedTransactionKeys } from './lib/key-signed-transactions/key-signed-transactions.keys';

export {
  useKeySignedTransactionsQuery,
  useKeySignedTransactionDetailQuery,
  useKeyServicePlatformsQuery,
  useStablecoinOptionsQuery,
  useBlockchainOptionsQuery,
  useKeyServiceConfigurationsQuery,
} from './lib/key-signed-transactions/key-signed-transactions.queries';

// Managed Wallets
export {
  type ManagedWallet,
  type ManagedWalletListFilters,
  type ManagedWalletListParams,
  type ManagedWalletListPage,
  type ManagedWalletListResponse,
  type ManagedWalletDetailReq,
  type ManagedWalletDetail,
  type WalletRotationHistory,
  type WalletRotationHistoryFilters,
  type WalletRotationHistoryParams,
  type WalletRotationHistoryPage,
  type WalletRotationHistoryResponse,
} from './lib/managed-wallets/managed-wallets.model';

export {
  getManagedWallets,
  getManagedWalletDetail,
  getManagedWalletRotationHistory,
} from './lib/managed-wallets/managed-wallets.api';

export { managedWalletKeys } from './lib/managed-wallets/managed-wallets.keys';

export {
  useManagedWalletsQuery,
  useManagedWalletDetailQuery,
  useManagedWalletRotationHistoryQuery,
} from './lib/managed-wallets/managed-wallets.queries';

// User Wallets
export {
  type UserWalletItem,
  type UserWalletListResponse,
} from './lib/user-wallets/user-wallets.model';

export { getUserWallets } from './lib/user-wallets/user-wallets.api';

export { userWalletKeys } from './lib/user-wallets/user-wallets.keys';

export { useUserWalletsQuery } from './lib/user-wallets/user-wallets.queries';

// Key Policy Configuration (pure mock — types + mock data only, no API/hooks)
export {
  type PolicyListItem,
  type PolicyEditItem,
  type PolicyDetail,
  type OperationRecord,
  type PolicyFormValues,
} from './lib/key-policy-configuration/key-policy-configuration.model';

export {
  policyList,
  policyEditList,
  policyDetail,
  operationRecords,
} from './lib/key-policy-configuration/key-policy-configuration.mock-data';
