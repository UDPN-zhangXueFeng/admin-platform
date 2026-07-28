/**
 * Screening & Monitoring 模块类型定义（rule + transaction-monitoring + screening-providers）。
 */
export interface ScreeningRow { id: string; }
export interface ScreeningListParams<F> { pageNum: number; pageSize: number; filters: F; }
export interface ScreeningListPage { pageNum?: number; pageSize?: number; total?: number; pages?: number; }
export interface ScreeningListResponse<R extends ScreeningRow> { page?: ScreeningListPage; rows: R[]; }

// ── 公共下拉 ──
export interface StablecoinOption { stablecoinId: number | string; name: string; }
export interface BlockchainOption { key: number | string; value: string; status: number; }
export interface BusinessTypeOption { businessType: number; businessName: string; unitList: { monitorName: string; monitorUnit: number }[]; }

// ── Rule 列表/详情 ──
export interface RuleListItem extends ScreeningRow { ruleId: number; ruleName: string; tokenName: string; blockchainName: string; blockchainNameAbbreviation?: string; businessType: number; businessName: string; monitorFrequencyName: string; createUser: string; createDate: string; status: number; buttonFlag?: boolean; }
export interface RuleListFilters { ruleName?: string; tokenId?: string; blockchainId?: string; businessType?: string; startDate?: string; endDate?: string; status?: string; }
export interface RuleDetail { ruleId: number; ruleName: string; tokenName: string; tokenId: number; blockchainName: string; businessType: number; businessName: string; monitorFrequencyName: string; monitorFrequency: string; monitorUnit: number; updateUser: string; updateDate: string; status: number; unit?: number; detailList: RuleDetailItem[]; alertList?: AlertItem[]; browserUrl?: string; ruleFrequency?: string; }
export interface RuleDetailItem { minValue: number; maxValue: number; riskScoring: string; priority: number; handleType: number; emailRecipients?: string; }
export interface AlertItem { contactInfo: string; priority: number; notifyType: number; }
export interface RuleOperationRecord extends ScreeningRow { ruleRecordId: number; recordType: number; createUserName: string; createTime: string; state: number; taskId?: string; busCode?: string; }
export interface RuleOperationLog extends ScreeningRow { logId: number; taskId: string; executionTime: string; blockchainName: string; totalWalletsScanned: number; anomalousWallets: number; }
export interface RuleOperationListFilters extends ScreeningRow { ruleId: number; recordType?: string; }
export interface RuleOperationLogFilters { ruleId: number; startDate?: string; endDate?: string; }

// ── Suspicious 列表/详情 ──
export interface SuspiciousTransaction extends ScreeningRow { suspiciousId: number; walletAddress: string; stablecoinName: string; blockchainName: string; businessType: number; businessName: string; description: string; monitorDate: string; priority: number; handleType: number; state: number; handleResult?: boolean; ruleName?: string; }
export interface SuspiciousListFilters { walletAddress?: string; tokenId?: string; blockchainId?: string; businessType?: string; priority?: string; status?: string; startDate?: string; endDate?: string; }
export interface SuspiciousDetail { suspiciousId: number; businessType: number; businessName: string; walletAddress: string; stablecoinName: string; description: string; monitorDate: string; state: number; resultPriority: number; currentValue?: number; compareValue?: number; symbol?: string; compareToTime?: number; ruleDetails: SuspiciousRuleDetail[]; processList: ProcessRecord[]; browserUrl?: string; unit?: number; ruleName?: string; }
export interface SuspiciousRuleDetail { minValue: number; maxValue: number; riskScoring: string; priority: number; }
export interface ProcessRecord { processResult: number; processingType: number; createdBy: string; createdOn: string; transactionHash?: string; transactionTime?: string; status: number; taskId?: string; businessCode?: string; }
export interface SuspiciousTransactionItem extends ScreeningRow { transactionDate?: string; transactionType?: string; transactionAmount?: number; transactionUnit?: string; from?: string; to?: string; transactionHash?: string; }
export interface SuspiciousTransactionListFilters { suspiciousId: number; }

// ── 表单值 ──
export interface RuleFormValues { ruleName: string; tokenId: number; businessType: number; monitorFrequency: string | number; monitorFrequencyType: number; compareTo: number; saveDetails: SaveDetailFormItem[]; turnOnAlert: boolean; alertList: AlertFormItem[]; }
export interface SaveDetailFormItem { minValue: number | string; maxValue: number | string; riskScoring: string; priority: number | string; handleType: number | string; }
export interface AlertFormItem { contactInfo: string; priority: number; notifyType: number; }
export interface ProcessFormValues { processRemark: number; comments: string; }

// ── t_edit ColumnConfig ──
export interface ColumnConfig { showPercentage: boolean; percentageAsRange?: boolean; showRiskScore: boolean; riskScoreAsRange?: boolean; showRiskLevel: boolean; showTransactionAction: boolean; showWalletAction: boolean; maxRiskLevels?: number; allowAdd?: boolean; }
export interface TEditRiskLevelRow { minValue?: number | string; maxValue?: number | string; minRiskScore?: number; maxRiskScore?: number; riskScore?: string; riskLevel: string; transactionAction: string; walletAction: string; }
export interface TEditFormValues { ruleName: string; ruleSource: string; scanTiming: string; tokenName: string; transactionType?: string; monitoringTime?: string; monitoringFrequencyValue?: number; monitoringFrequencyUnit?: string; compareTo: number; riskLevelConfigs: TEditRiskLevelRow[]; enableEmailNotification: boolean; emailRecipients: { riskLevel: string; emails: string; selectAllUsers: boolean }[]; }

// ── 写操作 ──
export interface RuleSaveParams { ruleName: string; tokenId: number; businessType: number; monitorFrequency: string | number; monitorFrequencyType: number; compareTo?: number; saveDetails: SaveDetailFormItem[]; turnOnAlert?: boolean; alertList?: AlertFormItem[]; ruleId?: number; }
export interface RuleOperateParams { ruleId: number; state: number; }
export interface SuspiciousProcessParams { suspiciousId: number; processRemark: number; comments: string; }
export interface SuspiciousRetryParams { suspiciousId: number; }
