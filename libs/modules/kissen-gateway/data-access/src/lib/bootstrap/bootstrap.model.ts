/**
 * 实例引导域模型（源 `types/bootstrap.ts`）。
 *
 * 独立免 token 实例（baseURL /kissen-api/bankgw/bootstrap），不含任何私钥/接入 key 明文。
 */

/** 实例引导状态（GET /bankgw/bootstrap/state，FR-GI-01/G-13）。 */
export interface BootstrapState {
  /** 接入 key 状态：ABSENT 未配置 / VALID 可用（引导期）/ INVALID 已失效（激活后）。 */
  accessKeyStatus: string;
  instanceId?: string;
  bankCode?: string;
  bic?: string;
  /** 上行密钥对是否已生成。 */
  uplinkReady?: boolean;
  /** 上行公钥指纹（SHA-256 hex）。 */
  uplinkFingerprint?: string;
  uplinkGeneratedTime?: number;
  /** 上行公钥推送管理侧完成时间（毫秒），null=未推送。 */
  publicKeyPushedTime?: number | null;
  /** 实例是否已激活（下行公钥已下发）。 */
  activated: boolean;
  /** 下行公钥下发时间（毫秒）。 */
  downlinkPushTime?: number;
}

/** 上行公钥推送响应（POST /bankgw/bootstrap/public-key/push）。 */
export interface PushKeyResp {
  /** 是否受理成功（幂等：已激活跳过/管理侧未激活重复推送覆盖生效）。 */
  pushed: boolean;
}
