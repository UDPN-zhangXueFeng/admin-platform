'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
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
  type CoaSetupOption,
  type SmartContractOption,
  type TDEditDetail,
  type TDEditFormValues,
} from '@myorg/modules/tokenized-deposit/data-access';
import { MINT_METHOD, RECON_DISABLED } from '@myorg/modules/tokenized-deposit/util';

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
import { CoaSetupCard } from '@myorg/modules/tokenized-deposit/ui';
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
export interface TokenizedDepositFormContentProps {
  /** 'add' = Onboard 新建态；'edit' = Edit 编辑态（需 code 回填） */
  mode: 'add' | 'edit';
  /** 编辑态的记录 code（来自 query.code）；add 态恒 undefined */
  code?: string;
}

export function TokenizedDepositFormContent({
  mode,
  code,
}: TokenizedDepositFormContentProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');
  const router = useRouter();
  const hasCode = mode === 'edit' && !!code;

  // ── 主表单（react-hook-form）──
  const form = useForm<TDEditFormValues>({
    defaultValues: {
      usPrice: '1',
      accountTypeList: [1],
      whitelistMode: 'full',
      thresholdType: 'volume',
      thresholdFrequency: 'daily',
      enableTokenReconciliation: RECON_DISABLED,
      enableReserveAssetReconciliation: RECON_DISABLED,
    } as TDEditFormValues,
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
  const reserveReconValue = form.watch(
    'enableReserveAssetReconciliation',
  ) as number | undefined;
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
  const completedWallets = [ownerWalletAddr, gasWalletAddr, mgmtWalletAddr]
    .filter(Boolean)
    .length;
  const progress = Math.min(
    92,
    28 +
      (nameValue ? 9 : 0) +
      (symbol ? 9 : 0) +
      (smartContractPackageId ? 12 : 0) +
      completedWallets * 8,
  );
  const activeStep = progress < 45 ? 0 : progress < 80 ? 1 : 2;
  const currentTypeLabel =
    tokenTypeOptions?.find(
      (item) => String(item.tokenTypeId) === String(mintMethod),
    )?.tokenTypeName ?? '';
  const currentBlockchainLabel =
    blockchainList?.find((item) => item.key === blockchain)?.value ?? '';
  const steps = [
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
        activeStep={activeStep}
      />

      <div className="grid items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8">
        <form
          id="td-onboard-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className={`flex min-w-0 flex-col gap-6 ${
            loading ? 'pointer-events-none opacity-60' : ''
          }`}
        >
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
    </div>
  );
}
