/**
 * Screening & Monitoring 常量（状态映射/权限码/t_edit 静态数据/ColumnConfig 矩阵）。
 */
import type { ColumnConfig, TEditRiskLevelRow } from '@myorg/modules/screening-monitoring/data-access';

export const ALL_VALUE = 'all';

export const RULE_STATUS_MAP: Record<number, { label: string; color: string }> = {
  1: { label: 'rule_status_1', color: 'processing' },
  10: { label: 'rule_status_10', color: 'success' },
  15: { label: 'rule_status_15', color: 'gray' },
};
export const RULE_STATUS_OPTIONS = [
  { value: ALL_VALUE, label: 'PUB_All' }, { value: '1', label: 'rule_status_1' }, { value: '10', label: 'rule_status_10' }, { value: '15', label: 'rule_status_15' },
];

export const SUSPICIOUS_STATUS_MAP: Record<number, { label: string; color: string }> = {
  1: { label: 'transaction_monitoring_status_1', color: 'orange' },
  2: { label: 'transaction_monitoring_status_2', color: 'processing' },
  3: { label: 'transaction_monitoring_status_3', color: 'success' },
  4: { label: 'transaction_monitoring_status_4', color: 'error' },
  5: { label: 'transaction_monitoring_status_5', color: 'error' },
};
export const SUSPICIOUS_STATUS_OPTIONS = [
  { value: ALL_VALUE, label: 'PUB_All' }, { value: '1', label: 'transaction_monitoring_status_1' }, { value: '2', label: 'transaction_monitoring_status_2' }, { value: '3', label: 'transaction_monitoring_status_3' }, { value: '4', label: 'transaction_monitoring_status_4' }, { value: '5', label: 'transaction_monitoring_status_5' },
];

export const RISK_LEVEL_MAP: Record<number, string> = { 20: 'risk_level_type_20', 30: 'risk_level_type_30', 40: 'risk_level_type_40' };
export const RISK_LEVEL_OPTIONS = [{ value: ALL_VALUE, label: 'PUB_All' }, { value: '20', label: 'risk_level_type_20' }, { value: '30', label: 'risk_level_type_30' }, { value: '40', label: 'risk_level_type_40' }];

export const HANDLE_TYPE_MAP: Record<number, string> = { 1: 'rule_action_1', 2: 'rule_action_2' };
export const RULE_OPERATION_TYPE_MAP: Record<number, string> = { 1: 'rule_operation_type_1', 2: 'rule_operation_type_2', 3: 'rule_operation_type_3', 4: 'rule_operation_type_4' };
export const RULE_OPERATION_OPTIONS = [{ value: ALL_VALUE, label: 'PUB_All' }, { value: '1', label: 'rule_operation_type_1' }, { value: '2', label: 'rule_operation_type_2' }, { value: '3', label: 'rule_operation_type_3' }, { value: '4', label: 'rule_operation_type_4' }];

export const PROCESS_OPTIONS = [{ label: 'transaction_monitoring_type_1', value: 1 }, { label: 'transaction_monitoring_type_2', value: 2 }];
export const PROCESS_REVERSE_OPTIONS = [{ label: 'transaction_monitoring_type_1', value: 2 }, { label: 'transaction_monitoring_type_2', value: 1 }];

export const SCREENING_PERMISSIONS = {
  CREATE_RULE: '34def8895d0a4ca59339d8acca702ff7',
  CREATE_THIRD_PARTY_RULE: '38fbb8b8cc1040da9993311925fd896c',
  VIEW_DETAIL: 'e338a3b41c21413db1d2ac7a90a65f5f',
  EDIT_RULE: '8ba81f3a7f6f4ece8ca17059ae384d94',
  DISABLE_RULE: 'b0f7fd1abc85416ea6dfdcee46333992',
  ENABLE_RULE: '9cfc0cbaa3f640e3aa536ff363ab1ddd',
  VIEW_SUSPICIOUS: '544f82b603d54d43bb6b63699582e08d',
  RETRY_SUSPICIOUS: '4f9a34c2215f4540be4eac03bcd6a8a8',
  PROCESS_SUSPICIOUS: 'b9433acf356b4a28a405513c505232cd',
} as const;

// ── t_edit 静态选项 ──
export const TEDIT_RULE_SOURCE_OPTIONS = [
  { groupLabel: 'Custom Rule', options: [{ label: 'Custom Rule', value: 'custom' }, { label: 'Bank API', value: 'bank_api', disabled: true }] },
  { groupLabel: 'KYA/KYC', options: [{ label: 'Chainalysis', value: 'chainalysis' }, { label: 'Elliptic', value: 'elliptic' }, { label: 'MistTrack', value: 'misttrack' }] },
  { groupLabel: 'AML/CFT', options: [{ label: 'LexisNexis', value: 'lexisnexis', disabled: true }, { label: 'Oracle', value: 'oracle', disabled: true }] },
];
export const TEDIT_SCAN_TIMING_OPTIONS = [{ label: 'Pre Transaction', value: 'pre' }, { label: 'Post Transaction', value: 'post' }];
export const TEDIT_TOKEN_OPTIONS = [{ label: 'ABCCoin', value: 'mmfcoin' }, { label: 'HKDUCoin', value: 'hkducoin' }, { label: 'USDCoin', value: 'usdcoin' }];
export const TEDIT_RISK_LEVEL_OPTIONS = [{ label: 'No Risk', value: 'no_risk' }, { label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' }, { label: 'High', value: 'high' }, { label: 'Severe', value: 'severe' }];
export const TEDIT_TRANSACTION_ACTION_OPTIONS = [{ label: 'Pass', value: 'pass' }, { label: 'Hold', value: 'hold' }, { label: 'Reject', value: 'reject' }];
export const TEDIT_WALLET_ACTION_OPTIONS = [{ label: 'No Action', value: 'no_action' }, { label: 'Flag', value: 'flag' }, { label: 'Freeze', value: 'freeze' }];
export const TEDIT_TRANSACTION_TYPE_OPTIONS = [{ label: '% Increase in Outbound Transaction Amounts Over 24Hours', value: 'outbound_increase' }, { label: '% Increase in Inbound Transaction Amounts Over 24 Hours', value: 'inbound_increase' }, { label: 'Number of Transfers Out', value: 'transfers_out' }, { label: 'Number of Transfers In', value: 'transfers_in' }];
export const TEDIT_MONITORING_FREQ_OPTIONS = [{ label: 'Seconds', value: 'seconds' }, { label: 'Minutes', value: 'minutes' }, { label: 'Hours', value: 'hours' }];

export const TEDIT_COLUMN_CONFIGS: Record<string, Record<string, ColumnConfig>> = {
  custom: {
    pre: { showPercentage: true, percentageAsRange: true, showRiskScore: true, riskScoreAsRange: false, showRiskLevel: true, showTransactionAction: true, showWalletAction: true, maxRiskLevels: 3, allowAdd: true },
    post: { showPercentage: true, percentageAsRange: true, showRiskScore: true, riskScoreAsRange: false, showRiskLevel: true, showTransactionAction: false, showWalletAction: true, maxRiskLevels: 3, allowAdd: true },
  },
  chainalysis: {
    pre: { showPercentage: true, percentageAsRange: false, showRiskScore: false, riskScoreAsRange: false, showRiskLevel: true, showTransactionAction: true, showWalletAction: true, maxRiskLevels: 4, allowAdd: false },
    post: { showPercentage: true, percentageAsRange: false, showRiskScore: false, riskScoreAsRange: false, showRiskLevel: true, showTransactionAction: false, showWalletAction: true, maxRiskLevels: 4, allowAdd: false },
  },
  elliptic: {
    pre: { showPercentage: false, percentageAsRange: false, showRiskScore: true, riskScoreAsRange: true, showRiskLevel: true, showTransactionAction: true, showWalletAction: true, maxRiskLevels: 5, allowAdd: false },
    post: { showPercentage: false, percentageAsRange: false, showRiskScore: true, riskScoreAsRange: true, showRiskLevel: true, showTransactionAction: false, showWalletAction: true, maxRiskLevels: 5, allowAdd: false },
  },
  misttrack: {
    pre: { showPercentage: false, percentageAsRange: false, showRiskScore: true, riskScoreAsRange: true, showRiskLevel: true, showTransactionAction: true, showWalletAction: true, maxRiskLevels: 4, allowAdd: false },
    post: { showPercentage: false, percentageAsRange: false, showRiskScore: true, riskScoreAsRange: true, showRiskLevel: true, showTransactionAction: false, showWalletAction: true, maxRiskLevels: 4, allowAdd: false },
  },
};

type DefaultDataFactory = (source: string, timing: string) => TEditRiskLevelRow[];
export const TEDIT_DEFAULT_DATA: Record<string, Record<string, DefaultDataFactory>> = {
  chainalysis: {
    pre: () => [{ minValue: 0, maxValue: '', riskScore: '', riskLevel: 'low', transactionAction: 'pass', walletAction: 'no_action' }, { minValue: 3, maxValue: '', riskScore: '', riskLevel: 'medium', transactionAction: 'hold', walletAction: 'flag' }, { minValue: 4.5, maxValue: '', riskScore: '', riskLevel: 'high', transactionAction: 'reject', walletAction: 'freeze' }, { minValue: 25, maxValue: '', riskScore: '', riskLevel: 'severe', transactionAction: 'reject', walletAction: 'freeze' }],
    post: () => [{ minValue: 0, maxValue: '', riskScore: '', riskLevel: 'low', transactionAction: '', walletAction: 'no_action' }, { minValue: 3, maxValue: '', riskScore: '', riskLevel: 'medium', transactionAction: '', walletAction: 'flag' }, { minValue: 4.5, maxValue: '', riskScore: '', riskLevel: 'high', transactionAction: '', walletAction: 'flag' }, { minValue: 25, maxValue: '', riskScore: '', riskLevel: 'severe', transactionAction: '', walletAction: 'freeze' }],
  },
  elliptic: {
    pre: () => [{ minValue: '', maxValue: '', minRiskScore: 0, maxRiskScore: 20, riskLevel: 'no_risk', transactionAction: 'pass', walletAction: 'no_action' }, { minValue: '', maxValue: '', minRiskScore: 20, maxRiskScore: 40, riskLevel: 'low', transactionAction: 'pass', walletAction: 'no_action' }, { minValue: '', maxValue: '', minRiskScore: 40, maxRiskScore: 60, riskLevel: 'medium', transactionAction: 'hold', walletAction: 'flag' }, { minValue: '', maxValue: '', minRiskScore: 60, maxRiskScore: 80, riskLevel: 'high', transactionAction: 'reject', walletAction: 'freeze' }, { minValue: '', maxValue: '', minRiskScore: 80, maxRiskScore: 100, riskLevel: 'severe', transactionAction: 'reject', walletAction: 'freeze' }],
    post: () => [{ minValue: '', maxValue: '', minRiskScore: '', maxRiskScore: '', riskLevel: 'no_risk', transactionAction: '', walletAction: 'no_action' }, { minValue: '', maxValue: '', minRiskScore: 0, maxRiskScore: 2, riskLevel: 'low', transactionAction: '', walletAction: 'no_action' }, { minValue: '', maxValue: '', minRiskScore: 2, maxRiskScore: 5, riskLevel: 'medium', transactionAction: '', walletAction: 'flag' }, { minValue: '', maxValue: '', minRiskScore: 5, maxRiskScore: 8, riskLevel: 'high', transactionAction: '', walletAction: 'freeze' }, { minValue: '', maxValue: '', minRiskScore: 8, maxRiskScore: 10, riskLevel: 'severe', transactionAction: '', walletAction: 'freeze' }],
  },
  misttrack: {
    pre: () => [{ minValue: '', maxValue: '', minRiskScore: 0, maxRiskScore: 30, riskLevel: 'low', transactionAction: 'pass', walletAction: 'no_action' }, { minValue: '', maxValue: '', minRiskScore: 30, maxRiskScore: 70, riskLevel: 'medium', transactionAction: 'hold', walletAction: 'flag' }, { minValue: '', maxValue: '', minRiskScore: 70, maxRiskScore: 90, riskLevel: 'high', transactionAction: 'reject', walletAction: 'freeze' }, { minValue: '', maxValue: '', minRiskScore: 90, maxRiskScore: 100, riskLevel: 'severe', transactionAction: 'reject', walletAction: 'freeze' }],
    post: () => [{ minValue: '', maxValue: '', minRiskScore: 0, maxRiskScore: 30, riskLevel: 'low', transactionAction: '', walletAction: 'no_action' }, { minValue: '', maxValue: '', minRiskScore: 30, maxRiskScore: 70, riskLevel: 'medium', transactionAction: '', walletAction: 'flag' }, { minValue: '', maxValue: '', minRiskScore: 70, maxRiskScore: 90, riskLevel: 'high', transactionAction: '', walletAction: 'freeze' }, { minValue: '', maxValue: '', minRiskScore: 90, maxRiskScore: 100, riskLevel: 'severe', transactionAction: '', walletAction: 'freeze' }],
  },
};
