export interface TokenType { tokenTypeId: string; tokenTypeName: string; status: number; }
export interface CoinOption { value: string; label: string; symbol: string; }
export interface ChartDataItem { title: string; count: number; chartData: { value: number; name: string }[]; showChart?: boolean; }
export interface DataPoint { date: string; value: number; }
export interface DoubleDataPoint { date: string; count: number; volume: number; }
export interface MultiLineDataPoint { date: string; [key: string]: number | string; }
export interface OverviewResponse { stablecoinsCount: number; serviceProvidersCount: number; walletsCount: number; transactionCount: number; serviceProvidersProportion: { count: number; tokenName: string }[]; walletsProportion: { count: number; tokenName: string }[]; transactionCountProportion: { count: number; tokenName: string }[]; }
export interface TokenListItem { stablecoinId: string; todoId: number; tokenName: string; tokenSymbol: string; currencySymbol: string; blockchain: string; reserveAccount: number; repositoryBalance: number; stablecoinsInCirculation: number; totalMinted: number; totalMelted: number; serviceProviders: number; wallets: number; tokenStatus: number; }
export interface StablecoinCoin { stablecoinId: string; name: string; symbol: string; blockchainNameAbbreviation: string; }
export interface StablecoinChartData { coinName: string; coinId: string; walletData: DataPoint[]; spTransactionData: DoubleDataPoint[]; abcCountData: MultiLineDataPoint[]; abcVolumeData: MultiLineDataPoint[]; }
