'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Card,
  CardContent,
} from '@myorg/shared/ui';
import {
  useBlockchainOptionsQuery,
  useCurrencyOptionsQuery,
  useReserveListQuery,
  useSmartContractOptionsQuery,
  useTokenTypeOptionsQuery,
  type BlockchainOption,
  type CoaSetupInfo,
  type CoaSetupOption,
  type SmartContractOption,
  type TDEditDetail,
  type TDEditFormValues,
} from '@myorg/modules/tokenized-deposit/data-access';
import {
  MINT_METHOD,
  RECON_DISABLED,
  validateCoaSetup,
  saveDraft,
  loadDraft,
  clearDraft,
  formatDraftTime,
} from '@myorg/modules/tokenized-deposit/util';

import { TokenBasicInfoSection } from './tokenized-deposit-edit/token-basic-info-section';
import { ReconciliationConfigSection } from './tokenized-deposit-edit/reconciliation-config-section';
import { KeyCustodySection } from './tokenized-deposit-edit/key-custody-section';
import { AdminWalletSection } from './tokenized-deposit-edit/admin-wallet-section';
import { AccountTypeSection } from './tokenized-deposit-edit/account-type-section';
import { AccountConfigurationMMF } from './tokenized-deposit-edit/account-configuration-mmf';
import { GenerateWalletModal } from './tokenized-deposit-edit/generate-wallet-modal';
import { RigsecWalletModal } from './tokenized-deposit-edit/rigsec-wallet-modal';
import {
  BottomActionBar,
  OnboardHeader,
  SummaryAside,
} from './tokenized-deposit-edit/ui/page-shell';
import {
  WizardHeader,
  DraftBanner,
  WizardStepper,
  WizardFooter,
} from './tokenized-deposit-edit/ui/onboard-wizard';
import { CoaSetupCard } from '@myorg/modules/tokenized-deposit/ui';
import { useDetailInit } from './tokenized-deposit-edit/hooks/use-detail-init';
import { useCoaSetup } from './tokenized-deposit-edit/hooks/use-coa-setup';
import { useKeyService } from './tokenized-deposit-edit/hooks/use-key-service';
import { useWalletManagement } from './tokenized-deposit-edit/hooks/use-wallet-management';
import { useBlockchainEffect } from './tokenized-deposit-edit/hooks/use-blockchain-effect';
import { useTokenizedDepositSubmit } from './tokenized-deposit-edit/hooks/use-tokenized-deposit-submit';
import { OnboardReviewSection } from './tokenized-deposit-edit/onboard-review-section';

/**
 * TokenizedDepositFormContent —— add/edit 共享表单内核。
 *
 * 迁移自 td-manage `src/pages/tokenized-deposit/edit.tsx`（386 行）。承载完整的
 * add/edit 表单：useForm + 6 hooks(useDetailInit/useBlockchainEffect/useKeyService/
 * useCoaSetup/useWalletManagement/useTokenizedDepositSubmit) + 3 声明式 query + 8 sections
 * + 2 Modal + 2 AlertDialog。逻辑与原 EditPage 100% 一致，差异仅收敛到 `mode` 入参。
 *
 * ## add / edit 分流（mode 入参，替代原 query.code）
 *
 * - `mode='add'`（OnboardPage 调用，code 恒 undefined）：hasCode=false → useDetailInit
 *   不回填、useBlockchainEffect 设默认链/币种、submit 走 createMutation。
 * - `mode='edit'`（EditPage 调用，code 来自 query.code）：hasCode=true → useDetailInit
 *   回填、applyStatus===35 整页只读、submit 走 editMutation。
 *
 * hasCode 派生 `mode === 'edit' && !!code`，向下透传给所有 section/hook，其余逻辑零改动。
 *
 * ## 默认值（对齐源 initialValues）
 *
 * usPrice:'1' / accountTypeList:[1] / whitelistMode:'full' / thresholdType:'volume' /
 * thresholdFrequency:'daily' / enableTokenReconciliation:RECON_DISABLED /
 * enableReserveAssetReconciliation:RECON_DISABLED
 *
 * ## 命令式 ↔ 声明式桥接（源 useSWR/命令式 API → TanStack Query）
 *
 * reserveList/smartContractNameList 仍由 td-11 hooks 的命令式回调
 * (`getReserveList`/`getDeployInfo`) 驱动本地 state，再由声明式 query 消费——桥接语义
 * 与原 EditPage 完全一致。
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
export interface TokenizedDepositFormContentProps {
  /** 'add' = Onboard 新建态；'edit' = Edit 编辑态（需 code 回填） */
  mode: 'add' | 'edit';
  /** 编辑态的记录 code（来自 query.code）；add 态恒 undefined */
  code?: string;
}

/** 源 initialValues 默认值（useForm defaultValues / Reset / 草稿恢复的公共基底）。 */
const DEFAULT_FORM_VALUES = {
  usPrice: '1',
  accountTypeList: [1],
  whitelistMode: 'full',
  thresholdType: 'volume',
  thresholdFrequency: 'daily',
  enableTokenReconciliation: RECON_DISABLED,
  enableReserveAssetReconciliation: RECON_DISABLED,
} as TDEditFormValues;

/** add 模式向导步骤 key（顺序对齐 steps 数组：basic/finance/custody/review）。 */
const WIZARD_STEP_KEYS = ['basic', 'finance', 'custody', 'review'] as const;

export function TokenizedDepositFormContent({
  mode,
  code,
}: TokenizedDepositFormContentProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const router = useRouter();
  const hasCode = mode === 'edit' && !!code;
  const [currentStep, setCurrentStep] = React.useState(0);
  const [maxReachedStep, setMaxReachedStep] = React.useState(0);

  // ── 主表单（react-hook-form）──
  const form = useForm<TDEditFormValues>({
    defaultValues: DEFAULT_FORM_VALUES,
  });

  // ── keystore 密码 Modal 表单（源 form1，GenerateWallet keystore 路径 reset/提交）──
  const form1 = useForm<{ password?: string }>();

  // ── form watch（驱动联动 + 传 sections）──
  const nameValue = form.watch('name') as string | undefined;
  const symbol = form.watch('symbol') as string | undefined;
  const currency = form.watch('currencySymbol') as string | undefined;
  const blockchain = form.watch('blockchainId') as string | undefined;
  const mintMethod = form.watch('mintMethod') as number | undefined;
  const reserveAccountId = form.watch('reserveAccountId') as
    | string
    | number
    | undefined;
  const keyServiceName = form.watch('keyServiceName') as string | undefined;
  const thresholdType = form.watch('thresholdType') as string | undefined;
  const reserveReconValue = form.watch('enableReserveAssetReconciliation') as
    | number
    | undefined;
  // 派生 header 进度 / summary 用 watch（不改业务逻辑，纯展示）
  const smartContractPackageId = form.watch('smartContractPackageId') as
    | string
    | undefined;
  const ownerWalletAddr = form.watch(
    'walletAddressContractOwner' as keyof TDEditFormValues,
  ) as string | undefined;
  const gasWalletAddr = form.watch(
    'walletAddressPaymentOfGasFee' as keyof TDEditFormValues,
  ) as string | undefined;
  const mgmtWalletAddr = form.watch(
    'walletAddressManagementWallet' as keyof TDEditFormValues,
  ) as string | undefined;
  const formValues = form.watch();

  // ── edit 页本地 state（命令式↔声明式桥接用）──
  const [detailInfo, setDetailInfo] = React.useState<TDEditDetail>({});
  const [flag, setFlag] = React.useState(false);
  const [contractLanguage, setContractLanguage] = React.useState('');
  const [chainType, setChainType] = React.useState('evm');
  const [tokenType, setTokenTypeId] = React.useState(0);
  // currencySymbol 桥接 state：getReserveList 回调 set 它，useReserveListQuery 监听它。
  const [reserveCurrency, setReserveCurrency] = React.useState<
    string | undefined
  >(undefined);

  // ── 草稿（仅 add 模式；edit 不回填不自动保存）──
  const [draftBanner, setDraftBanner] = React.useState<{
    savedAt: number;
  } | null>(null);
  /** 恢复决定（Resume/Discard）或确认无草稿后才允许自动保存。 */
  const draftReadyRef = React.useRef(false);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 草稿恢复时跳过一次 keyService 默认选首项（保护恢复值）。 */
  const suppressSelectFirstOnceRef = React.useRef(false);
  /** COA 本地 state 不在 RHF 内，单独追踪 touched 供自动保存判断。 */
  const coaTouchedRef = React.useRef(false);
  const [resetConfirmOpen, setResetConfirmOpen] = React.useState(false);

  // ── 3 公共下拉（声明式）──
  const { data: blockchainList } = useBlockchainOptionsQuery();
  const { data: currencyList } = useCurrencyOptionsQuery();
  const { data: tokenTypeOptions } = useTokenTypeOptionsQuery();

  // ── reserveList / smartContractNameList（声明式 query，桥接源本地 state）──
  const { data: reserveList } = useReserveListQuery(reserveCurrency);
  const { data: smartContractNameList } = useSmartContractOptionsQuery({
    contractLanguage,
    tokenType,
  });

  // ── keyService（声明式监听 blockchainId）──
  const { keyServiceList } = useKeyService({
    form,
    blockchainId: blockchain,
    shouldSelectFirst: !hasCode,
    suppressSelectFirstOnceRef,
  });

  // ── COA 双套数据（useCoaSetup 派生 shouldShowXxx + 双套 data/errors）──
  const {
    stablecoinCoaData,
    stablecoinCoaErrors,
    stablecoinCoaReadonly,
    stablecoinCoaLoading,
    handleStablecoinCoaChange,
    tokenizedDepositCoaData,
    tokenizedDepositCoaErrors,
    handleTokenizedDepositCoaChange,
    coaTemplateOptions,
    coaTimezoneOptions,
    shouldShowSetupRequiredCoaSetup,
    shouldShowStablecoinCoaSetup,
    setStablecoinCoaData,
    setStablecoinCoaErrors,
    setTokenizedDepositCoaData,
    setTokenizedDepositCoaErrors,
  } = useCoaSetup({ mintMethod, reserveAccountId });

  // ── 双确认 AlertDialog state（替代源 antd modal.confirm）──
  const [overwriteConfirm, setOverwriteConfirm] = React.useState<{
    open: boolean;
    onOk: (() => void) | null;
  }>({ open: false, onOk: null });
  const [submitConfirm, setSubmitConfirm] = React.useState<{
    open: boolean;
    onOk: (() => Promise<void> | void) | null;
  }>({ open: false, onOk: null });

  const confirmOverwrite = React.useCallback((onOk: () => void) => {
    setOverwriteConfirm({ open: true, onOk });
  }, []);
  const confirmSubmit = React.useCallback(
    (onOk: () => Promise<void> | void) => {
      setSubmitConfirm({ open: true, onOk });
    },
    [],
  );

  // ── 钱包管理（双生成路径 + 回填 + 竞态保护）──
  const {
    isModalOpen,
    setIsModalOpen,
    isRigsecModalOpen,
    setIsRigsecModalOpen,
    walletAttribute,
    setWalletAttribute,
    walletAttributeOptions,
    defaultWalletAttribute,
    modalInfo,
    currentKeyService,
    shouldHideKeystoreAndPassword,
    shouldHideGenerateWalletAction,
    isAdminWalletDisabled,
    checkWalletAddress,
    setWalletInfo,
    handleRigsecSubmit,
    resetAdminWalletFields,
    setWalletFields,
    rigsecConfirmLoading,
  } = useWalletManagement({
    form,
    form1,
    code,
    detailInfo,
    blockchainList,
    keyServiceList,
    keyServiceName,
    chainType,
    blockchain,
    nameValue,
    confirmOverwrite,
  });

  // ── 回填（编辑态，code 存在时 useDetailInit 内部 useTDOperationEditDetailQuery）──
  useDetailInit({
    form,
    code,
    contractLanguage,
    blockchainList,
    getDeployInfo: (lang, type) => {
      setContractLanguage(lang);
      setTokenTypeId(type);
    },
    setWalletFields,
    setDetailInfo,
    setFlag,
    setTokenTypeId,
    setTokenizedDepositCoaData,
    setTokenizedDepositCoaErrors,
    setStablecoinCoaData,
    setStablecoinCoaErrors,
  });

  // ── 区块链联动（mount 默认值 + 切链回调）──
  const onBlockchainChange = useBlockchainEffect({
    form,
    code,
    currencyList,
    blockchainList,
    tokenType,
    getReserveList: (currencySymbol) => setReserveCurrency(currencySymbol),
    getDeployInfo: (lang, type) => {
      setContractLanguage(lang);
      setTokenTypeId(type);
    },
    getKeyServiceList: () => {
      // no-op：useKeyService 已声明式监听 blockchainId，切链自动重查。
    },
    resetAdminWalletFields,
    setContractLanguage,
    setChainType,
    setTokenTypeId,
  });

  // ── 提交成功附加动作（仅 add：清草稿并停自动保存，防清后重存）──
  const handleSubmitSuccess = React.useCallback(() => {
    draftReadyRef.current = false;
    clearDraft();
  }, []);

  // ── 提交（新增 useCreateTDApplyMutation / 编辑 useEditTDOperationMutation）──
  const { loading, onSubmit } = useTokenizedDepositSubmit({
    confirmSubmit,
    routerBack: () => router.back(),
    successMessageKey: 'PUB_Success',
    code,
    detailInfo,
    keyServiceList,
    reserveAccountId,
    tokenizedDepositCoaData,
    stablecoinCoaData,
    timezoneOptions: coaTimezoneOptions as CoaSetupOption[] | undefined,
    stablecoinCoaReadonly,
    setTokenizedDepositCoaErrors,
    setStablecoinCoaErrors,
    onSubmitSuccess: mode === 'add' ? handleSubmitSuccess : undefined,
  });

  // ── handlers（onCurrencyChange / onTokenTypeChange / Modal cancel）──
  const onCurrencyChange = React.useCallback(
    (value: string) => setReserveCurrency(value),
    [],
  );
  const onTokenTypeChange = React.useCallback(
    (value: number) => {
      setFlag(value === MINT_METHOD.TOKENIZED_DEPOSIT);
      setTokenTypeId(value);
      form.setValue('smartContractPackageId', '');
    },
    [form],
  );
  const handleGenerateWalletCancel = React.useCallback(() => {
    setIsModalOpen(false);
  }, [setIsModalOpen]);
  const handleRigsecCancel = React.useCallback(() => {
    setIsRigsecModalOpen(false);
    setWalletAttribute(defaultWalletAttribute);
  }, [defaultWalletAttribute, setIsRigsecModalOpen, setWalletAttribute]);

  // ── 草稿：mount 检测（仅 add；有草稿先弹横幅，决定前暂停自动保存）──
  React.useEffect(() => {
    if (mode !== 'add') return;
    const draft = loadDraft();
    if (draft) {
      setDraftBanner({ savedAt: draft.savedAt });
    } else {
      draftReadyRef.current = true;
    }
  }, [mode]);

  // ── 草稿：自动保存（400ms debounce）──
  // 仅「用户真实编辑过」（RHF isDirty 或 COA touched）才保存：mount 默认值
  // （useBlockchainEffect 的 setValue）不置 isDirty，避免 fresh 页产生默认值
  // 草稿、下次访问误弹恢复横幅；Reset/恢复后 isDirty 归 false，清除的草稿
  // 不会被立即重存。
  const isFormDirty = form.formState.isDirty;
  React.useEffect(() => {
    if (mode !== 'add' || !draftReadyRef.current) return;
    if (!isFormDirty && !coaTouchedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveDraft(formValues, {
        tokenizedDeposit: tokenizedDepositCoaData,
        stablecoin: stablecoinCoaData,
      });
    }, 400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    mode,
    formValues,
    tokenizedDepositCoaData,
    stablecoinCoaData,
    isFormDirty,
  ]);

  // ── 草稿：恢复（钱包/keystore/密码不缓存，恢复后保持为空）──
  const restoreDraft = React.useCallback(() => {
    const draft = loadDraft();
    if (draft) {
      // blockchainId 变化会触发 keyService 重查，置标记跳过默认选首项；
      // 同链（query 缓存命中、effect 不重跑）则无需跳过。
      if (draft.formValues.blockchainId !== form.getValues('blockchainId')) {
        suppressSelectFirstOnceRef.current = true;
      }
      form.reset({
        ...DEFAULT_FORM_VALUES,
        ...draft.formValues,
        walletAddressContractOwner: '',
        walletAddressPaymentOfGasFee: '',
        walletAddressManagementWallet: '',
        keyStoreContractOwner: '',
        keyStorePaymentOfGasFee: '',
        keyStoreManagementWallet: '',
        passWordContractOwner: '',
        passWordPaymentOfGasFee: '',
        passWordManagementWallet: '',
      });
      if (draft.coa.tokenizedDeposit) {
        setTokenizedDepositCoaData(draft.coa.tokenizedDeposit as CoaSetupInfo);
      }
      if (draft.coa.stablecoin) {
        setStablecoinCoaData(draft.coa.stablecoin as CoaSetupInfo);
      }
      // 重导桥接 state（声明式 query 依赖它们触发）
      if (draft.formValues.currencySymbol) {
        setReserveCurrency(draft.formValues.currencySymbol);
      }
      setTokenTypeId(draft.formValues.mintMethod ?? 0);
      setFlag(draft.formValues.mintMethod === MINT_METHOD.TOKENIZED_DEPOSIT);
      const chain = blockchainList?.find(
        (b) => b.key === draft.formValues.blockchainId,
      );
      if (chain) {
        setContractLanguage(
          String(
            (chain as BlockchainOption & { contractLanguage?: unknown })
              .contractLanguage ?? '',
          ),
        );
        setChainType(chain.virtualMachineCode ?? 'evm');
      }
      toast.info(t('td_toast_draft_restored'));
    }
    setDraftBanner(null);
    draftReadyRef.current = true;
  }, [
    form,
    blockchainList,
    setTokenizedDepositCoaData,
    setStablecoinCoaData,
    t,
  ]);

  const discardDraft = React.useCallback(() => {
    clearDraft();
    setDraftBanner(null);
    draftReadyRef.current = true;
  }, []);

  // ── Reset application（清草稿 + 默认值 + 重放 mount 默认链/币种）──
  const handleReset = React.useCallback(() => {
    const prevChain = form.getValues('blockchainId');
    clearDraft();
    coaTouchedRef.current = false;
    form.reset(DEFAULT_FORM_VALUES);
    setTokenizedDepositCoaData(null);
    setStablecoinCoaData(null);
    setTokenizedDepositCoaErrors({});
    setStablecoinCoaErrors({});
    setDetailInfo({});
    setFlag(false);
    setTokenTypeId(0);
    // 重放 useBlockchainEffect mount 默认值（effect 依赖未变不会自动重跑）
    const activeBlockchain = blockchainList?.find((b) => b.status === 1);
    form.setValue('decimals', 8);
    form.setValue('currencySymbol', currencyList?.[0]?.value);
    form.setValue('blockchainId', activeBlockchain?.key);
    if (currencyList?.[0]?.value) {
      setReserveCurrency(currencyList[0].value);
    }
    if (activeBlockchain) {
      setContractLanguage(
        String(
          (
            activeBlockchain as BlockchainOption & {
              contractLanguage?: unknown;
            }
          ).contractLanguage ?? '',
        ),
      );
      setChainType(activeBlockchain.virtualMachineCode ?? 'evm');
      if (activeBlockchain.virtualMachineCode === 'tron') {
        form.setValue('metaType', 1);
      }
    } else {
      setContractLanguage('');
      setChainType('evm');
    }
    // 链未变时 keyService query 缓存命中、select-first effect 不重跑，
    // 显式补选首项对齐 fresh mount 行为；链已变则由 effect 处理。
    if (
      activeBlockchain &&
      prevChain === activeBlockchain.key &&
      keyServiceList.length > 0
    ) {
      form.setValue('keyServiceName', keyServiceList[0]?.keyServiceCode ?? '');
    }
    setCurrentStep(0);
    setMaxReachedStep(0);
    setResetConfirmOpen(false);
    toast.info(t('td_toast_reset_done'));
  }, [
    form,
    blockchainList,
    currencyList,
    keyServiceList,
    setTokenizedDepositCoaData,
    setStablecoinCoaData,
    setTokenizedDepositCoaErrors,
    setStablecoinCoaErrors,
    t,
  ]);

  // ── AlertDialog 确认/取消 ──
  const handleOverwriteConfirm = React.useCallback(() => {
    setOverwriteConfirm((prev) => {
      prev.onOk?.();
      return { open: false, onOk: null };
    });
  }, []);
  const handleOverwriteCancel = React.useCallback(() => {
    setOverwriteConfirm({ open: false, onOk: null });
  }, []);
  const handleSubmitConfirm = React.useCallback(() => {
    const onOk = submitConfirm.onOk;
    setSubmitConfirm({ open: false, onOk: null });
    void onOk?.();
  }, [submitConfirm.onOk]);
  const handleSubmitCancel = React.useCallback(() => {
    setSubmitConfirm({ open: false, onOk: null });
  }, []);

  const applyStatus = detailInfo.applyStatus;

  // ── 页面标题（tokenized_deposit_0004 "**** Token "，replace 对齐源语义）──
  const pageTitle = t('tokenized_deposit_0004').replace(
    '****',
    hasCode ? t('Router_016') : t('tokenized_deposit_0132'),
  );
  const headerBadge = hasCode ? t('record_type_2') : t('td_draft_badge');
  const headerBadgeVariant: 'secondary' | 'outline' = hasCode
    ? 'secondary'
    : 'outline';

  // ── 进度 / summary 派生（纯展示，不改业务逻辑）──
  const completedWallets = [
    ownerWalletAddr,
    gasWalletAddr,
    mgmtWalletAddr,
  ].filter(Boolean).length;
  const progress = Math.min(
    92,
    28 +
      (nameValue ? 9 : 0) +
      (symbol ? 9 : 0) +
      (smartContractPackageId ? 12 : 0) +
      completedWallets * 8,
  );
  const progressStep = progress < 45 ? 0 : progress < 80 ? 1 : 2;
  const currentTypeLabel =
    tokenTypeOptions?.find(
      (item) => String(item.tokenTypeId) === String(mintMethod),
    )?.tokenTypeName ?? '';
  const currentBlockchainLabel =
    blockchainList?.find((item) => item.key === blockchain)?.value ?? '';
  const currentReserveLabel =
    reserveList?.find(
      (item) => String(item.reserveAccountId) === String(reserveAccountId),
    )?.reserveAccountName ?? '';
  const currentContractLabel =
    smartContractNameList?.find(
      (item) => String(item.key) === String(smartContractPackageId),
    )?.value ?? '';
  const currentKeyServiceLabel =
    keyServiceList?.find((item) => item.keyServiceCode === keyServiceName)
      ?.keyServiceName ?? '';
  const steps =
    mode === 'add'
      ? [
          { title: t('td_step_1_title'), sub: t('td_step_1_sub') },
          { title: t('td_form_finance_title'), sub: t('td_form_finance_desc') },
          { title: t('key_custody_title'), sub: t('td_section_custody_desc') },
          { title: t('td_form_review_title'), sub: t('td_form_review_desc') },
        ]
      : [
          { title: t('td_step_1_title'), sub: t('td_step_1_sub') },
          { title: t('td_step_2_title'), sub: t('td_step_2_sub') },
          { title: t('td_step_3_title'), sub: t('td_step_3_sub') },
        ];
  const summaryRows = [
    { label: t('td_summary_identity'), complete: !!(nameValue && symbol) },
    {
      label: t('td_summary_network'),
      complete: !!(blockchain && smartContractPackageId),
    },
    { label: t('td_summary_accounting'), complete: !!mintMethod },
    { label: t('td_summary_custody'), complete: !!keyServiceName },
    { label: t('td_summary_wallets'), complete: completedWallets === 3 },
  ];

  const scrollToForm = React.useCallback(() => {
    document
      .getElementById('td-onboard-form')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const validateStep = React.useCallback(
    async (index: number): Promise<boolean> => {
      if (index === 0) {
        const fields: Array<keyof TDEditFormValues> = [
          'mintMethod',
          'name',
          'symbol',
          'decimals',
          'currencySymbol',
          'usPrice',
          'blockchainId',
          'smartContractPackageId',
          'metaType',
          'whitelistMode',
        ];
        if (mintMethod === MINT_METHOD.STABLECOIN) {
          fields.push('reserveAccountId');
        }
        return form.trigger(fields, { shouldFocus: true });
      }

      if (index === 1) {
        const accountTypeValid =
          mintMethod === MINT_METHOD.TOKENIZED_DEPOSIT ||
          mintMethod === MINT_METHOD.MMF
            ? await form.trigger('accountTypeList', { shouldFocus: true })
            : true;

        if (shouldShowSetupRequiredCoaSetup) {
          const errors = validateCoaSetup(tokenizedDepositCoaData);
          setTokenizedDepositCoaErrors(errors);
          return accountTypeValid && Object.keys(errors).length === 0;
        }

        if (shouldShowStablecoinCoaSetup && !stablecoinCoaReadonly) {
          const errors = validateCoaSetup(stablecoinCoaData);
          setStablecoinCoaErrors(errors);
          return accountTypeValid && Object.keys(errors).length === 0;
        }

        return accountTypeValid;
      }

      if (index === 2) {
        return form.trigger(
          [
            'keyServiceName',
            'walletAddressContractOwner',
            'walletAddressPaymentOfGasFee',
            'walletAddressManagementWallet',
            'keyStoreContractOwner',
            'keyStorePaymentOfGasFee',
            'keyStoreManagementWallet',
            'passWordContractOwner',
            'passWordPaymentOfGasFee',
            'passWordManagementWallet',
          ],
          { shouldFocus: true },
        );
      }

      return true;
    },
    [
      form,
      mintMethod,
      setStablecoinCoaErrors,
      setTokenizedDepositCoaErrors,
      shouldShowSetupRequiredCoaSetup,
      shouldShowStablecoinCoaSetup,
      stablecoinCoaData,
      stablecoinCoaReadonly,
      tokenizedDepositCoaData,
    ],
  );

  const handleNextStep = React.useCallback(async () => {
    if (!(await validateStep(currentStep))) return;
    const nextStep = Math.min(currentStep + 1, steps.length - 1);
    setCurrentStep(nextStep);
    setMaxReachedStep((value) => Math.max(value, nextStep));
    scrollToForm();
  }, [currentStep, scrollToForm, steps.length, validateStep]);

  // Stepper 点击导航：回跳自由；前跳逐步校验，失败停在首个无效步并提示。
  const goToStep = React.useCallback(
    async (target: number) => {
      if (target <= currentStep) {
        setCurrentStep(target);
        scrollToForm();
        return;
      }
      for (let i = currentStep; i < target; i++) {
        if (!(await validateStep(i))) {
          setCurrentStep(i);
          toast.error(t('td_toast_step_incomplete'));
          scrollToForm();
          return;
        }
      }
      setCurrentStep(target);
      setMaxReachedStep((value) => Math.max(value, target));
      scrollToForm();
    },
    [currentStep, scrollToForm, validateStep, t],
  );

  const handlePreviousStep = React.useCallback(() => {
    setCurrentStep((value) => Math.max(0, value - 1));
    scrollToForm();
  }, [scrollToForm]);

  // ── COA onChange 包装（add 模式追踪 touched，供草稿自动保存判断）──
  const handleTdCoaChangeTracked = React.useCallback(
    (data: CoaSetupInfo) => {
      coaTouchedRef.current = true;
      handleTokenizedDepositCoaChange(data);
    },
    [handleTokenizedDepositCoaChange],
  );
  const handleScCoaChangeTracked = React.useCallback(
    (data: CoaSetupInfo) => {
      coaTouchedRef.current = true;
      handleStablecoinCoaChange(data);
    },
    [handleStablecoinCoaChange],
  );

  // ── add 模式向导步骤（key 顺序对齐 WIZARD_STEP_KEYS）──
  const wizardSteps = steps.map((s, i) => ({
    key: WIZARD_STEP_KEYS[i] ?? String(i),
    title: s.title,
    description: s.sub,
  }));

  // ── 共享 Modals / AlertDialogs（add/edit 两个 return 共用）──
  const sharedDialogs = (
    <>
      {/* ── keystore 密码 Modal ── */}
      <GenerateWalletModal
        open={isModalOpen}
        onCancel={handleGenerateWalletCancel}
        onSubmit={setWalletInfo}
      />

      {/* ── rigsec/fireblocks Hot/Cold Modal ── */}
      <RigsecWalletModal
        open={isRigsecModalOpen}
        modalInfo={modalInfo}
        walletAttribute={walletAttribute}
        walletAttributeOptions={walletAttributeOptions}
        loading={rigsecConfirmLoading}
        tokenName={nameValue}
        currentKeyService={currentKeyService}
        onWalletAttributeChange={setWalletAttribute}
        onCancel={handleRigsecCancel}
        onConfirm={handleRigsecSubmit}
      />

      {/* ── 双确认 AlertDialog（覆盖钱包 / 提交）── */}
      <AlertDialog
        open={overwriteConfirm.open}
        onOpenChange={(next) => !next && handleOverwriteCancel()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tokenized_deposit_0144')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('tokenized_deposit_0143')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleOverwriteCancel}>
              {t('PUB_Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleOverwriteConfirm}>
              {t('PUB_Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={submitConfirm.open}
        onOpenChange={(next) => !next && handleSubmitCancel()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tokenized_deposit_0144')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('tokenized_deposit_0143')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleSubmitCancel}>
              {t('PUB_Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmitConfirm}>
              {t('PUB_Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  // ── add 模式：参考向导布局（页头 → 草稿横幅 → 单卡片[Stepper+内容+Footer] → 脚注）──
  if (mode === 'add') {
    return (
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <WizardHeader
          eyebrow={t('td_onboard_eyebrow')}
          title={pageTitle}
          description={t('td_header_desc')}
        />

        {draftBanner ? (
          <DraftBanner
            text={t('td_draft_banner_text', {
              time: formatDraftTime(draftBanner.savedAt),
            })}
            resumeLabel={t('td_draft_resume')}
            discardLabel={t('td_draft_discard')}
            resumeDisabled={!blockchainList || !currencyList}
            onResume={restoreDraft}
            onDiscard={discardDraft}
          />
        ) : null}

        <main className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <WizardStepper
            steps={wizardSteps}
            current={currentStep}
            maxReached={maxReachedStep}
            onNavigate={goToStep}
            mobileCurrentLabel={`${t('td_form_step_of', {
              current: currentStep + 1,
              total: steps.length,
            })}: ${steps[currentStep]?.title ?? ''}`}
          />
          <form
            id="td-onboard-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className={loading ? 'pointer-events-none opacity-60' : ''}
          >
            <Card className="rounded-none border-0 shadow-none">
              <CardContent className="w-full p-5 sm:p-8 lg:p-10">
                <div className="mb-8 border-b border-border pb-5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('td_form_step_of', {
                      current: currentStep + 1,
                      total: steps.length,
                    })}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight">
                    {steps[currentStep].title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {steps[currentStep].sub}
                  </p>
                </div>

                {currentStep === 0 ? (
                  <TokenBasicInfoSection
                    control={form.control}
                    hasCode={hasCode}
                    detailInfo={detailInfo}
                    flag={flag}
                    chainType={chainType}
                    mintMethod={mintMethod}
                    symbol={symbol}
                    currency={currency}
                    thresholdType={thresholdType}
                    reserveList={reserveList}
                    blockchainList={
                      blockchainList as BlockchainOption[] | undefined
                    }
                    currencyList={currencyList}
                    smartContractNameList={
                      smartContractNameList as SmartContractOption[] | undefined
                    }
                    tokenTypeOptions={tokenTypeOptions ?? []}
                    onBlockchainChange={onBlockchainChange}
                    onCurrencyChange={onCurrencyChange}
                    onTokenTypeChange={onTokenTypeChange}
                  />
                ) : null}

                {currentStep === 1 ? (
                  <div className="flex flex-col gap-9">
                    {shouldShowSetupRequiredCoaSetup ? (
                      <CoaSetupCard
                        embedded
                        data={tokenizedDepositCoaData}
                        accountTemplateOptions={coaTemplateOptions}
                        timezoneOptions={coaTimezoneOptions}
                        errors={tokenizedDepositCoaErrors}
                        onChange={handleTdCoaChangeTracked}
                      />
                    ) : shouldShowStablecoinCoaSetup ? (
                      <CoaSetupCard
                        embedded
                        data={stablecoinCoaData}
                        loading={stablecoinCoaLoading}
                        readonly={stablecoinCoaReadonly}
                        accountTemplateOptions={coaTemplateOptions}
                        timezoneOptions={coaTimezoneOptions}
                        errors={stablecoinCoaErrors}
                        onChange={handleScCoaChangeTracked}
                      />
                    ) : (
                      <section>
                        <h3 className="text-sm font-semibold">
                          {t('tokenized_deposit_coa_title')}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {t('td_section_coa_desc')}
                        </p>
                        <div className="mt-5 rounded-md border bg-muted/50 p-4 text-sm text-muted-foreground">
                          {mintMethod === MINT_METHOD.MMF
                            ? t('td_form_mmf_no_coa')
                            : t('td_form_select_token_first')}
                        </div>
                      </section>
                    )}

                    {flag && mintMethod === MINT_METHOD.TOKENIZED_DEPOSIT ? (
                      <AccountTypeSection
                        embedded
                        control={form.control}
                        setValue={form.setValue}
                        getValues={form.getValues}
                        hasCode={hasCode}
                        applyStatus={applyStatus}
                      />
                    ) : null}
                    {mintMethod === MINT_METHOD.MMF ? (
                      <AccountConfigurationMMF
                        embedded
                        control={form.control}
                        setValue={form.setValue}
                        hasCode={hasCode}
                        applyStatus={applyStatus}
                      />
                    ) : null}
                    <ReconciliationConfigSection
                      embedded
                      control={form.control}
                      setValue={form.setValue}
                      hasCode={hasCode}
                      detailInfo={detailInfo}
                      reserveList={reserveList}
                      reserveAccountId={reserveAccountId}
                      reserveReconValue={reserveReconValue}
                      mintMethod={mintMethod}
                    />
                  </div>
                ) : null}

                {currentStep === 2 ? (
                  <div className="flex flex-col gap-9">
                    <KeyCustodySection
                      embedded
                      control={form.control}
                      hasCode={hasCode}
                      applyStatus={applyStatus}
                      keyServiceList={keyServiceList}
                      onKeyServiceChange={(value) => {
                        form.setValue('keyServiceName', value);
                        resetAdminWalletFields();
                      }}
                    />
                    <AdminWalletSection
                      embedded
                      control={form.control}
                      hasCode={hasCode}
                      applyStatus={applyStatus}
                      shouldHideKeystoreAndPassword={
                        shouldHideKeystoreAndPassword
                      }
                      shouldHideGenerateWalletAction={
                        shouldHideGenerateWalletAction
                      }
                      isAdminWalletDisabled={isAdminWalletDisabled}
                      onGenerateWallet={checkWalletAddress}
                    />
                  </div>
                ) : null}

                {currentStep === 3 ? (
                  <OnboardReviewSection
                    values={formValues}
                    tokenTypeLabel={currentTypeLabel}
                    blockchainLabel={currentBlockchainLabel}
                    contractLabel={currentContractLabel}
                    reserveLabel={currentReserveLabel}
                    keyServiceLabel={currentKeyServiceLabel}
                    financialBookName={
                      mintMethod === MINT_METHOD.TOKENIZED_DEPOSIT
                        ? tokenizedDepositCoaData.financialBookName
                        : stablecoinCoaData.financialBookName
                    }
                  />
                ) : null}
              </CardContent>
            </Card>
            <WizardFooter
              resetLabel={t('td_reset_application')}
              backLabel={t('td_form_previous')}
              continueLabel={t('td_form_continue')}
              submitLabel={t('PUB_Submit')}
              isFirstStep={currentStep === 0}
              isLastStep={currentStep === steps.length - 1}
              loading={loading}
              onReset={() => setResetConfirmOpen(true)}
              onBack={handlePreviousStep}
              onContinue={handleNextStep}
            />
          </form>
        </main>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t('td_autosave_note')}
        </p>

        {sharedDialogs}

        {/* ── Reset 确认 AlertDialog（destructive）── */}
        <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('td_reset_dialog_title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('td_reset_dialog_desc')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('PUB_Cancel')}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleReset}
              >
                {t('td_reset_application')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ── edit 模式：原有堆叠布局（OnboardHeader + 双栏 + SummaryAside + BottomActionBar）──
  return (
    <div className="flex flex-col">
      <OnboardHeader
        onBack={() => router.back()}
        backLabel={t('td_back_to_registry')}
        title={pageTitle}
        badge={headerBadge}
        badgeVariant={headerBadgeVariant}
        description={t('td_header_desc')}
        progressLabel={t('td_progress_label')}
        progress={progress}
        steps={steps}
        activeStep={progressStep}
        maxReachedStep={progressStep}
      />

      <div className="grid items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8">
        <form
          id="td-onboard-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className={`flex min-w-0 flex-col gap-6 ${
            loading ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          <>
            <TokenBasicInfoSection
              control={form.control}
              hasCode={hasCode}
              detailInfo={detailInfo}
              flag={flag}
              chainType={chainType}
              mintMethod={mintMethod}
              symbol={symbol}
              currency={currency}
              thresholdType={thresholdType}
              reserveList={reserveList}
              blockchainList={blockchainList as BlockchainOption[] | undefined}
              currencyList={currencyList}
              smartContractNameList={
                smartContractNameList as SmartContractOption[] | undefined
              }
              tokenTypeOptions={tokenTypeOptions ?? []}
              onBlockchainChange={onBlockchainChange}
              onCurrencyChange={onCurrencyChange}
              onTokenTypeChange={onTokenTypeChange}
            />
            {shouldShowSetupRequiredCoaSetup ? (
              <CoaSetupCard
                data={tokenizedDepositCoaData}
                accountTemplateOptions={coaTemplateOptions}
                timezoneOptions={coaTimezoneOptions}
                errors={tokenizedDepositCoaErrors}
                onChange={handleTokenizedDepositCoaChange}
              />
            ) : null}
            {shouldShowStablecoinCoaSetup ? (
              <CoaSetupCard
                data={stablecoinCoaData}
                loading={stablecoinCoaLoading}
                readonly={stablecoinCoaReadonly}
                accountTemplateOptions={coaTemplateOptions}
                timezoneOptions={coaTimezoneOptions}
                errors={stablecoinCoaErrors}
                onChange={handleStablecoinCoaChange}
              />
            ) : null}
            {flag && mintMethod === MINT_METHOD.TOKENIZED_DEPOSIT ? (
              <AccountTypeSection
                control={form.control}
                setValue={form.setValue}
                getValues={form.getValues}
                hasCode={hasCode}
                applyStatus={applyStatus}
              />
            ) : null}
            {mintMethod === MINT_METHOD.MMF ? (
              <AccountConfigurationMMF
                control={form.control}
                setValue={form.setValue}
                hasCode={hasCode}
                applyStatus={applyStatus}
              />
            ) : null}
            <ReconciliationConfigSection
              control={form.control}
              setValue={form.setValue}
              hasCode={hasCode}
              detailInfo={detailInfo}
              reserveList={reserveList}
              reserveAccountId={reserveAccountId}
              reserveReconValue={reserveReconValue}
              mintMethod={mintMethod}
            />
            <KeyCustodySection
              control={form.control}
              hasCode={hasCode}
              applyStatus={applyStatus}
              keyServiceList={keyServiceList}
              onKeyServiceChange={(value) => {
                form.setValue('keyServiceName', value);
                resetAdminWalletFields();
              }}
            />
            <AdminWalletSection
              control={form.control}
              hasCode={hasCode}
              applyStatus={applyStatus}
              shouldHideKeystoreAndPassword={shouldHideKeystoreAndPassword}
              shouldHideGenerateWalletAction={shouldHideGenerateWalletAction}
              isAdminWalletDisabled={isAdminWalletDisabled}
              onGenerateWallet={checkWalletAddress}
            />
          </>
        </form>

        <SummaryAside
          title={t('td_summary_title')}
          description={t('td_summary_desc')}
          tokenTypeLabelLabel={t('tokenized_deposit_0062')}
          tokenTypeLabel={currentTypeLabel}
          rows={summaryRows}
          deployNetworkLabelLabel={t('td_summary_deploy_network')}
          deployNetworkLabel={currentBlockchainLabel}
          completeLabel={t('td_summary_complete')}
          requiredLabel={t('td_summary_required')}
          walletsIncompleteAlert={
            completedWallets < 3
              ? {
                  title: t('td_summary_wallets_alert_title'),
                  description: t('td_summary_wallets_alert_desc'),
                }
              : null
          }
        />
      </div>

      <BottomActionBar
        onBack={() => router.back()}
        backLabel={t('PUB_GoBack')}
        submitLabel={t('PUB_Submit')}
        loading={loading}
        formId="td-onboard-form"
      />

      {sharedDialogs}
    </div>
  );
}
