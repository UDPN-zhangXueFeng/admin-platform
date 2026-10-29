'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Upload } from 'lucide-react';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  Button,
  Checkbox,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Switch,
  Textarea,
} from '@myorg/shared/ui';
import {
  uploadSpAccessBusinessLicense,
  useCreateSpAccessMutation,
  useSpAccessDetailQuery,
  useSpAccessSftpBase64Query,
  useSpAccessTypeOptionsQuery,
  useUpdateSpAccessMutation,
  useSpAccessWalletRulesQuery,
  type SpAccessSaveAccessPayload,
  type SpAccessSavePayload,
  type SpAccessSaveTdPayload,
  type SpAccessWalletRule,
} from '@myorg/modules/td-admin/data-access';
import {
  API_ACCESS_TYPE,
  BUSINESS_LICENSE_BUS_TYPE,
  BUSINESS_LICENSE_MAX_SIZE_BYTES,
  BUSINESS_LICENSE_ACCEPT,
  CONTRACT_ACCESS_TYPE,
  DEFAULT_PRIVATE_KEY_CUSTODY_MODEL,
  DESCRIPTION_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  FALLBACK_PRIVATE_KEY_CUSTODY_MODEL,
  KYC_REQUIRED_FIXED,
  META_TYPE_DISABLED,
  META_TYPE_ENABLED,
  NAME_MAX_LENGTH,
  PHONE_MAX_LENGTH,
  TRANSACTION_POLICY_FIXED,
} from './constants';

/** 每个代币的本地表单状态（上游 openAPIAccess Form.List 项的等价物）。 */
interface TokenConfigState {
  enabled: boolean;
  walletAddress: string;
  contractAddress: string;
  webhookUrl: string;
  /** `${accessConfId}:${walletRuleId}` 集合 */
  apiPermissionKeys: Set<string>;
  contractPermissionKeys: Set<string>;
}

function buildPermissionKey(accessConfId: number, walletRuleId: number): string {
  return `${accessConfId}:${walletRuleId}`;
}

function parsePermissionKeys(
  permissionsList: Array<{ accessConfId?: number; walletTypeIdList?: number[] }> | undefined,
  walletRuleStateById: (walletRuleId: number) => boolean,
): Set<string> {
  const keys = new Set<string>();
  (permissionsList ?? []).forEach((entry) => {
    if (typeof entry.accessConfId !== 'number') return;
    const accessConfId: number = entry.accessConfId;
    (entry.walletTypeIdList ?? []).forEach((rawWalletRuleId) => {
      const walletRuleId = Number(rawWalletRuleId);
      if (!Number.isFinite(walletRuleId)) return;
      // 回填时过滤 state===0（禁用规则不可选中，与上游 buildCascaderSelectionsFromDetail 一致）
      if (!walletRuleStateById(walletRuleId)) return;
      keys.add(buildPermissionKey(accessConfId, walletRuleId));
    });
  });
  return keys;
}

function serializePermissionSelections(
  selectedKeys: Set<string>,
): Array<{ accessConfId: number; walletTypeIdList: number[] }> {
  const grouped = new Map<number, number[]>();
  selectedKeys.forEach((key) => {
    const [accessConfIdRaw, walletRuleIdRaw] = key.split(':');
    const accessConfId = Number(accessConfIdRaw);
    const walletRuleId = Number(walletRuleIdRaw);
    if (!Number.isFinite(accessConfId) || !Number.isFinite(walletRuleId)) return;
    const current = grouped.get(accessConfId) ?? [];
    current.push(walletRuleId);
    grouped.set(accessConfId, current);
  });
  return Array.from(grouped.entries()).map(([accessConfId, walletTypeIdList]) => ({
    accessConfId,
    walletTypeIdList: Array.from(new Set(walletTypeIdList)).sort((left, right) => left - right),
  }));
}

function fileTypeAccepts(file: File): boolean {
  if (file.type && ['application/pdf', 'image/png', 'image/jpeg', 'image/bmp', 'image/gif'].includes(file.type)) {
    return true;
  }
  const normalizedName = file.name.toLowerCase();
  return ['.pdf', '.png', '.jpg', '.jpeg', '.bmp', '.gif'].some((suffix) => normalizedName.endsWith(suffix));
}

/** 编辑态营业执照 mime 推断（上游 resolveBusinessLicenseMimeType 同语义）。 */
function resolveLicenseMimeType(fileType?: string): string {
  const normalized = (fileType ?? '').trim().toLowerCase();
  if (normalized.includes('pdf')) return 'application/pdf';
  if (normalized.includes('png')) return 'image/png';
  if (normalized.includes('gif')) return 'image/gif';
  if (normalized.includes('bmp')) return 'image/bmp';
  return 'image/jpeg';
}

export function SpAccessFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('modules.sp-access');
  const tc = useTranslations('common');

  // 上游契约：URL 为 t_edit?id={spId}&spCode={spCode}；id 即 spId（detail/basicInfo 的入参）。
  const spId = React.useMemo(() => {
    const raw = searchParams.get('id');
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }, [searchParams]);
  const spCode = searchParams.get('spCode') ?? '';
  const isEditMode = Boolean(spId && spCode);

  const { data: detail, isLoading: detailLoading } = useSpAccessDetailQuery(
    isEditMode ? spId : undefined,
  );
  const { data: walletRules } = useSpAccessWalletRulesQuery();
  const { data: typeOptions } = useSpAccessTypeOptionsQuery();
  const createMutation = useCreateSpAccessMutation();
  const updateMutation = useUpdateSpAccessMutation();
  const mutationPending = createMutation.isPending || updateMutation.isPending;

  // 编辑态营业执照预览（POST sftp/base64），detail 未就绪时禁用。
  const sftpParams = React.useMemo(() => {
    if (!isEditMode || !detail?.fileId) return null;
    return {
      busType: detail.busType && Number(detail.busType) > 0 ? Number(detail.busType) : Number(BUSINESS_LICENSE_BUS_TYPE),
      busId: detail.fileId,
    };
  }, [isEditMode, detail?.fileId, detail?.busType]);
  const { data: licenseBase64, isLoading: licenseLoading } = useSpAccessSftpBase64Query(sftpParams);

  const [tokenConfigs, setTokenConfigs] = React.useState<Record<string, TokenConfigState>>({});
  const [fileState, setFileState] = React.useState<{ fileId?: number }>({});
  const [uploadingFile, setUploadingFile] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [metaEnabled, setMetaEnabled] = React.useState(false);
  const [reconciliation, setReconciliation] = React.useState('1');
  const [custodySelection, setCustodySelection] = React.useState<string[]>(
    [...DEFAULT_PRIVATE_KEY_CUSTODY_MODEL],
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [basic, setBasic] = React.useState({ spName: '', spType: '', contactName: '', email: '', phone: '' });

  // 编辑态回填（上游 detail populate effect 同语义；detail + walletRules 双就绪后执行一次）。
  const populatedRef = React.useRef(false);
  React.useEffect(() => {
    if (!isEditMode || !detail || !walletRules || populatedRef.current) return;
    populatedRef.current = true;

    setBasic({
      spName: detail.spName ?? '',
      spType: detail.spType != null ? String(detail.spType) : '1',
      contactName: detail.contactName ?? '',
      email: detail.email ?? '',
      phone: detail.phone ?? '',
    });
    setDescription(detail.spDesc ?? '');
    setMetaEnabled(Number(detail.metaType) === META_TYPE_ENABLED);
    setReconciliation(
      ['1', '2', '3'].includes(String(detail.reconciliationFrequency)) ? String(detail.reconciliationFrequency) : '1',
    );
    setCustodySelection(
      detail.privateKeyCustodyModel
        ? detail.privateKeyCustodyModel.split(',').map((item) => item.trim()).filter(Boolean)
        : [...FALLBACK_PRIVATE_KEY_CUSTODY_MODEL],
    );
    setFileState({ fileId: detail.fileId != null ? Number(detail.fileId) : undefined });

    const disabledRuleIds = new Set(
      walletRules.flatMap((rule) => rule.walletRules.filter((option) => option.state === 0).map((option) => option.walletRuleId)),
    );
    const stateAllows = (walletRuleId: number) => !disabledRuleIds.has(walletRuleId);

    setTokenConfigs(() => {
      const next: Record<string, TokenConfigState> = {};
      walletRules.forEach((rule) => {
        const matchedTd = (detail.tdList ?? []).find((td) => Number(td.tdId) === Number(rule.stablecoinId));
        const accessList = matchedTd?.accessList ?? [];
        next[String(rule.stablecoinId)] = {
          enabled: Boolean(matchedTd),
          walletAddress: matchedTd?.walletAddress ?? '',
          contractAddress: matchedTd?.contractAddress ?? '',
          webhookUrl: matchedTd?.webhookUrl ?? '',
          apiPermissionKeys: parsePermissionKeys(
            accessList.find((item) => Number(item.accessType) === API_ACCESS_TYPE)?.permissionsList,
            stateAllows,
          ),
          contractPermissionKeys: parsePermissionKeys(
            accessList.find((item) => Number(item.accessType) === CONTRACT_ACCESS_TYPE)?.permissionsList,
            stateAllows,
          ),
        };
      });
      return next;
    });
  }, [isEditMode, detail, walletRules]);

  // 新建态：钱包规则就绪后初始化空配置。
  React.useEffect(() => {
    if (isEditMode || !walletRules?.length) return;
    setTokenConfigs((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, TokenConfigState> = {};
      walletRules.forEach((rule) => {
        next[String(rule.stablecoinId)] = {
          enabled: false,
          walletAddress: '',
          contractAddress: '',
          webhookUrl: '',
          apiPermissionKeys: new Set(),
          contractPermissionKeys: new Set(),
        };
      });
      return next;
    });
  }, [isEditMode, walletRules]);

  const updateTokenConfig = (stablecoinId: string, updater: (current: TokenConfigState) => TokenConfigState) => {
    setTokenConfigs((prev) => {
      const base = prev[stablecoinId];
      if (!base) return prev;
      return { ...prev, [stablecoinId]: updater(base) };
    });
  };

  const togglePermissionKey = (stablecoinId: string, field: 'apiPermissionKeys' | 'contractPermissionKeys', key: string, checked: boolean) => {
    updateTokenConfig(stablecoinId, (base) => {
      const next = new Set(base[field]);
      if (checked) next.add(key);
      else next.delete(key);
      return { ...base, [field]: next };
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!fileTypeAccepts(file)) {
      toast.error(t('sp_access_0071'));
      event.target.value = '';
      return;
    }
    if (file.size > BUSINESS_LICENSE_MAX_SIZE_BYTES) {
      toast.error(t('sp_access_0072'));
      event.target.value = '';
      return;
    }

    setUploadingFile(true);
    try {
      const response = await uploadSpAccessBusinessLicense({ file, busType: BUSINESS_LICENSE_BUS_TYPE });
      setFileState({ fileId: response.fileId });
      toast.success(t('sp_access_0176'));
    } catch (error) {
      setFileState(isEditMode && detail?.fileId ? { fileId: Number(detail.fileId) } : {});
      toast.error(error instanceof Error ? error.message : t('sp_access_0177'));
    } finally {
      setUploadingFile(false);
      event.target.value = '';
    }
  };

  const buildTdAccessList = (): SpAccessSaveTdPayload[] => {
    return (walletRules ?? []).flatMap((rule: SpAccessWalletRule) => {
      const config = tokenConfigs[String(rule.stablecoinId)];
      if (!config?.enabled) return [];

      const contractAddress = config.contractAddress.trim();
      const apiPermissionsList = serializePermissionSelections(config.apiPermissionKeys);
      const contractPermissionsList = serializePermissionSelections(config.contractPermissionKeys);
      const enableContractAccess = Boolean(contractAddress) && contractPermissionsList.length > 0;

      const accessList: SpAccessSaveAccessPayload[] = [
        {
          accessType: API_ACCESS_TYPE,
          transactionToggle: 1,
          permissionsList: apiPermissionsList,
        },
        ...(enableContractAccess
          ? [
              {
                accessType: CONTRACT_ACCESS_TYPE,
                transactionToggle: 1,
                permissionsList: contractPermissionsList,
              },
            ]
          : []),
      ];

      return [
        {
          tdId: Number(rule.stablecoinId),
          walletAddress: config.walletAddress.trim(),
          contractAddress,
          accessList,
          kycRequired: KYC_REQUIRED_FIXED,
          webhookUrl: config.webhookUrl.trim(),
        },
      ];
    });
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (uploadingFile) {
      setFormError(t('sp_access_0169'));
      return;
    }

    const fileId = fileState.fileId ?? (detail?.fileId != null ? Number(detail.fileId) : undefined);
    if (!fileId) {
      setFormError(t('sp_access_0170'));
      return;
    }
    if (!custodySelection.length) {
      setFormError(t('sp_access_0172'));
      return;
    }

    const tdAccessList = buildTdAccessList();
    if (!tdAccessList.length) {
      setFormError(t('sp_access_0171'));
      return;
    }

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(basic.email.trim());
    if (!basic.spName.trim() && !isEditMode) {
      setFormError(t('sp_access_0185'));
      return;
    }
    if (!basic.contactName.trim()) {
      setFormError(t('sp_access_0186'));
      return;
    }
    if (!emailValid) {
      setFormError(t('sp_access_0182'));
      return;
    }

    // 上游：每个启用代币的 OpenAPI 权限必填（Cascader required 规则）。
    const missingPermission = tdAccessList.some(
      (td) => !(td.accessList.find((item) => item.accessType === API_ACCESS_TYPE)?.permissionsList.length ?? 0),
    );
    if (missingPermission) {
      setFormError(t('sp_access_0183'));
      return;
    }

    const payload: SpAccessSavePayload = {
      contactName: basic.contactName.trim(),
      email: basic.email.trim(),
      phone: basic.phone.trim(),
      description,
      fileId,
      tdAccessList,
      spType: Number(basic.spType) || 1,
      metaType: metaEnabled ? META_TYPE_ENABLED : META_TYPE_DISABLED,
      reconciliationFrequency: Number(reconciliation) || 1,
      privateKeyCustodyModel: [...custodySelection]
        .map((key) => ({ issuer: '1', sp: '2', end_user: '3' })[key] ?? '')
        .filter(Boolean)
        .sort((left, right) => Number(left) - Number(right))
        .join(','),
      transactionPolicy: TRANSACTION_POLICY_FIXED,
    };

    setSubmitting(true);
    try {
      if (isEditMode) {
        // 上游编辑：spCode + spName（detailInfo.spName 优先）+ payload。
        await updateMutation.mutateAsync({
          spCode,
          spName: detail?.spName || basic.spName,
          ...payload,
        });
      } else {
        await createMutation.mutateAsync({ spName: basic.spName.trim(), ...payload });
      }
      toast.success(t('sp_access_0174'));
      router.push('/sp-access');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('sp_access_0175'));
    } finally {
      setSubmitting(false);
    }
  };

  const licensePreviewUrl = licenseBase64 ? `data:${resolveLicenseMimeType(detail?.fileType)};base64,${licenseBase64}` : null;
  const selectedTokenCount = Object.values(tokenConfigs).filter((config) => config.enabled).length;

  if (isEditMode && detailLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg border bg-card" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => router.push('/sp-access')} aria-label={t('PUB_GoBack')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold">
          {isEditMode ? t('sp_access_0062') : t('sp_access_0050')}
        </h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">{t('sp_access_0009')}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="sp-name">{t('sp_access_0000')}</Label>
              <Input
                id="sp-name"
                value={basic.spName}
                maxLength={NAME_MAX_LENGTH}
                disabled={isEditMode}
                placeholder={t('sp_access_0162')}
                onChange={(event) => setBasic((prev) => ({ ...prev, spName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sp-type">{t('sp_access_0065')}</Label>
              <select
                id="sp-type"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={basic.spType}
                onChange={(event) => setBasic((prev) => ({ ...prev, spType: event.target.value }))}
              >
                <option value="1">{t('service_provider_type_1')}</option>
                <option value="5">{t('service_provider_type_5')}</option>
                <option value="10">{t('service_provider_type_10')}</option>
                <option value="15">{t('service_provider_type_15')}</option>
                <option value="20">{t('service_provider_type_20')}</option>
                <option value="25">{t('service_provider_type_25')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-name">{t('sp_access_0039')}</Label>
              <Input
                id="contact-name"
                value={basic.contactName}
                maxLength={NAME_MAX_LENGTH}
                placeholder={t('sp_access_0163')}
                onChange={(event) => setBasic((prev) => ({ ...prev, contactName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sp-email">{t('PUB_Email')}</Label>
              <Input
                id="sp-email"
                type="email"
                value={basic.email}
                maxLength={EMAIL_MAX_LENGTH}
                placeholder={t('sp_access_0164')}
                onChange={(event) => setBasic((prev) => ({ ...prev, email: event.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{t('sp_access_0029')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sp-phone">{t('PUB_Phone')}</Label>
              <Input
                id="sp-phone"
                value={basic.phone}
                maxLength={PHONE_MAX_LENGTH}
                placeholder={t('sp_access_0165')}
                onChange={(event) => setBasic((prev) => ({ ...prev, phone: event.target.value.replace(/[^+\d]/g, '') }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('sp_access_0041')}</Label>
              {isEditMode ? (
                <div className="text-sm">
                  {licenseLoading ? (
                    <span className="text-muted-foreground">...</span>
                  ) : licensePreviewUrl ? (
                    licensePreviewUrl.startsWith('data:image/') ? (
                      <img src={licensePreviewUrl} alt={t('sp_access_0041')} className="h-28 rounded border" />
                    ) : licensePreviewUrl.startsWith('data:application/pdf') ? (
                      <iframe title={t('sp_access_0041')} src={licensePreviewUrl} className="h-40 w-full rounded border" />
                    ) : (
                      <a href={licensePreviewUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                        {t('sp_access_0167')}
                      </a>
                    )
                  ) : (
                    <span className="text-muted-foreground">{t('sp_access_0168')}</span>
                  )}
                </div>
              ) : (
                <div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
                    <Upload className="h-4 w-4" />
                    {uploadingFile ? '...' : tc('upload')}
                    <input
                      type="file"
                      className="sr-only"
                      accept={BUSINESS_LICENSE_ACCEPT}
                      onChange={handleFileChange}
                    />
                  </label>
                  <p className="mt-2 text-xs text-muted-foreground">{t('sp_access_0042')}</p>
                </div>
              )}
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="sp-desc">{t('sp_access_0040')}</Label>
              <Textarea
                id="sp-desc"
                value={description}
                maxLength={DESCRIPTION_MAX_LENGTH}
                rows={4}
                placeholder={t('sp_access_0166')}
                onChange={(event) => setDescription(event.target.value)}
              />
              <p className="text-right text-xs text-muted-foreground">
                {description.length} / {DESCRIPTION_MAX_LENGTH}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">{t('sp_access_0007')}</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Label>{t('sp_access_0147')}</Label>
              <div className="flex items-center gap-3">
                <Switch checked={metaEnabled} onCheckedChange={setMetaEnabled} aria-label={t('sp_access_0147')} />
                <span className="text-sm text-muted-foreground">{metaEnabled ? t('PUB_Yes') : t('PUB_No')}</span>
              </div>
            </div>
            <div className="space-y-3">
              <Label>{t('sp_access_0148')}</Label>
              <RadioGroup
                value={reconciliation}
                onValueChange={setReconciliation}
                className="flex flex-wrap gap-4"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="1" />
                  {t('sp_access_0150')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="2" />
                  {t('sp_access_0151')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="3" />
                  {t('sp_access_0152')}
                </label>
              </RadioGroup>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-1 text-lg font-semibold">{t('sp_access_0067')}</h2>
          <p className="mb-4 text-sm text-muted-foreground">{t('sp_access_0179')}</p>
          <div className="grid gap-3 md:grid-cols-3">
            {(
              [
                { key: 'issuer', label: t('sp_access_0153'), description: t('sp_access_0156') },
                { key: 'sp', label: t('sp_access_0154'), description: t('sp_access_0157') },
                { key: 'end_user', label: t('sp_access_0155'), description: t('sp_access_0158') },
              ] as const
            ).map((model) => (
              <label
                key={model.key}
                className={`flex cursor-pointer flex-col gap-2 rounded-md border p-4 ${
                  custodySelection.includes(model.key) ? 'border-primary' : ''
                }`}
              >
                <span className="flex items-center gap-2">
                  <Checkbox
                    checked={custodySelection.includes(model.key)}
                    onCheckedChange={(checked) =>
                      setCustodySelection((prev) =>
                        checked
                          ? [...prev, model.key]
                          : prev.filter((item) => item !== model.key),
                      )
                    }
                  />
                  <span className="text-sm font-medium">{model.label}</span>
                </span>
                <span className="text-xs text-muted-foreground">{model.description}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-1 text-lg font-semibold">{t('sp_access_0149')}</h2>
          <p className="mb-4 text-sm text-muted-foreground">{t('sp_access_0178')}</p>
          <div className="flex flex-wrap gap-10">
            <div className="flex items-start gap-3">
              <Switch checked disabled aria-label={t('sp_access_0180')} />
              <div>
                <p className="text-sm font-medium">{t('sp_access_0180')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Switch checked disabled aria-label={t('sp_access_0181')} />
              <div>
                <p className="text-sm font-medium">{t('sp_access_0181')}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t('sp_access_0063')}</h2>
            <span className="text-sm text-muted-foreground">
              {t('sp_access_0184')}: {selectedTokenCount}
            </span>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{t('sp_access_0043')}</p>
          <div className="space-y-4">
            {(walletRules ?? []).map((rule) => {
              const key = String(rule.stablecoinId);
              const config = tokenConfigs[key];
              if (!config) return null;

              return (
                <div key={key} className={`rounded-md border p-4 ${config.enabled ? 'border-primary/40' : ''}`}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {rule.name ?? '--'}
                        {rule.blockchainName ? ` (${rule.blockchainName})` : ''}
                      </p>
                    </div>
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={(checked) => updateTokenConfig(key, (base) => ({ ...base, enabled: checked }))}
                        aria-label={`${t('sp_access_0160')} ${rule.name ?? ''}`}
                      />
                      <span className="text-sm">{t('sp_access_0160')}</span>
                    </label>
                  </div>

                  {config.enabled ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor={`${key}-wallet`}>{t('sp_access_0045')}</Label>
                          <Input
                            id={`${key}-wallet`}
                            value={config.walletAddress}
                            onChange={(event) => updateTokenConfig(key, (base) => ({ ...base, walletAddress: event.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${key}-contract`}>{t('sp_access_0048')}</Label>
                          <Input
                            id={`${key}-contract`}
                            value={config.contractAddress}
                            onChange={(event) => updateTokenConfig(key, (base) => ({ ...base, contractAddress: event.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${key}-webhook`}>{t('sp_access_0159')}</Label>
                          <Input
                            id={`${key}-webhook`}
                            value={config.webhookUrl}
                            onChange={(event) => updateTokenConfig(key, (base) => ({ ...base, webhookUrl: event.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        {(
                          [
                            { title: t('sp_access_0064'), field: 'apiPermissionKeys' as const },
                            { title: t('sp_access_0047'), field: 'contractPermissionKeys' as const },
                          ]
                        ).map((group) => (
                          <div key={group.field} className="space-y-3 rounded-md border p-4">
                            <p className="text-sm font-medium">{group.title}</p>
                            {(typeOptions ?? []).map((typeOption) => (
                              <div key={typeOption.accessConfId} className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">
                                  {typeOption.name ?? t('sp_access_0046')}
                                </p>
                                <div className="grid gap-2 md:grid-cols-2">
                                  {rule.walletRules.map((walletOption) => {
                                    const permissionKey = buildPermissionKey(typeOption.accessConfId, walletOption.walletRuleId);
                                    const disabled = walletOption.state === 0;
                                    return (
                                      <label key={permissionKey} className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                          checked={config[group.field].has(permissionKey)}
                                          disabled={disabled}
                                          onCheckedChange={(checked) =>
                                            togglePermissionKey(key, group.field, permissionKey, Boolean(checked))
                                          }
                                        />
                                        <span>{walletOption.name ?? '--'}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {formError ? (
          <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {formError}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push('/sp-access')} disabled={submitting || mutationPending}>
            {tc('cancel')}
          </Button>
          <Button type="submit" disabled={submitting || mutationPending || uploadingFile}>
            {submitting || mutationPending ? tc('loading') : isEditMode ? t('sp_access_0173') : tc('create')}
          </Button>
        </div>
      </form>
    </div>
  );
}
