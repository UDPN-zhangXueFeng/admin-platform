export interface CoinData { label: string; value: string; name: string; tokenType: number; pledgeType: number; blockchainNameAbbreviation: string; symbol: string; code: string; }
export interface StatItem { label?: string; value: number; url: string; unit: string; }
export interface TrendDataPoint { statisticsDay: string; walletNumber: number; walletNewNumber: number; topUpTotal: number; transferTotal: number; withdrawalTotal: number; }
export interface StatisticsData { symbol: string; tokenType: number; pledgeType: number; circulation: number; repositoryBalance: number; reserveBalance: number; totalMelt: number; currencySymbol: string; totalMint: number; walletNumber: number; }
