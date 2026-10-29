'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import {
  uploadSpAccessBusinessLicense,
  useCreateSpAccessMutation,
  useSpAccessDetailQuery,
  useSpAccessSftpBase64Query,
  useSpAccessTypeOptionsQuery,
  useUpdateSpAccessMutation,
  useSpAccessWalletRulesQuery,
  type SpAccessDetail,
  type SpAccessSaveAccessPayload,
  type SpAccessSavePayload,
  type SpAccessSaveTdPayload,
  type SpAccessWalletRule,
  type SpAccessTypeOption,
} from '@myorg/modules/td-admin/data-access';
import {
  API_ACCESS_TYPE,
  BUSINESS_LICENSE_BUS_TYPE,
  BUSINESS_LICENSE_MAX_SIZE_BYTES,
  CONTRACT_ACCESS_TYPE,
  DEFAULT_PRIVATE_KEY_CUSTODY_MODEL,
  KYC_REQUIRED_FIXED,
  META_TYPE_DISABLED,
  META_TYPE_ENABLED,
  TRANSACTION_POLICY_FIXED,
} from './constants';
import {
  createEmptyTokenConfigs,
  fileTypeAccepts,
  parsePermissionKeys,
  parsePrivateKeyCustodyModel,
  resolveLicenseMimeType,
  serializePermissionSelections,
  serializePrivateKeyCustodyModel,
  type SpAccessBasicValues,
  type TokenConfigState,
} from './sp-access-form-utils';

interface FileState {
  fileId?: number;
}

export interface SpAccessFormController {
  router: ReturnType<typeof useRouter>;
  t: ReturnType<typeof useTranslations<'modules.sp-access'>>;
  tc: ReturnType<typeof useTranslations<'common'>>;
  isEditMode: boolean;
  detail?: SpAccessDetail;
  detailLoading: boolean;
  walletRules: SpAccessWalletRule[];
  typeOptions: SpAccessTypeOption[];
  tokenConfigs: Record<string, TokenConfigState>;
  updateTokenConfig: (stablecoinId: string, updater: (current: TokenConfigState) => TokenConfigState) => void;
  togglePermissionKey: (
    stablecoinId: string,
    field: 'apiPermissionKeys' | 'contractPermissionKeys',
    key: string,
    checked: boolean,
  ) => void;
  basic: SpAccessBasicValues;
  setBasic: React.Dispatch<React.SetStateAction<SpAccessBasicValues>>;
  description: string;
  setDescription: React.Dispatch<React.SetStateAction<string>>;
  metaEnabled: boolean;
  setMetaEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  reconciliation: string;
  setReconciliation: React.Dispatch<React.SetStateAction<string>>;
  custodySelection: string[];
  setCustodySelection: React.Dispatch<React.SetStateAction<string[]>>;
  fileState: FileState;
  uploadingFile: boolean;
  submitting: boolean;
  mutationPending: boolean;
  formError: string | null;
  licenseLoading: boolean;
  licensePreviewUrl: string | null;
  selectedTokenCount: number;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export function useSpAccessForm(): SpAccessFormController {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('modules.sp-access');
  const tc = useTranslations('common');
  const rawId = searchParams.get('id');
  const parsedId = rawId ? Number(rawId) : Number.NaN;
  const spId = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : undefined;
  const spCode = searchParams.get('spCode') ?? '';
  const isEditMode = Boolean(spId && spCode);

  const { data: detail, isLoading: detailLoading } = useSpAccessDetailQuery(isEditMode ? spId : undefined);
  const { data: walletRulesData } = useSpAccessWalletRulesQuery();
  const { data: typeOptionsData } = useSpAccessTypeOptionsQuery();
  const { mutateAsync: createSpAccess, isPending: createPending } = useCreateSpAccessMutation();
  const { mutateAsync: updateSpAccess, isPending: updatePending } = useUpdateSpAccessMutation();
  const walletRules = walletRulesData ?? [];
  const typeOptions = typeOptionsData ?? [];

  const sftpParams = React.useMemo(() => {
    if (!isEditMode || !detail?.spId) return null;
    return {
      busType: detail.busType && Number(detail.busType) > 0 ? Number(detail.busType) : Number(BUSINESS_LICENSE_BUS_TYPE),
      // base64 preview is keyed by service-provider id, not uploaded file id.
      busId: Number(detail.spId),
    };
  }, [detail?.busType, detail?.spId, isEditMode]);
  const { data: licenseBase64, isLoading: licenseLoading } = useSpAccessSftpBase64Query(sftpParams);

  const [tokenConfigs, setTokenConfigs] = React.useState<Record<string, TokenConfigState>>({});
  const [fileState, setFileState] = React.useState<FileState>({});
  const [uploadingFile, setUploadingFile] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [metaEnabled, setMetaEnabled] = React.useState(false);
  const [reconciliation, setReconciliation] = React.useState('1');
  const [custodySelection, setCustodySelection] = React.useState<string[]>([...DEFAULT_PRIVATE_KEY_CUSTODY_MODEL]);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [basic, setBasic] = React.useState<SpAccessBasicValues>({
    spName: '',
    spType: '1',
    contactName: '',
    email: '',
    phone: '',
  });
  const populatedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isEditMode || !detail || !walletRules.length || populatedRef.current) return;
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
    setReconciliation(['1', '2', '3'].includes(String(detail.reconciliationFrequency)) ? String(detail.reconciliationFrequency) : '1');
    setCustodySelection(parsePrivateKeyCustodyModel(detail.privateKeyCustodyModel));
    setFileState({ fileId: detail.fileId != null ? Number(detail.fileId) : undefined });
    const stateAllows = (walletRuleId: number) =>
      !walletRules.some((rule) => rule.walletRules.some((option) => option.walletRuleId === walletRuleId && option.state === 0));
    const next = Object.fromEntries(
      walletRules.map((rule) => {
        const matchedTd = detail.tdList?.find((td) => Number(td.tdId) === Number(rule.stablecoinId));
        const accessList = matchedTd?.accessList ?? [];
        const permissionKeys = (accessType: number) => {
          const access = accessList.find((item) => Number(item.accessType) === accessType);
          return parsePermissionKeys(
            access?.typeAndPermissionList ?? access?.permissionsList,
            stateAllows,
          );
        };
        return [String(rule.stablecoinId), {
          enabled: Boolean(matchedTd),
          walletAddress: matchedTd?.walletAddress ?? '',
          contractAddress: matchedTd?.contractAddress ?? '',
          webhookUrl: matchedTd?.webhookUrl ?? '',
          apiPermissionKeys: permissionKeys(API_ACCESS_TYPE),
          contractPermissionKeys: permissionKeys(CONTRACT_ACCESS_TYPE),
        } satisfies TokenConfigState];
      }),
    );
    setTokenConfigs(next);
  }, [detail, isEditMode, walletRules]);

  React.useEffect(() => {
    if (!isEditMode && walletRules.length) {
      setTokenConfigs((previous) => Object.keys(previous).length ? previous : createEmptyTokenConfigs(walletRules));
    }
  }, [isEditMode, walletRules]);

  const updateTokenConfig = React.useCallback(
    (stablecoinId: string, updater: (current: TokenConfigState) => TokenConfigState) => {
      setTokenConfigs((previous) => {
        const current = previous[stablecoinId];
        return current ? { ...previous, [stablecoinId]: updater(current) } : previous;
      });
    },
    [],
  );

  const togglePermissionKey = React.useCallback(
    (stablecoinId: string, field: 'apiPermissionKeys' | 'contractPermissionKeys', key: string, checked: boolean) => {
      updateTokenConfig(stablecoinId, fieldState => {
        const next = new Set(fieldState[field]);
        if (checked) next.add(key); else next.delete(key);
        return { ...fieldState, [field]: next };
      });
    },
    [updateTokenConfig],
  );

  const handleFileChange = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
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
  }, [detail?.fileId, isEditMode, t]);

  const buildTdAccessList = React.useCallback((): SpAccessSaveTdPayload[] =>
    walletRules.flatMap((rule: SpAccessWalletRule) => {
      const config = tokenConfigs[String(rule.stablecoinId)];
      if (!config?.enabled) return [];
      const contractPermissionsList = serializePermissionSelections(config.contractPermissionKeys);
      const accessList: SpAccessSaveAccessPayload[] = [
        { accessType: API_ACCESS_TYPE, transactionToggle: 1, permissionsList: serializePermissionSelections(config.apiPermissionKeys) },
        ...(config.contractAddress.trim() && contractPermissionsList.length
          ? [{ accessType: CONTRACT_ACCESS_TYPE, transactionToggle: 1, permissionsList: contractPermissionsList }]
          : []),
      ];
      return [{
        tdId: Number(rule.stablecoinId),
        walletAddress: config.walletAddress.trim(),
        contractAddress: config.contractAddress.trim(),
        accessList,
        kycRequired: KYC_REQUIRED_FIXED,
        webhookUrl: config.webhookUrl.trim(),
      }];
    }),
    [tokenConfigs, walletRules],
  );

  const onSubmit = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (uploadingFile) return setFormError(t('sp_access_0169'));
    const fileId = fileState.fileId ?? (detail?.fileId != null ? Number(detail.fileId) : undefined);
    if (!fileId) return setFormError(t('sp_access_0170'));
    if (!isEditMode && !basic.spName.trim()) return setFormError(t('sp_access_0185'));
    if (!basic.spType) return setFormError(t('sp_access_0197'));
    if (!custodySelection.length) return setFormError(t('sp_access_0172'));
    if (!description.trim()) return setFormError(t('sp_access_0198'));
    if (!basic.contactName.trim()) return setFormError(t('sp_access_0186'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(basic.email.trim())) return setFormError(t('sp_access_0182'));
    const enabledConfigs = walletRules
      .map((rule) => tokenConfigs[String(rule.stablecoinId)])
      .filter((config): config is TokenConfigState => Boolean(config?.enabled));
    if (!enabledConfigs.length) return setFormError(t('sp_access_0171'));
    for (const config of enabledConfigs) {
      if (!config.walletAddress.trim()) return setFormError(t('sp_access_0199'));
      if (!config.apiPermissionKeys.size) return setFormError(t('sp_access_0183'));
      if (config.contractAddress.trim() && !config.contractPermissionKeys.size) {
        return setFormError(t('sp_access_0191'));
      }
    }
    const tdAccessList = buildTdAccessList();
    const payload: SpAccessSavePayload = {
      contactName: basic.contactName.trim(),
      email: basic.email.trim(),
      phone: basic.phone.trim(),
      description: description.trim(),
      fileId,
      tdAccessList,
      spType: Number(basic.spType),
      metaType: metaEnabled ? META_TYPE_ENABLED : META_TYPE_DISABLED,
      reconciliationFrequency: Number(reconciliation) || 1,
      privateKeyCustodyModel: serializePrivateKeyCustodyModel(custodySelection),
      transactionPolicy: TRANSACTION_POLICY_FIXED,
    };
    setSubmitting(true);
    try {
      if (isEditMode) {
        await updateSpAccess({ spCode, spName: detail?.spName || basic.spName, ...payload });
      } else {
        await createSpAccess({ spName: basic.spName.trim(), ...payload });
      }
      toast.success(t('sp_access_0174'));
      router.push('/sp-access');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('sp_access_0175'));
    } finally {
      setSubmitting(false);
    }
  }, [basic, buildTdAccessList, createSpAccess, custodySelection, description, detail?.fileId, detail?.spName, fileState.fileId, isEditMode, metaEnabled, reconciliation, router, spCode, t, tokenConfigs, uploadingFile, updateSpAccess, walletRules]);

  return {
    router, t, tc, isEditMode, detail, detailLoading, walletRules, typeOptions, tokenConfigs,
    updateTokenConfig, togglePermissionKey, basic, setBasic, description, setDescription,
    metaEnabled, setMetaEnabled, reconciliation, setReconciliation, custodySelection, setCustodySelection,
    fileState, uploadingFile, submitting, mutationPending: createPending || updatePending, formError,
    licenseLoading, licensePreviewUrl: licenseBase64 ? `data:${resolveLicenseMimeType(detail?.fileType)};base64,${licenseBase64}` : null,
    selectedTokenCount: Object.values(tokenConfigs).filter((config) => config.enabled).length,
    handleFileChange, onSubmit,
  };
}
