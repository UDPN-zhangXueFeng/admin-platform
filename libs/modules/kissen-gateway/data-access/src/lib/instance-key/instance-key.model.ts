/**
 * 实例密钥域模型（源 `types/instance-key.ts` + `views/instance-key/drawer.vue` accessKeyStatus 映射）。
 *
 * 私钥明文不返回，仅指纹与状态。accessKeyStatus：ABSENT 未配置 / VALID 可用 / INVALID 已失效（激活即失效，仅展示）。
 */

/** Badge variant 约定（kissen 家族语义分层，Element tag type 映射见各映射表注释）。 */
type KeyVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/** 实例密钥视图（GET /instance/key/view，GW-04 双凭证）。 */
export interface InstanceKeyView {
  instanceId: string;
  activated: boolean;
  /** 上行公钥 PEM（本实例自生成，明文）。 */
  uplinkPublicKey?: string;
  uplinkFingerprint?: string;
  uplinkGeneratedTime?: number;
  /** 上行私钥指纹（明文不返回）。 */
  uplinkPrivateKeyFingerprint?: string;
  uplinkPrivateKeyStatus?: string;
  /** 下行公钥 PEM（管理侧下发，明文）。 */
  downlinkPublicKey?: string;
  downlinkFingerprint?: string;
  downlinkPushTime?: number;
  /** 一次性接入 key 状态：ABSENT / VALID / INVALID（激活即失效，仅展示）。 */
  accessKeyStatus: string;
}

/** 私钥下载请求（POST /instance/key/private/download；口令二次确认，禁止入日志）。 */
export interface KeyPrivateDownloadReq {
  password: string;
}

/** 密钥重置请求（POST /instance/key/reset）。direction：upstream=本地重新生成并重推公钥 / downstream=管理侧重新生成并下发。 */
export interface KeyResetReq {
  direction: 'upstream' | 'downstream';
}

/**
 * 接入 key 状态（源 `views/instance-key/drawer.vue` accessKeyText/accessKeyType）。
 * variant 分层映射：Element success→default、info→outline、warning→secondary。
 */
export const ACCESS_KEY_STATUS: Record<string, { text: string; variant: KeyVariant }> = {
  ABSENT: { text: 'Not Configured', variant: 'secondary' },
  VALID: { text: 'Valid', variant: 'default' },
  INVALID: { text: 'Invalidated', variant: 'outline' },
};

/** 接入 key 状态文案；null/undefined → '-'，未知值按原样展示（源 accessKeyText）。 */
export function accessKeyStatusText(status?: string): string {
  return status == null ? '-' : (ACCESS_KEY_STATUS[status]?.text ?? status);
}

/** 接入 key 状态 Badge variant；未知值降级 secondary（源 accessKeyType 的 warning 兜底）。 */
export function accessKeyStatusVariant(status?: string): KeyVariant {
  return status == null ? 'secondary' : (ACCESS_KEY_STATUS[status]?.variant ?? 'secondary');
}
