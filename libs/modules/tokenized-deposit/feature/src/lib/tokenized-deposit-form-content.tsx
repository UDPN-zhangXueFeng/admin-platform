'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { useAuth } from '@myorg/shared/util-auth';
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
} from '@myorg/modules/tokenized-deposit/util';

import { GenerateWalletModal } from './tokenized-deposit-edit/generate-wallet-modal';
import { RigsecWalletModal } from './tokenized-deposit-edit/rigsec-wallet-modal';
import { useDetailInit } from './tokenized-deposit-edit/hooks/use-detail-init';
import { useCoaSetup } from './tokenized-deposit-edit/hooks/use-coa-setup';
import { useKeyService } from './tokenized-deposit-edit/hooks/use-key-service';
import { useWalletManagement } from './tokenized-deposit-edit/hooks/use-wallet-management';
import { useBlockchainEffect } from './tokenized-deposit-edit/hooks/use-blockchain-effect';
import { useTokenizedDepositSubmit } from './tokenized-deposit-edit/hooks/use-tokenized-deposit-submit';

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
export interface UseTokenizedDepositFormParams {
  /** 'add' = Onboard 新建态；'edit' = Edit 编辑态（需 code 回填） */
  mode: 'add' | 'edit';
  /** 编辑态的记录 code（来自 query.code）；add 态恒 undefined */
  code?: string;
}

/** 源 initialValues 默认值（useForm defaultValues / Reset / 草稿恢复的公共基底）。 */
const DEFAULT_FORM_VALUES = {
  mintMethod: MINT_METHOD.STABLECOIN,
  usPrice: '1',
  accountTypeList: [1],
  whitelistMode: 'full',
  thresholdType: 'volume',
  thresholdFrequency: 'daily',
  enableTokenReconciliation: RECON_DISABLED,
  enableReserveAssetReconciliation: RECON_DISABLED,
} as TDEditFormValues;

/** RHF field 与实际可聚焦控件的稳定映射（Radix Select 不会注册原生 ref）。 */
const VALIDATION_TARGET_IDS: Partial<Record<keyof TDEditFormValues, string>> =
  {
    mintMethod: 'field-mintMethod',
    name: 'field-name',
    symbol: 'field-symbol',
    decimals: 'field-decimals',
    currencySymbol: 'select-currencySymbol',
    usPrice: 'field-usPrice',
    reserveAccountId: 'select-reserveAccountId',
    blockchainId: 'select-blockchainId',
    smartContractPackageId: 'select-smartContractPackageId',
    metaType: 'field-metaType',
    whitelistMode: 'select-whitelistMode',
    accountTypeList: 'account-type-1',
    keyServiceName: 'select-keyServiceName',
    walletAddressContractOwner: 'field-walletAddressContractOwner',
    walletAddressPaymentOfGasFee: 'field-walletAddressPaymentOfGasFee',
    walletAddressManagementWallet: 'field-walletAddressManagementWallet',
    keyStoreContractOwner: 'field-keyStoreContractOwner',
    keyStorePaymentOfGasFee: 'field-keyStorePaymentOfGasFee',
    keyStoreManagementWallet: 'field-keyStoreManagementWallet',
    passWordContractOwner: 'field-passWordContractOwner',
    passWordPaymentOfGasFee: 'field-passWordPaymentOfGasFee',
    passWordManagementWallet: 'field-passWordManagementWallet',
  };

/** add 模式向导步骤 key（顺序对齐 steps 数组：basic/finance/custody/review）。 */
const WIZARD_STEP_KEYS = ['basic', 'finance', 'custody', 'review'] as const;

export function useTokenizedDepositForm({
  mode,
  code,
}: UseTokenizedDepositFormParams) {
  const t = useTranslations('modules.tokenized-deposit');
  const router = useRouter();
  const { user } = useAuth();
  const hasCode = mode === 'edit' && !!code;
  const [currentStep, setCurrentStep] = React.useState(0);
  const [maxReachedStep, setMaxReachedStep] = React.useState(0);

  // ── 草稿作用域（按用户隔离；anon 兜底对齐 draftKey 契约）──
  const draftScope = React.useMemo(() => ({ userId: user?.id }), [user?.id]);

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
  const [tokenType, setTokenTypeId] = React.useState(
    MINT_METHOD.STABLECOIN,
  );
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
  /** 自动保存失败提示节流：首次失败弹一次，成功后再允许重弹。 */
  const draftSaveWarnedRef = React.useRef(false);
  /** 草稿恢复后待 Options 异步校验标记（restoreRef 触发一次，校验完置 false）。 */
  const restoredPendingRef = React.useRef(false);
  /** COA 本地 state 不在 RHF 内，单独追踪 touched 供自动保存判断。 */
  const coaTouchedRef = React.useRef(false);
  /** G3：查询失败 toast 节流（任一查询失败弹一次，全部恢复后重置）。 */
  const queryErrorToastedRef = React.useRef(false);
  const [resetConfirmOpen, setResetConfirmOpen] = React.useState(false);

  // ── 3 公共下拉（声明式）──
  const { data: blockchainList } = useBlockchainOptionsQuery();
  const { data: currencyList } = useCurrencyOptionsQuery();
  const { data: tokenTypeOptions } = useTokenTypeOptionsQuery();

  // ── reserveList / smartContractNameList（声明式 query，桥接源本地 state）──
  const { data: reserveList, isError: reserveQueryError } =
    useReserveListQuery(reserveCurrency);
  const { data: smartContractNameList, isError: contractQueryError } =
    useSmartContractOptionsQuery({
      contractLanguage,
      tokenType,
    });

  // ── keyService（声明式监听 blockchainId）──
  const { keyServiceList, isError: keyServiceError } = useKeyService({
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
    coaQueryError,
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
    clearDraft(draftScope);
  }, [draftScope]);

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
      form.setValue('mintMethod', value);
      setFlag(value === MINT_METHOD.TOKENIZED_DEPOSIT);
      setTokenTypeId(value);
      form.setValue('smartContractPackageId', '');
      // P0-1：按类型统一清理不适用字段（文档 14.1 表），避免类型切换后残留污染 payload。
      if (value === MINT_METHOD.STABLECOIN) {
        form.setValue('accountTypeList', [1]);
      } else if (value === MINT_METHOD.TOKENIZED_DEPOSIT) {
        form.setValue('accountTypeList', [1]);
        form.setValue('reserveAccountId', undefined);
        form.setValue('enableReserveAssetReconciliation', RECON_DISABLED);
      } else if (value === MINT_METHOD.MMF) {
        form.setValue('accountTypeList', [3]);
        form.setValue('reserveAccountId', undefined);
        form.setValue('enableReserveAssetReconciliation', RECON_DISABLED);
      }
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
    const draft = loadDraft(draftScope);
    if (draft) {
      setDraftBanner({ savedAt: draft.savedAt });
    } else {
      draftReadyRef.current = true;
    }
  }, [mode, draftScope]);

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
      // DRAFT-GAP-4：保存失败提示一次（节流，成功后重置允许再弹）
      const ok = saveDraft(draftScope, formValues, {
        tokenizedDeposit: tokenizedDepositCoaData,
        stablecoin: stablecoinCoaData,
      });
      if (!ok) {
        if (!draftSaveWarnedRef.current) {
          draftSaveWarnedRef.current = true;
          toast.warning(t('td_toast_draft_save_failed'));
        }
      } else {
        draftSaveWarnedRef.current = false;
      }
    }, 400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    mode,
    draftScope,
    formValues,
    tokenizedDepositCoaData,
    stablecoinCoaData,
    isFormDirty,
    t,
  ]);

  // ── 草稿：恢复（钱包/keystore/密码不缓存，恢复后保持为空）──
  const restoreDraft = React.useCallback(() => {
    const draft = loadDraft(draftScope);
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
      setTokenTypeId(
        draft.formValues.mintMethod ?? MINT_METHOD.STABLECOIN,
      );
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
    // 触发 DRAFT-GAP-2：Options 加载后异步校验 reserve/contract/keyService 有效性
    restoredPendingRef.current = !!draft;
    setDraftBanner(null);
    draftReadyRef.current = true;
  }, [
    form,
    blockchainList,
    draftScope,
    setTokenizedDepositCoaData,
    setStablecoinCoaData,
    t,
  ]);

  const discardDraft = React.useCallback(() => {
    clearDraft(draftScope);
    setDraftBanner(null);
    draftReadyRef.current = true;
  }, [draftScope]);

  // ── Reset application（清草稿 + 默认值 + 重放 mount 默认链/币种）──
  const handleReset = React.useCallback(() => {
    const prevChain = form.getValues('blockchainId');
    clearDraft(draftScope);
    coaTouchedRef.current = false;
    // G2：显式清钱包字段（DEFAULT_FORM_VALUES 不含钱包，与 restoreDraft 一致确保清空）
    form.reset({
      ...DEFAULT_FORM_VALUES,
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
    setTokenizedDepositCoaData(null);
    setStablecoinCoaData(null);
    setTokenizedDepositCoaErrors({});
    setStablecoinCoaErrors({});
    setDetailInfo({});
    setFlag(false);
    setTokenTypeId(MINT_METHOD.STABLECOIN);
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
    draftScope,
    keyServiceList,
    setTokenizedDepositCoaData,
    setStablecoinCoaData,
    setTokenizedDepositCoaErrors,
    setStablecoinCoaErrors,
    t,
  ]);

  // ── G6：Stablecoin 下 Reserve 自动选首项（add only；TanStack Query 已无竞态）──
  React.useEffect(() => {
    if (mode !== 'add') return;
    if (mintMethod !== MINT_METHOD.STABLECOIN) return;
    // 当用户在 effect 提交前切换类型时，过期闭包不能把 Reserve 写回新类型。
    if (form.getValues('mintMethod') !== MINT_METHOD.STABLECOIN) return;
    const current = form.getValues('reserveAccountId');
    if (!reserveList || reserveList.length === 0) {
      if (current !== undefined && current !== null) {
        form.setValue('reserveAccountId', undefined);
      }
      return;
    }
    const exists = reserveList.some(
      (r) => String(r.reserveAccountId) === String(current),
    );
    if (!exists) {
      form.setValue(
        'reserveAccountId',
        reserveList[0].reserveAccountId as number,
      );
    }
  }, [mode, mintMethod, reserveList, form]);

  // ── DRAFT-GAP-2：草稿恢复后异步校验 reserve/contract/keyService 是否仍存在于最新 Options ──
  // restoredPendingRef 在 restoreDraft 置 true；等三类 Options 全部加载后校验一次，清失效值。
  React.useEffect(() => {
    if (!restoredPendingRef.current) return;
    if (!reserveList || !smartContractNameList || !keyServiceList) return;
    let cleared = false;
    const ra = form.getValues('reserveAccountId');
    if (
      ra !== undefined &&
      ra !== null &&
      !reserveList.some((r) => String(r.reserveAccountId) === String(ra))
    ) {
      form.setValue('reserveAccountId', undefined);
      cleared = true;
    }
    const sc = form.getValues('smartContractPackageId');
    if (
      sc &&
      !smartContractNameList.some((s) => String(s.key) === String(sc))
    ) {
      form.setValue('smartContractPackageId', '');
      cleared = true;
    }
    const ks = form.getValues('keyServiceName');
    if (ks && !keyServiceList.some((k) => k.keyServiceCode === ks)) {
      form.setValue('keyServiceName', '');
      cleared = true;
    }
    if (cleared) {
      toast.info(t('td_toast_keyservice_invalid'));
    }
    restoredPendingRef.current = false;
  }, [reserveList, smartContractNameList, keyServiceList, form, t]);

  // ── G3：查询加载失败统一反馈（reserve/contract/keyService/COA template/timezone）──
  React.useEffect(() => {
    const failed = [
      reserveQueryError,
      contractQueryError,
      keyServiceError,
      coaQueryError,
    ].some(Boolean);
    if (failed) {
      if (!queryErrorToastedRef.current) {
        queryErrorToastedRef.current = true;
        toast.error(t('td_query_load_failed'));
      }
    } else if (queryErrorToastedRef.current) {
      queryErrorToastedRef.current = false;
    }
  }, [reserveQueryError, contractQueryError, keyServiceError, coaQueryError, t]);

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

  const focusFirstInvalidField = React.useCallback(
    (fields: Array<keyof TDEditFormValues>) => {
      const fieldName = fields.find(
        (field) => form.getFieldState(field).invalid,
      );
      const targetId = fieldName ? VALIDATION_TARGET_IDS[fieldName] : undefined;
      if (!targetId) return;

      requestAnimationFrame(() => {
        const target = document.getElementById(targetId);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.focus({ preventScroll: true });
      });
    },
    [form],
  );

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
    if (!(await validateStep(currentStep))) {
      const fieldsByStep: Array<Array<keyof TDEditFormValues>> = [
        [
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
          'reserveAccountId',
        ],
        ['accountTypeList'],
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
      ];
      focusFirstInvalidField(fieldsByStep[currentStep] ?? []);
      toast.error(t('td_toast_step_incomplete'));
      return;
    }
    const nextStep = Math.min(currentStep + 1, steps.length - 1);
    setCurrentStep(nextStep);
    setMaxReachedStep((value) => Math.max(value, nextStep));
    scrollToForm();
  }, [
    currentStep,
    focusFirstInvalidField,
    scrollToForm,
    steps.length,
    t,
    validateStep,
  ]);

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

  return {
    mode,
    code,
    hasCode,
    t,
    router,
    form,
    form1,
    formValues,
    nameValue,
    symbol,
    currency,
    blockchain,
    mintMethod,
    reserveAccountId,
    keyServiceName,
    thresholdType,
    reserveReconValue,
    smartContractPackageId,
    ownerWalletAddr,
    gasWalletAddr,
    mgmtWalletAddr,
    detailInfo,
    setDetailInfo,
    flag,
    setFlag,
    contractLanguage,
    setContractLanguage,
    chainType,
    setChainType,
    tokenType,
    setTokenTypeId,
    reserveCurrency,
    setReserveCurrency,
    draftBanner,
    setDraftBanner,
    draftReadyRef,
    saveTimerRef,
    suppressSelectFirstOnceRef,
    coaTouchedRef,
    resetConfirmOpen,
    setResetConfirmOpen,
    blockchainList,
    currencyList,
    tokenTypeOptions,
    reserveList,
    smartContractNameList,
    keyServiceList,
    keyServiceError,
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
    overwriteConfirm,
    setOverwriteConfirm,
    submitConfirm,
    setSubmitConfirm,
    confirmOverwrite,
    confirmSubmit,
    handleOverwriteConfirm,
    handleOverwriteCancel,
    handleSubmitConfirm,
    handleSubmitCancel,
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
    onBlockchainChange,
    handleSubmitSuccess,
    loading,
    onSubmit,
    onCurrencyChange,
    onTokenTypeChange,
    handleGenerateWalletCancel,
    handleRigsecCancel,
    restoreDraft,
    discardDraft,
    handleReset,
    validateStep,
    handleNextStep,
    goToStep,
    handlePreviousStep,
    currentStep,
    setCurrentStep,
    maxReachedStep,
    setMaxReachedStep,
    scrollToForm,
    handleTdCoaChangeTracked,
    handleScCoaChangeTracked,
    wizardSteps,
    applyStatus,
    pageTitle,
    headerBadge,
    headerBadgeVariant,
    progress,
    progressStep,
    currentTypeLabel,
    currentBlockchainLabel,
    currentReserveLabel,
    currentContractLabel,
    currentKeyServiceLabel,
    steps,
    summaryRows,
    completedWallets,
    isFormDirty,
    sharedDialogs,
  };
}

export type TokenizedDepositFormState = ReturnType<typeof useTokenizedDepositForm>;
