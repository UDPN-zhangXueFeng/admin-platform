import type { SpAccessWalletRule } from '@myorg/modules/td-admin/data-access';

export interface TokenConfigState {
  enabled: boolean;
  walletAddress: string;
  contractAddress: string;
  webhookUrl: string;
  apiPermissionKeys: Set<string>;
  contractPermissionKeys: Set<string>;
}

export interface SpAccessBasicValues {
  spName: string;
  spType: string;
  contactName: string;
  email: string;
  phone: string;
}

export function buildPermissionKey(accessConfId: number, walletRuleId: number): string {
  return `${accessConfId}:${walletRuleId}`;
}

export function parsePermissionKeys(
  permissionsList: Array<{
    accessConfId?: number;
    walletTypeIdList?: number[];
    walletTypeList?: Array<{ walletRuleId?: number; state?: number }>;
  }> | undefined,
  walletRuleStateById: (walletRuleId: number) => boolean,
): Set<string> {
  const keys = new Set<string>();
  (permissionsList ?? []).forEach((entry) => {
    if (typeof entry.accessConfId !== 'number') return;
    const walletRuleIds = [
      ...(entry.walletTypeIdList ?? []),
      ...(entry.walletTypeList ?? []).map((wallet) => wallet.walletRuleId),
    ];
    walletRuleIds.forEach((rawWalletRuleId) => {
      const walletRuleId = Number(rawWalletRuleId);
      if (!Number.isFinite(walletRuleId) || !walletRuleStateById(walletRuleId)) return;
      keys.add(buildPermissionKey(entry.accessConfId as number, walletRuleId));
    });
  });
  return keys;
}

export function parsePrivateKeyCustodyModel(value?: string | null): string[] {
  const modelMap: Record<string, string> = { '1': 'issuer', '2': 'sp', '3': 'end_user' };
  const parsed = (value ?? '')
    .split(',')
    .map((item) => modelMap[item.trim()])
    .filter((item): item is string => Boolean(item));
  return parsed.length ? parsed : ['sp', 'end_user'];
}

export function serializePrivateKeyCustodyModel(value: string[]): string {
  const valueMap: Record<string, string> = { issuer: '1', sp: '2', end_user: '3' };
  return value
    .map((item) => valueMap[item])
    .filter(Boolean)
    .sort((left, right) => Number(left) - Number(right))
    .join(',');
}

export function serializePermissionSelections(
  selectedKeys: Set<string>,
): Array<{ accessConfId: number; walletTypeIdList: number[] }> {
  const grouped = new Map<number, number[]>();
  selectedKeys.forEach((key) => {
    const [accessConfIdRaw, walletRuleIdRaw] = key.split(':');
    const accessConfId = Number(accessConfIdRaw);
    const walletRuleId = Number(walletRuleIdRaw);
    if (!Number.isFinite(accessConfId) || !Number.isFinite(walletRuleId)) return;
    grouped.set(accessConfId, [...(grouped.get(accessConfId) ?? []), walletRuleId]);
  });
  return Array.from(grouped.entries()).map(([accessConfId, walletTypeIdList]) => ({
    accessConfId,
    walletTypeIdList: Array.from(new Set(walletTypeIdList)).sort((left, right) => left - right),
  }));
}

export function fileTypeAccepts(file: File): boolean {
  const validMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/bmp', 'image/gif'];
  if (file.type && validMimeTypes.includes(file.type)) return true;
  const normalizedName = file.name.toLowerCase();
  return ['.pdf', '.png', '.jpg', '.jpeg', '.bmp', '.gif'].some((suffix) => normalizedName.endsWith(suffix));
}

export function resolveLicenseMimeType(fileType?: string): string {
  const normalized = (fileType ?? '').trim().toLowerCase();
  if (normalized.includes('pdf')) return 'application/pdf';
  if (normalized.includes('png')) return 'image/png';
  if (normalized.includes('gif')) return 'image/gif';
  if (normalized.includes('bmp')) return 'image/bmp';
  return 'image/jpeg';
}

export function createEmptyTokenConfigs(walletRules: SpAccessWalletRule[]): Record<string, TokenConfigState> {
  return Object.fromEntries(
    walletRules.map((rule) => [
      String(rule.stablecoinId),
      {
        enabled: false,
        walletAddress: '',
        contractAddress: '',
        webhookUrl: '',
        apiPermissionKeys: new Set<string>(),
        contractPermissionKeys: new Set<string>(),
      },
    ]),
  );
}
