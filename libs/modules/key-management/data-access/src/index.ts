/**
 * Key-Management data-access barrel.
 *
 * Re-exports all public APIs for key-signed-transactions.
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
