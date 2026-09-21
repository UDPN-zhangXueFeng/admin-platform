export interface AccessKeyInfo { gateway: string; accessKey: string; expiryDate: string; }
export interface MetaMaskInfo { status: number; accountKey: string; updateOn: string; }
export interface MetaMaskHistory { operateType: number; operateTime: string; operateUser: string; status: number; accountKey: string; }
export interface TwoFactorInfo { status: number; qrCode?: string; userName?: string; secretKey?: string; expire?: number; }
