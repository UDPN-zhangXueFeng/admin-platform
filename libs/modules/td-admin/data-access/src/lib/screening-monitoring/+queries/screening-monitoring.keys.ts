export const screeningKeys = {
  all: ['screening-monitoring'] as const,
  stablecoinOptions: () => [...screeningKeys.all, 'stablecoin-options'] as const,
  blockchainOptions: () => [...screeningKeys.all, 'blockchain-options'] as const,
  businessTypeList: () => [...screeningKeys.all, 'business-type-list'] as const,
  ruleList: (f: Record<string, unknown>) => [...screeningKeys.all, 'rule-list', f] as const,
  ruleDetail: (id: number) => [...screeningKeys.all, 'rule-detail', id] as const,
  ruleOperationRecords: (f: Record<string, unknown>) => [...screeningKeys.all, 'rule-operation-records', f] as const,
  ruleOperationLog: (f: Record<string, unknown>) => [...screeningKeys.all, 'rule-operation-log', f] as const,
  ruleUserList: (tokenId: number) => [...screeningKeys.all, 'rule-user-list', tokenId] as const,
  suspiciousList: (f: Record<string, unknown>) => [...screeningKeys.all, 'suspicious-list', f] as const,
  suspiciousDetail: (id: number) => [...screeningKeys.all, 'suspicious-detail', id] as const,
  suspiciousTransactions: (f: Record<string, unknown>) => [...screeningKeys.all, 'suspicious-transactions', f] as const,
};
