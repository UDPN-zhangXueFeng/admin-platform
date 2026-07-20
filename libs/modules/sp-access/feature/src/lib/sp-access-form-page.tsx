'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@myorg/shared/util-i18n';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Upload } from 'lucide-react';
import {
  Button,
  Checkbox,
  Input,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@myorg/shared/ui';
import { Label } from '@myorg/shared/ui';
import { FormField } from '@myorg/shared/ui-forms';
import {
  uploadSpAccessBusinessLicense,
  useCreateSpAccessMutation,
  useSpAccessDetailQuery,
  useSpAccessTypeOptionsQuery,
  useSpAccessWalletRulesQuery,
  useUpdateSpAccessMutation,
  type SpAccessPermissionSelection,
  type SpAccessTdAccess,
  type SpAccessWalletRule,
} from '@myorg/modules/sp-access/data-access';
import {
  kycRequiredOptions,
  metaTypeOptions,
  parsePrivateKeyCustodyModel,
  parseTransactionPolicy,
  privateKeyCustodyModelOptions,
  reconciliationFrequencyOptions,
  serializePrivateKeyCustodyModel,
  serializeTransactionPolicy,
  serviceProviderTypeOptions,
  transactionPolicyOptions,
} from '@myorg/modules/sp-access/util';

interface SpAccessFormValues {
  spName: string;
  contactName: string;
  email: string;
  phone: string;
  spType: string;
  description: string;
  metaType: string;
  reconciliationFrequency: string;
  privateKeyCustodyModel: string[];
  transactionPolicy: string[];
}

interface FileState {
  fileId?: number;
  fileName?: string;
  fileType?: string;
  previewUrl?: string;
}

interface TokenConfigState {
  tdId: number;
  stablecoinCode: string;
  stablecoinName: string;
  blockchainName?: string;
  tokenType?: string;
  walletAddress: string;
  contractAddress: string;
  webhookUrl: string;
  kycRequired: number;
  apiEnabled: boolean;
  contractEnabled: boolean;
  apiPermissions: SpAccessPermissionSelection[];
  contractPermissions: SpAccessPermissionSelection[];
}

const FILE_BUS_TYPE = '1';
const MAX_UPLOAD_SIZE = 2 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpg',
  'image/jpeg',
  'image/bmp',
  'image/gif',
] as const;

function buildEmptyTokenConfig(rule: SpAccessWalletRule): TokenConfigState {
  return {
    tdId: rule.stablecoinId,
    stablecoinCode: rule.stablecoinCode,
    stablecoinName: rule.stablecoinName,
    blockchainName: rule.blockchainName,
    tokenType: rule.tokenType,
    walletAddress: '',
    contractAddress: '',
    webhookUrl: '',
    kycRequired: 1,
    apiEnabled: true,
    contractEnabled: false,
    apiPermissions: [],
    contractPermissions: [],
  };
}

function mapDetailTokenConfig(detail: SpAccessTdAccess, fallback: SpAccessWalletRule): TokenConfigState {
  return {
    tdId: detail.tdId ?? fallback.stablecoinId,
    stablecoinCode: detail.stablecoinCode,
    stablecoinName: detail.stablecoinName ?? fallback.stablecoinName,
    blockchainName: detail.blockchainName ?? fallback.blockchainName,
    tokenType: detail.tokenType ?? fallback.tokenType,
    walletAddress: detail.walletAddress ?? '',
    contractAddress: detail.contractAddress ?? '',
    webhookUrl: detail.webhookUrl ?? '',
    kycRequired: detail.kycRequired ?? 1,
    apiEnabled: detail.apiEnabled ?? true,
    contractEnabled: detail.contractEnabled ?? false,
    apiPermissions: detail.apiPermissions ?? [],
    contractPermissions: detail.contractPermissions ?? [],
  };
}

function buildPermissionKey(accessConfId: number, walletRuleId: number): string {
  return `${accessConfId}:${walletRuleId}`;
}

function parsePermissionKeys(selections: SpAccessPermissionSelection[]): Set<string> {
  return new Set(
    selections.flatMap((selection) =>
      selection.walletTypeIdList.map((walletRuleId) =>
        buildPermissionKey(selection.accessConfId, walletRuleId),
      ),
    ),
  );
}

function serializePermissionSelections(selectedKeys: Set<string>): SpAccessPermissionSelection[] {
  const grouped = new Map<number, number[]>();

  selectedKeys.forEach((key) => {
    const [accessConfIdRaw, walletRuleIdRaw] = key.split(':');
    const accessConfId = Number(accessConfIdRaw);
    const walletRuleId = Number(walletRuleIdRaw);
    if (!Number.isFinite(accessConfId) || !Number.isFinite(walletRuleId)) {
      return;
    }

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
  if (file.type && ALLOWED_FILE_TYPES.includes(file.type as (typeof ALLOWED_FILE_TYPES)[number])) {
    return true;
  }

  const normalizedName = file.name.toLowerCase();
  return ['.pdf', '.png', '.jpg', '.jpeg', '.bmp', '.gif'].some((suffix) =>
    normalizedName.endsWith(suffix),
  );
}

function buildTokenConfigMap(
  walletRules: SpAccessWalletRule[] | undefined,
  detailAccessList: SpAccessTdAccess[] | undefined,
): Record<string, TokenConfigState> {
  const ruleMap = new Map((walletRules ?? []).map((rule) => [rule.stablecoinCode, rule]));

  const nextConfigs: Record<string, TokenConfigState> = {};

  (walletRules ?? []).forEach((rule) => {
    nextConfigs[rule.stablecoinCode] = buildEmptyTokenConfig(rule);
  });

  (detailAccessList ?? []).forEach((detail) => {
    const fallback =
      ruleMap.get(detail.stablecoinCode) ??
      ({
        stablecoinId: detail.tdId ?? detail.stablecoinId ?? 0,
        stablecoinCode: detail.stablecoinCode,
        stablecoinName: detail.stablecoinName ?? detail.stablecoinCode,
        blockchainName: detail.blockchainName,
        tokenType: detail.tokenType,
        walletRules: [],
      } satisfies SpAccessWalletRule);

    nextConfigs[detail.stablecoinCode] = mapDetailTokenConfig(detail, fallback);
  });

  return nextConfigs;
}

function buildSelectedStablecoinMap(detailAccessList: SpAccessTdAccess[] | undefined): Record<string, boolean> {
  return (detailAccessList ?? []).reduce<Record<string, boolean>>((result, item) => {
    result[item.stablecoinCode] = item.tokenPermissionEnabled;
    return result;
  }, {});
}

export function SpAccessFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const spRecordId = React.useMemo(() => {
    const raw = searchParams.get('id');
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }, [searchParams]);
  const spId = React.useMemo(() => {
    const raw = searchParams.get('spId');
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }, [searchParams]);
  const spCode = searchParams.get('spCode') ?? undefined;
  const isEditMode = typeof spRecordId === 'number' && typeof spId === 'number' && !!spCode;

  const { data: detail } = useSpAccessDetailQuery(spId);
  const { data: walletRules } = useSpAccessWalletRulesQuery();
  const { data: typeOptions } = useSpAccessTypeOptionsQuery();
  const createMutation = useCreateSpAccessMutation();
  const updateMutation = useUpdateSpAccessMutation();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SpAccessFormValues>({
    defaultValues: {
      spName: '',
      contactName: '',
      email: '',
      phone: '',
      spType: '',
      description: '',
      metaType: '1',
      reconciliationFrequency: '1',
      privateKeyCustodyModel: [],
      transactionPolicy: [],
    },
  });

  const [selectedStablecoins, setSelectedStablecoins] = React.useState<Record<string, boolean>>({});
  const [tokenConfigs, setTokenConfigs] = React.useState<Record<string, TokenConfigState>>({});
  const [fileState, setFileState] = React.useState<FileState>({});
  const [uploadingFile, setUploadingFile] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!walletRules?.length) return;

    setTokenConfigs((prev) => {
      const next = { ...buildTokenConfigMap(walletRules, detail?.tdAccessList), ...prev };
      return next;
    });
  }, [walletRules, detail?.tdAccessList]);

  React.useEffect(() => {
    if (!detail || !isEditMode) return;

    reset({
      spName: detail.serviceProviderName,
      contactName: detail.contactName ?? '',
      email: detail.email ?? '',
      phone: detail.phone ?? '',
      spType: detail.serviceProviderType,
      description: detail.description ?? '',
      metaType: detail.metaType ? String(detail.metaType) : '1',
      reconciliationFrequency: detail.reconciliationFrequency
        ? String(detail.reconciliationFrequency)
        : '1',
      privateKeyCustodyModel: parsePrivateKeyCustodyModel(detail.privateKeyCustodyModel),
      transactionPolicy: parseTransactionPolicy(detail.transactionPolicy),
    });

    setSelectedStablecoins(buildSelectedStablecoinMap(detail.tdAccessList));
    if (walletRules?.length) {
      setTokenConfigs(buildTokenConfigMap(walletRules, detail.tdAccessList));
    }

    setFileState({
      fileId: detail.businessLicenseFileId ? Number(detail.businessLicenseFileId) : undefined,
      fileName: detail.businessLicenseFileName,
      fileType: detail.businessLicenseFileType,
      previewUrl: detail.businessLicensePreviewUrl,
    });
  }, [detail, isEditMode, reset, walletRules]);

  const formValues = watch();

  const toggleArrayValue = React.useCallback(
    (field: 'privateKeyCustodyModel' | 'transactionPolicy', value: string, checked: boolean) => {
      const current = watch(field);
      const next = checked
        ? Array.from(new Set([...current, value]))
        : current.filter((item) => item !== value);
      setValue(field, next, { shouldDirty: true });
    },
    [setValue, watch],
  );

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSubmitError(null);

    if (!fileTypeAccepts(file)) {
      setSubmitError('Unsupported business license format.');
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      setSubmitError('Business license file size must be 2MB or smaller.');
      return;
    }

    setUploadingFile(true);

    try {
      const response = await uploadSpAccessBusinessLicense({
        file,
        busType: FILE_BUS_TYPE,
      });
      setFileState({
        fileId: response.fileId,
        fileName: file.name,
        fileType: file.type,
        previewUrl: URL.createObjectURL(file),
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Business license upload failed.');
    } finally {
      setUploadingFile(false);
      event.target.value = '';
    }
  };

  const updateTokenConfig = (stablecoinCode: string, updater: (current: TokenConfigState) => TokenConfigState) => {
    setTokenConfigs((prev) => {
      const base = prev[stablecoinCode];
      if (!base) return prev;
      return {
        ...prev,
        [stablecoinCode]: updater(base),
      };
    });
  };

  function onSubmit(values: SpAccessFormValues) {
    setSubmitError(null);

    if (uploadingFile) {
      setSubmitError('Business license is still uploading.');
      return;
    }

    if (!values.privateKeyCustodyModel.length) {
      setSubmitError('Select at least one private key custody model.');
      return;
    }

    if (!values.transactionPolicy.length) {
      setSubmitError('Select at least one transaction policy.');
      return;
    }

    const activeConfigs = Object.entries(selectedStablecoins)
      .filter(([, enabled]) => enabled)
      .map(([stablecoinCode]) => tokenConfigs[stablecoinCode])
      .filter(Boolean);

    if (activeConfigs.length === 0) {
      setSubmitError('Select at least one token to configure permissions.');
      return;
    }

    if (!fileState.fileId) {
      setSubmitError('Upload a business license before submitting.');
      return;
    }

    const hasEmptyEnabledPermission = activeConfigs.some(
      (config) =>
        (config.apiEnabled && config.apiPermissions.length === 0) ||
        (config.contractEnabled && config.contractPermissions.length === 0),
    );

    if (hasEmptyEnabledPermission) {
      setSubmitError('Select at least one wallet rule for every enabled access channel.');
      return;
    }

    const tdAccessList: SpAccessTdAccess[] = activeConfigs.map((config) => ({
      stablecoinCode: config.stablecoinCode,
      tdId: config.tdId,
      walletAddress: config.walletAddress.trim(),
      contractAddress: config.contractAddress.trim(),
      webhookUrl: config.webhookUrl.trim(),
      kycRequired: config.kycRequired,
      tokenPermissionEnabled: true,
      apiEnabled: config.apiEnabled,
      contractEnabled: config.contractEnabled,
      apiPermissions: config.apiPermissions,
      contractPermissions: config.contractPermissions,
    }));

    const payload = {
      spName: values.spName.trim(),
      contactName: values.contactName.trim(),
      email: values.email.trim(),
      phone: values.phone.trim() || undefined,
      description: values.description.trim() || undefined,
      fileId: fileState.fileId,
      spType: Number(values.spType),
      metaType: Number(values.metaType),
      reconciliationFrequency: Number(values.reconciliationFrequency),
      privateKeyCustodyModel: serializePrivateKeyCustodyModel(values.privateKeyCustodyModel),
      transactionPolicy: serializeTransactionPolicy(values.transactionPolicy),
      tdAccessList,
    };

    if (isEditMode && spCode) {
      updateMutation.mutate(
        {
          ...payload,
          spCode,
        },
        {
          onSuccess: () => router.back(),
          onError: (error) =>
            setSubmitError(error instanceof Error ? error.message : 'Failed to update service provider.'),
        },
      );
      return;
    }

    createMutation.mutate(payload, {
      onSuccess: () => router.back(),
      onError: (error) =>
        setSubmitError(error instanceof Error ? error.message : 'Failed to create service provider.'),
    });
  }

  const mutationPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {isEditMode ? 'Edit Service Provider' : 'Register Service Provider'}
        </h1>
        <p className="text-sm text-muted-foreground">
          This first version preserves the validated onboarding semantics and aligns payloads to the
          current backend contract.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Basic Information</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              name="spName"
              label="Service Provider Name"
              placeholder="Enter service provider name"
              register={register('spName', { required: 'Required field' })}
              error={errors.spName?.message}
              disabled={isEditMode}
              required
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium">Service Provider Type</label>
              <Select value={formValues.spType} onValueChange={(value) => setValue('spType', value, { shouldDirty: true })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select service provider type" />
                </SelectTrigger>
                <SelectContent>
                  {serviceProviderTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <FormField
              name="contactName"
              label="Contact Name"
              placeholder="Enter contact name"
              register={register('contactName', { required: 'Required field' })}
              error={errors.contactName?.message}
              required
            />

            <FormField
              name="email"
              label="Email"
              type="email"
              placeholder="Enter email"
              register={register('email', { required: 'Required field' })}
              error={errors.email?.message}
              required
            />

            <FormField
              name="phone"
              label="Phone"
              placeholder="Enter phone number"
              register={register('phone')}
              error={errors.phone?.message}
            />

            <div className="space-y-2">
              <Label htmlFor="business-license">Business License</Label>
              <div className="rounded-md border border-dashed p-4">
                <label
                  htmlFor="business-license"
                  className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm font-medium"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadingFile ? 'Uploading...' : 'Upload File'}
                </label>
                <input
                  id="business-license"
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.bmp,.gif"
                  onChange={handleFileChange}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Supported: PDF, PNG, JPG, JPEG, BMP, GIF. Max 2MB.
                </p>
                {fileState.fileName ? (
                  <div className="mt-3 rounded-md bg-muted p-3 text-sm">
                    <p className="font-medium">{fileState.fileName}</p>
                    {fileState.previewUrl ? (
                      <a
                        href={fileState.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        Preview file
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium">Description</label>
            <textarea
              className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register('description')}
              placeholder="Describe the service provider and operational notes"
            />
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Access Configuration</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Meta Transaction</label>
              <RadioGroup
                value={formValues.metaType}
                onValueChange={(value) => setValue('metaType', value, { shouldDirty: true })}
                className="gap-3"
              >
                {metaTypeOptions.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded-md border p-3">
                    <RadioGroupItem value={option.value} />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Reconciliation Frequency</label>
              <RadioGroup
                value={formValues.reconciliationFrequency}
                onValueChange={(value) =>
                  setValue('reconciliationFrequency', value, { shouldDirty: true })
                }
                className="gap-3"
              >
                {reconciliationFrequencyOptions.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded-md border p-3">
                    <RadioGroupItem value={option.value} />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Private Key Custody</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {privateKeyCustodyModelOptions.map((option) => (
              <label key={option.value} className="flex items-center gap-2 rounded-md border p-3">
                <Checkbox
                  checked={formValues.privateKeyCustodyModel.includes(option.value)}
                  onCheckedChange={(checked) =>
                    toggleArrayValue('privateKeyCustodyModel', option.value, Boolean(checked))
                  }
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Transaction Policy</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {transactionPolicyOptions.map((option) => (
              <label key={option.value} className="flex items-center gap-2 rounded-md border p-3">
                <Checkbox
                  checked={formValues.transactionPolicy.includes(option.value)}
                  onCheckedChange={(checked) =>
                    toggleArrayValue('transactionPolicy', option.value, Boolean(checked))
                  }
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Token Permissions</h2>
          <div className="space-y-4">
            {(walletRules ?? []).map((rule) => {
              const selected = Boolean(selectedStablecoins[rule.stablecoinCode]);
              const current = tokenConfigs[rule.stablecoinCode] ?? buildEmptyTokenConfig(rule);
              const apiPermissionKeys = parsePermissionKeys(current.apiPermissions);
              const contractPermissionKeys = parsePermissionKeys(current.contractPermissions);

              return (
                <div key={rule.stablecoinCode} className="rounded-md border p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{rule.stablecoinName}</p>
                      <p className="text-sm text-muted-foreground">
                        {rule.blockchainName || '--'} / {rule.tokenType || '--'}
                      </p>
                    </div>
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={selected}
                        onCheckedChange={(checked) =>
                          setSelectedStablecoins((prev) => ({
                            ...prev,
                            [rule.stablecoinCode]: Boolean(checked),
                          }))
                        }
                      />
                      <span className="text-sm">Enable</span>
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Wallet Address</label>
                      <Input
                        value={current.walletAddress}
                        onChange={(event) =>
                          updateTokenConfig(rule.stablecoinCode, (base) => ({
                            ...base,
                            walletAddress: event.target.value,
                          }))
                        }
                        placeholder="Wallet address"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Webhook URL</label>
                      <Input
                        value={current.webhookUrl}
                        onChange={(event) =>
                          updateTokenConfig(rule.stablecoinCode, (base) => ({
                            ...base,
                            webhookUrl: event.target.value,
                          }))
                        }
                        placeholder="Webhook URL"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Contract Address</label>
                      <Input
                        value={current.contractAddress}
                        onChange={(event) =>
                          updateTokenConfig(rule.stablecoinCode, (base) => ({
                            ...base,
                            contractAddress: event.target.value,
                          }))
                        }
                        placeholder="Contract address"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium">KYC Required</label>
                      <Select
                        value={String(current.kycRequired)}
                        onValueChange={(value) =>
                          updateTokenConfig(rule.stablecoinCode, (base) => ({
                            ...base,
                            kycRequired: Number(value),
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select KYC requirement" />
                        </SelectTrigger>
                        <SelectContent>
                          {kycRequiredOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="space-y-3 rounded-md border p-4">
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={current.apiEnabled}
                          onCheckedChange={(checked) =>
                            updateTokenConfig(rule.stablecoinCode, (base) => ({
                              ...base,
                              apiEnabled: Boolean(checked),
                            }))
                          }
                        />
                        <span className="text-sm font-medium">API Access</span>
                      </label>

                      <div className="space-y-3">
                        {(typeOptions ?? []).map((typeOption) => (
                          <div key={typeOption.accessConfId} className="rounded-md border p-3">
                            <p className="mb-2 text-sm font-medium">{typeOption.label}</p>
                            <div className="grid gap-2 md:grid-cols-2">
                              {rule.walletRules.map((walletOption) => {
                                const key = buildPermissionKey(
                                  typeOption.accessConfId,
                                  walletOption.walletRuleId,
                                );
                                return (
                                  <label key={key} className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                      checked={apiPermissionKeys.has(key)}
                                      disabled={walletOption.state === 0}
                                      onCheckedChange={(checked) => {
                                        const next = new Set(apiPermissionKeys);
                                        if (checked) {
                                          next.add(key);
                                        } else {
                                          next.delete(key);
                                        }
                                        updateTokenConfig(rule.stablecoinCode, (base) => ({
                                          ...base,
                                          apiPermissions: serializePermissionSelections(next),
                                        }));
                                      }}
                                    />
                                    <span>{walletOption.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-md border p-4">
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={current.contractEnabled}
                          onCheckedChange={(checked) =>
                            updateTokenConfig(rule.stablecoinCode, (base) => ({
                              ...base,
                              contractEnabled: Boolean(checked),
                            }))
                          }
                        />
                        <span className="text-sm font-medium">Contract Access</span>
                      </label>

                      <div className="space-y-3">
                        {(typeOptions ?? []).map((typeOption) => (
                          <div key={typeOption.accessConfId} className="rounded-md border p-3">
                            <p className="mb-2 text-sm font-medium">{typeOption.label}</p>
                            <div className="grid gap-2 md:grid-cols-2">
                              {rule.walletRules.map((walletOption) => {
                                const key = buildPermissionKey(
                                  typeOption.accessConfId,
                                  walletOption.walletRuleId,
                                );
                                return (
                                  <label key={key} className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                      checked={contractPermissionKeys.has(key)}
                                      disabled={walletOption.state === 0}
                                      onCheckedChange={(checked) => {
                                        const next = new Set(contractPermissionKeys);
                                        if (checked) {
                                          next.add(key);
                                        } else {
                                          next.delete(key);
                                        }
                                        updateTokenConfig(rule.stablecoinCode, (base) => ({
                                          ...base,
                                          contractPermissions: serializePermissionSelections(next),
                                        }));
                                      }}
                                    />
                                    <span>{walletOption.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {submitError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {submitError}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={mutationPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutationPending || uploadingFile}>
            {mutationPending ? 'Submitting...' : isEditMode ? 'Save Changes' : 'Create'}
          </Button>
        </div>
      </form>
    </div>
  );
}
