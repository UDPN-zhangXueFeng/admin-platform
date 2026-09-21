/**
 * Key-Management constants.
 *
 * Transaction type mappings and signature type mappings
 * extracted from the original td-manage project.
 */

export const transactionTypeOptions = [
  { label: 'Wallet Type Creation', value: 'td_start_wallet_type' },
  { label: 'Wallet Type Activation', value: 'td_enable_wallet_type' },
  { label: 'Wallet Type Deactivation', value: 'td_deactivate_wallet_type' },
  { label: 'Wallet Type Modification', value: 'td_modify_wallet_type' },
  { label: 'Wallet Type Change', value: 'td_change_wallet_type' },
  { label: 'Token Activation', value: 'token_enable' },
  { label: 'Token Modification', value: 'token_edit' },
  { label: 'Wallet Creation', value: 'td_open_wallet' },
  { label: 'Wallet Freezing', value: 'td_freeze_wallet' },
  { label: 'Wallet Unfreezing', value: 'td_unfreeze_wallet' },
  { label: 'Token Minting', value: 'td_mint' },
  { label: 'Token Melting', value: 'td_melt' },
  { label: 'Stablecoin Freezing', value: 'td_stablecoin_freeze' },
  { label: 'Stablecoin Unfreezing', value: 'td_stablecoin_unfreeze' },
  { label: 'Token Pair Registration', value: 'td_token_pair_register' },
  {
    label: 'Target Token Pair Registration',
    value: 'td_target_chain_token_pair_register',
  },
  { label: 'Token Pair Cancellation', value: 'td_token_pair_cancel' },
  {
    label: 'Target Token Pair Cancellation',
    value: 'td_target_chain_token_pair_cancel',
  },
  { label: 'Stablecoin Purchase', value: 'td_buy' },
  { label: 'Tokenized Deposit Purchase', value: 'td_mint_to_user' },
  { label: 'Withdrawal', value: 'td_withdraw' },
  {
    label: 'Liquidity Pool Cross-Chain Activation',
    value: 'td_liquidity_pool_enable_cross_chain',
  },
  {
    label: 'Liquidity Pool Wallet Creation',
    value: 'td_liquidity_pool_open_wallet',
  },
  {
    label: 'Liquidity Pool Authorization',
    value: 'td_liquidity_pool_approve',
  },
  {
    label: 'Liquidity Provider Change',
    value: 'td_liquidity_pool_provider_change',
  },
  {
    label: 'Liquidity Pool Withdrawal',
    value: 'td_liquidity_pool_transfer_out',
  },
  { label: 'Service Provider Onboarding', value: 'td_sp_save' },
  { label: 'Service Provider Modification', value: 'td_sp_edit' },
  { label: 'Interest Disbursement', value: 'td_interest_payment' },
  { label: 'MMF Purchase', value: 'td_mmf_mint_to_user' },
  { label: 'MMF Interest Disbursement', value: 'td_mmf_payment' },
  { label: 'File Attestation', value: 'td_file_evidence' },
  {
    label: 'Management Wallet Modification',
    value: 'td_stablecoin_update_bank_account',
  },
  {
    label: 'Wallet Owner Modification',
    value: 'td_stablecoin_update_wallet_owner',
  },
  {
    label: 'Stablecoin Contract Owner Modification',
    value: 'td_stablecoin_update_stablecoin_owner',
  },
  {
    label: 'Repository Contract Owner Modification',
    value: 'td_stablecoin_update_capital_owner',
  },
  { label: 'Cross-Chain Transfer', value: 'cross_chain_transfer' },
  { label: 'Transfer', value: 'td_transfer' },
  { label: 'Authorization Increase', value: 'td_approve_increase' },
  { label: 'Authorization Decrease', value: 'td_approve_decrease' },
  { label: 'Authorized Transfer', value: 'td_approve_transfer' },
  {
    label: 'Meta-Transaction Withdrawal',
    value: 'meta_transaction_withdrawal',
  },
  {
    label: 'Authorized Meta-Transaction Transfer',
    value: 'meta_transaction_approve_transfer',
  },
  { label: 'Authorized Meta-Transaction', value: 'meta_transaction_approve' },
  { label: 'Transfer Meta-Transaction', value: 'meta_transaction_transfer' },
  {
    label: 'Cross-Chain Meta-Transaction',
    value: 'meta_transaction_cross_chain_transfer',
  },
  { label: 'Meta-Transaction', value: 'meta_transaction' },
  { label: 'Logic Contract Deployment', value: 'contract_deploy_logic' },
  { label: 'Proxy Contract Deployment', value: 'contract_deploy_proxy' },
  { label: 'Contract Relationship Setting', value: 'contract_set_address' },
  {
    label: 'Meta-Transaction Contract Address Setting',
    value: 'contract_set_trustedforwarderaddress',
  },
  {
    label: 'Cross-Chain Contract Address Setting',
    value: 'contract_set_setcrosschaintransfercontract',
  },
  {
    label: 'Token Information Initialization',
    value: 'contract_init_stablecoin',
  },
  { label: 'FX Rate Setting', value: 'contract_set_exchange' },
  { label: 'Management Wallet Setting', value: 'contract_set_bankaddr' },
  { label: 'Operational Account Setting', value: 'contract_set_operator' },
  {
    label: 'Token Registration in Cross-Chain Contract',
    value: 'contract_register_token',
  },
];

/** Reverse lookup: value → label. */
export const transactionTypeLabelMap: Record<string, string> =
  transactionTypeOptions.reduce((acc, option) => {
    acc[option.value] = option.label;
    return acc;
  }, {} as Record<string, string>);

/** Signature type dictionary. */
export const signatureTypeMap: Record<string, string> = {
  '1': 'Standard Transaction',
  '2': 'Meta Transaction - Original Account',
  '3': 'Meta Transaction - Sender',
};

/** Signature type options for Select dropdowns. */
export const signatureTypeOptions = Object.keys(signatureTypeMap).map((key) => ({
  label: signatureTypeMap[key],
  value: key,
}));

// ---------------------------------------------------------------------------
// Managed Wallets
// ---------------------------------------------------------------------------

/** Wallet status map — 3 states shared by list & detail. */
export const walletStatusMap: Record<number, { label: string; tone: string }> = {
  1: { label: 'Active', tone: 'success' },
  2: { label: 'Inactive', tone: 'default' },
  3: { label: 'Pending', tone: 'processing' },
};

/** Rotation status map — 8-state state machine used by the rotation history table. */
export const rotationStatusMap: Record<number, { label: string; tone: string }> = {
  1: { label: 'Pending Generation', tone: 'default' },
  5: { label: 'Pending Review', tone: 'warning' },
  10: { label: 'Reviewing', tone: 'processing' },
  15: { label: 'Review Rejected', tone: 'error' },
  20: { label: 'Pending Execution', tone: 'warning' },
  30: { label: 'Executing', tone: 'processing' },
  35: { label: 'Completed', tone: 'success' },
  40: { label: 'Failed', tone: 'error' },
};

/**
 * Role name map — based on the 3 values actually used by the list & detail pages
 * (the data-contracts 5-value mapping is a dead spec; see managed-wallets.md §8.B).
 */
export const roleNameMap: Record<number, string> = {
  1: 'Contract Owner',
  2: 'Payment of gas fee',
  3: 'Management wallet',
};

// ---------------------------------------------------------------------------
// User Wallets
// ---------------------------------------------------------------------------

/** KYC required map — 0 = No, 1 = Yes. */
export const kycConfig: Record<number, string> = {
  0: 'No',
  1: 'Yes',
};

// ---------------------------------------------------------------------------
// Key Policy Configuration
// ---------------------------------------------------------------------------

/**
 * List page status map (index.tsx:64-69, 4 states).
 * Separate from operationRecordStatusMap — the detail Operation Records
 * table uses a different 3-state machine.
 */
export const keyPolicyStatusMap: Record<string, { label: string; tone: string }> = {
  Processing: { label: 'Processing', tone: 'processing' },
  Rejected: { label: 'Rejected', tone: 'error' },
  Enabled: { label: 'Enabled', tone: 'success' },
  Disabled: { label: 'Disabled', tone: 'default' },
};

/**
 * Detail page Operation Records status map (detail.tsx:137-148, 3 states).
 * Different from keyPolicyStatusMap above.
 */
export const operationRecordStatusMap: Record<string, { label: string; tone: string }> = {
  'Pending Approval': { label: 'Pending Approval', tone: 'warning' },
  Approved: { label: 'Approved', tone: 'success' },
  Rejected: { label: 'Rejected', tone: 'error' },
};

/**
 * 22 business roles — merged from index.businessNameOptions (lines 31-61)
 * and new/edit.businessNameData (new.tsx:29-152 / edit.tsx:31-154).
 * The "All" entry from index is excluded (list filter only).
 * Description comes from new/edit businessNameData.
 */
export const roleNameOptions: { label: string; value: string; description: string }[] = [
  {
    label: 'Contract Owner',
    value: 'Contract Owner',
    description:
      'The owner of the smart contract, responsible for deploying the contract and performing contract upgrades.',
  },
  {
    label: 'Configuration Admin',
    value: 'Configuration Admin',
    description:
      'The administrator responsible for configuring the stablecoin token contract, including setting the addresses of its management contract and other associated contracts.',
  },
  {
    label: 'Role Admin',
    value: 'Role Admin',
    description:
      'The role administrator, responsible for assigning or revoking all other operational roles within the system.',
  },
  {
    label: 'Gas Fee',
    value: 'Gas Fee',
    description:
      'The blockchain-native transaction signer responsible for paying gas fees required for all on-chain transactions.',
  },
  {
    label: 'Wallet Configurator',
    value: 'Wallet Configurator',
    description: 'Configures wallet types and attributes.',
  },
  {
    label: 'SP (Service Provider)',
    value: 'SP (Service Provider)',
    description:
      'Authorized account for SP operations, designated during SP registration.',
  },
  {
    label: 'Register Controller',
    value: 'Register Controller',
    description:
      'Manages SP and wallet registration, wallet limits, and whitelist.',
  },
  {
    label: 'Freeze Controller',
    value: 'Freeze Controller',
    description: 'Freezes/unfreezes wallets and wallet funds.',
  },
  {
    label: 'Account Fees',
    value: 'Account Fees',
    description:
      'Used to collect account management fees for different wallet types.',
  },
  {
    label: 'Overdraft Fee',
    value: 'Overdraft Fee',
    description: 'Used to collect overdraft loan fees.',
  },
  {
    label: 'Overdraft Interest',
    value: 'Overdraft Interest',
    description: 'Used to collect interest on overdraft loan.',
  },
  {
    label: 'Deposit Interest (for payment)',
    value: 'Deposit Interest (for payment)',
    description: 'Used to pay deposit interest to customers.',
  },
  {
    label: 'Deposit Interest (for receiving)',
    value: 'Deposit Interest (for receiving)',
    description: 'Used to charge fees on customers deposited funds.',
  },
  {
    label: 'Fund Dividend Distribution',
    value: 'Fund Dividend Distribution',
    description: 'Used to distribute fund dividends to customers.',
  },
  {
    label: 'Cold Burner',
    value: 'Cold Burner',
    description:
      'Handles burn operations exceeding the threshold using cold wallet.',
  },
  {
    label: 'Hot Burner',
    value: 'Hot Burner',
    description:
      'Handles burn operations within the threshold using hot wallet.',
  },
  {
    label: 'Cold Minter',
    value: 'Cold Minter',
    description:
      'Handles mint operations exceeding the threshold using cold wallet.',
  },
  {
    label: 'Hot Minter',
    value: 'Hot Minter',
    description:
      'Handles mint operations within the threshold using hot wallet.',
  },
  {
    label: 'Force Transfer',
    value: 'Force Transfer',
    description: 'Executes forced token transfers between wallets.',
  },
  {
    label: 'Wipe',
    value: 'Wipe',
    description: 'Clears token balances from specified wallets.',
  },
  {
    label: 'Pause Controller',
    value: 'Pause Controller',
    description: 'Pauses/unpauses contract operations.',
  },
  {
    label: 'Customer Hosted Wallet',
    value: 'Customer Hosted Wallet',
    description:
      'System-managed wallet for end customers, used to receive, store, and manage customer assets.',
  },
];

/** Rotation method options (2 items, kebab-case value). */
export const rotationMethodOptions = [
  { label: 'System-initiated', value: 'system-initiated' },
  { label: 'Manual approval', value: 'manual-approval' },
];

/** Detail page Operation Type filter options (detail.tsx:234-241, 5 items). */
export const operationTypeOptions = [
  { label: 'Enable', value: 'Enable' },
  { label: 'Disable', value: 'Disable' },
  { label: 'Edit', value: 'Edit' },
  { label: 'Resubmit', value: 'Resubmit' },
  { label: 'Add', value: 'Add' },
];
