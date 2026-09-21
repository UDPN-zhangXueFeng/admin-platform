/**
 * Key Policy Configuration mock data.
 *
 * All data is copied verbatim from the original td-manage source files:
 * - policyList: index.tsx staticData (22 items)
 * - policyEditList: edit.tsx staticData (4 items)
 * - policyDetail: detail.tsx keyPolicyData (1 item)
 * - operationRecords: detail.tsx operationRecordsData (5 items)
 *
 * No API endpoints exist for this module — all data is static.
 */

import type {
  PolicyListItem,
  PolicyEditItem,
  PolicyDetail,
  OperationRecord,
} from './key-policy-configuration.model';

/** 22 items from index.tsx staticData (lines 72-305). */
export const policyList: PolicyListItem[] = [
  {
    id: 1,
    businessName: 'Contract Owner',
    description:
      'The owner of the smart contract, responsible for deploying the contract and performing contract upgrades.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'System-initiated',
    createdOn: 1710907481000,
    status: 'Processing',
  },
  {
    id: 2,
    businessName: 'Configuration Admin',
    description:
      'The administrator responsible for configuring the stablecoin token contract, including setting the addresses of its management contract and other associated contracts.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'System-initiated',
    createdOn: 1707534881000,
    status: 'Enabled',
  },
  {
    id: 3,
    businessName: 'Role Admin',
    description:
      'The role administrator, responsible for assigning or revoking all other operational roles within the system.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'System-initiated',
    createdOn: 1707531281000,
    status: 'Disabled',
  },
  {
    id: 4,
    businessName: 'Gas Fee',
    description:
      'The blockchain-native transaction signer responsible for paying gas fees required for all on-chain transactions.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'System-initiated',
    createdOn: 1707527681000,
    status: 'Rejected',
  },
  {
    id: 5,
    businessName: 'Wallet Configurator',
    description: 'Configures wallet types and attributes.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'Manual approval',
    createdOn: 1707524081000,
    status: 'Enabled',
  },
  {
    id: 6,
    businessName: 'SP (Service Provider)',
    description:
      'Authorized account for SP operations, designated during SP registration.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'Manual approval',
    createdOn: 1707520481000,
    status: 'Enabled',
  },
  {
    id: 7,
    businessName: 'Register Controller',
    description:
      'Manages SP and wallet registration, wallet limits, and whitelist.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'Manual approval',
    createdOn: 1707516881000,
    status: 'Enabled',
  },
  {
    id: 8,
    businessName: 'Freeze Controller',
    description: 'Freezes/unfreezes wallets and wallet funds.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'Manual approval',
    createdOn: 1706773481000,
    status: 'Enabled',
  },
  {
    id: 9,
    businessName: 'Account Fees',
    description:
      'Used to collect account management fees for different wallet types.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'Manual approval',
    createdOn: 1706769881000,
    status: 'Enabled',
  },
  {
    id: 10,
    businessName: 'Overdraft Fee',
    description: 'Used to collect overdraft loan fees.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'Manual approval',
    createdOn: 1706766281000,
    status: 'Enabled',
  },
  {
    id: 11,
    businessName: 'Overdraft Interest',
    description: 'Used to collect interest on overdraft loan.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'Manual approval',
    createdOn: 1706762681000,
    status: 'Enabled',
  },
  {
    id: 12,
    businessName: 'Deposit Interest (for payment)',
    description: 'Used to pay deposit interest to customers.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'Manual approval',
    createdOn: 1706759081000,
    status: 'Enabled',
  },
  {
    id: 13,
    businessName: 'Deposit Interest (for receiving)',
    description: 'Used to charge fees on customers deposited funds.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'Manual approval',
    createdOn: 1706755481000,
    status: 'Enabled',
  },
  {
    id: 14,
    businessName: 'Fund Dividend Distribution',
    description: 'Used to distribute fund dividends to customers.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'Manual approval',
    createdOn: 1706842281000,
    status: 'Enabled',
  },
  {
    id: 15,
    businessName: 'Cold Burner',
    description:
      'Handles burn operations exceeding the threshold using cold wallet.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'Manual approval',
    createdOn: 1706838681000,
    status: 'Enabled',
  },
  {
    id: 16,
    businessName: 'Hot Burner',
    description:
      'Handles burn operations within the threshold using hot wallet.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'Manual approval',
    createdOn: 1706835081000,
    status: 'Enabled',
  },
  {
    id: 17,
    businessName: 'Cold Minter',
    description:
      'Handles mint operations exceeding the threshold using cold wallet.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'Manual approval',
    createdOn: 1706831481000,
    status: 'Enabled',
  },
  {
    id: 18,
    businessName: 'Hot Minter',
    description:
      'Handles mint operations within the threshold using hot wallet.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'Manual approval',
    createdOn: 1706827881000,
    status: 'Enabled',
  },
  {
    id: 19,
    businessName: 'Force Transfer',
    description: 'Executes forced token transfers between wallets.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'Manual approval',
    createdOn: 1706824281000,
    status: 'Enabled',
  },
  {
    id: 20,
    businessName: 'Wipe',
    description: 'Clears token balances from specified wallets.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'Manual approval',
    createdOn: 1706820681000,
    status: 'Enabled',
  },
  {
    id: 21,
    businessName: 'Pause Controller',
    description: 'Pauses/unpauses contract operations.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'Manual approval',
    createdOn: 1706817081000,
    status: 'Enabled',
  },
  {
    id: 22,
    businessName: 'Customer Hosted Wallet',
    description:
      'System-managed wallet for end customers, used to receive, store, and manage customer assets.',
    rotationFrequency: '3 months',
    rotationTime: '02:00:00 (UTC+8)',
    rotationMethods: 'Manual approval',
    createdOn: 1706813481000,
    status: 'Enabled',
  },
];

/** 4 items from edit.tsx staticData (lines 157-197). */
export const policyEditList: PolicyEditItem[] = [
  {
    id: 1,
    businessName: 'Contract Owner',
    description:
      'The owner of the smart contract, responsible for deploying the contract and performing contract upgrades.',
    rotationFrequency: '1 day',
    rotationTime: '02:00:00',
    rotationMethods: 'System-initiated',
    status: 'Processing',
  },
  {
    id: 2,
    businessName: 'Configuration Admin',
    description:
      'The administrator responsible for configuring the stablecoin token contract, including setting the addresses of its management contract and other associated contracts.',
    rotationFrequency: '7 days',
    rotationTime: '02:00:00',
    rotationMethods: 'System-initiated',
    status: 'Enabled',
  },
  {
    id: 3,
    businessName: 'Role Admin',
    description:
      'The role administrator, responsible for assigning or revoking all other operational roles within the system.',
    rotationFrequency: '1 month',
    rotationTime: '02:00:00',
    rotationMethods: 'System-initiated',
    status: 'Disabled',
  },
  {
    id: 5,
    businessName: 'Wallet Configurator',
    description: 'Configures wallet types and attributes.',
    rotationFrequency: '1 month',
    rotationTime: '02:00:00',
    rotationMethods: 'Manual approval',
    status: 'Enabled',
  },
];

/** 1 item from detail.tsx keyPolicyData (lines 16-28). */
export const policyDetail: PolicyDetail = {
  businessName: 'Contract Owner',
  status: 'Enabled',
  description:
    'The owner of the smart contract, responsible for deploying the contract and performing contract upgrades.',
  rotationFrequency: '1 day',
  rotationTime: '02:00:00 (UTC+8)',
  rotationMethods: 'System-initiated',
  createdBy: 'yunying',
  createdOn: 'Mar 20, 2024, 11:14:41 (UTC+8)',
  updatedBy: '--',
  updatedOn: '--',
};

/** 5 items from detail.tsx operationRecordsData (lines 31-72). */
export const operationRecords: OperationRecord[] = [
  {
    key: 1,
    operationType: 'Enable',
    createdBy: 'yunying',
    createdOn: 'May 15, 2024, 12:14:41 (UTC+8)',
    comments: 'Enable the Contract Owner Key Rotation Policy.',
    status: 'Pending Approval',
  },
  {
    key: 2,
    operationType: 'Disable',
    createdBy: 'yunying',
    createdOn: 'May 10, 2024, 12:14:41 (UTC+8)',
    comments: 'Disable the Contract Owner Key Rotation Policy.',
    status: 'Rejected',
  },
  {
    key: 3,
    operationType: 'Edit',
    createdBy: 'yunying',
    createdOn: 'May 1, 2024, 12:14:41 (UTC+8)',
    comments: 'N/A',
    status: 'Approved',
  },
  {
    key: 4,
    operationType: 'Resubmit',
    createdBy: 'yunying',
    createdOn: 'May 1, 2024, 12:14:41 (UTC+8)',
    comments: 'N/A',
    status: 'Approved',
  },
  {
    key: 5,
    operationType: 'Add',
    createdBy: 'yunying',
    createdOn: 'May 1, 2024, 12:14:41 (UTC+8)',
    comments: 'N/A',
    status: 'Rejected',
  },
];
