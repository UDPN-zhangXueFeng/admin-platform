'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { MINT_METHOD } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.constants';
import {
  useCreateTDApplyMutation,
  useEditTDOperationMutation,
} from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/+queries/tokenized-deposit.mutations';
import type {
  CoaSetupInfo,
  CoaSetupOption,
  KeyServiceOption,
  TDEditDetail,
  TDEditFormValues,
} from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.model';
import { RECON_DISABLED, RECON_ENABLED } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/tokenized-deposit.constants';
import { getEncryptionData } from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/get-encryption-data';
import {
  hasCoaSetupErrors,
  mapCoaSetupToPayload,
  validateCoaSetup,
} from '@myorg/modules/td-admin/data-access/lib/tokenized-deposit/coa-setup-utils';

/**
 * useTokenizedDepositSubmit — TD 新增/编辑提交 hook。
 *
 * 迁移自 td-manage `edit/hooks/useTokenizedDepositSubmit.ts`（261 行）。
 * 严格保留源时序、payload 组装、字段命名转换、COA 校验、storageType 分支。
 *
 * ## 提交时序
 *
 * onSubmit(values) → confirmSubmit(onOk) → onOk：
 * 1. 组装 adminWalletDTOList（3 角色，含 AES password + keyStore）。
 * 2. 组装 roleWalletDTOList（3 角色，仅 walletAddress）。
 * 3. 按 storageType 分支选 walletPayload：
 *    - key_keystore → { adminWalletDTOList }
 *    - rigsec/fireblocks → { roleWalletDTOList }
 * 4. 按 mintMethod COA 校验：
 *    - TD(5) → validateCoaSetup(tokenizedDepositCoaData)，有错则 setLoading(false) return。
 *    - Stablecoin(1) 且非 readonly → validateCoaSetup(stablecoinCoaData)。
 * 5. 组装 coaPayload（mapCoaSetupToPayload + mintMethod 选套）。
 * 6. 组装 payload（字段命名转换：decimals→decimalPrecision、enableXxx 归一 0/1；
 *    源 TdApplyAddReqVo/TdEditReqVo 没有阈值配置，表单不提供不可持久化的阈值控件。
 * 7. code 存在 → useEditTDOperationMutation；否则 → useCreateTDApplyMutation。
 * 8. 成功 → toast.success + routerBack。
 *
 * ## AES 加密（关键）
 *
 * adminWalletDTOList 的 `passWord` 字段经 `getEncryptionData` AES-CBC 加密
 * （与后端解密一致）。注意这与钱包生成路径不同：钱包生成走 generateWalletKeystore
 * （API 内部加密），而 TD 提交走 createTDApply/editTDOperation（透传不加密），
 * 故此处调用方需加密 password。
 *
 * ## 字段命名转换（提交）
 *
 * - 表单 `decimals` → API `decimalPrecision`
 * - 表单 `keyServiceName` → API `keyServiceCode`
 * - COA `accountTemplateCode`(string) → API `bookTemplateId`(number)（mapCoaSetupToPayload 内部转）
 * - enableTokenReconciliation/enableReserveAssetReconciliation 归一为 RECON_ENABLED(1)/RECON_DISABLED(0)
 *
 * ## 与源差异
 *
 * - antd Form onFinish → react-hook-form（调用方 form.handleSubmit(onSubmit)，hook 收 values）。
 * - tdApplyAddApi/tdOperationEditApi（命令式）→ useCreateTDApplyMutation/useEditTDOperationMutation + mutateAsync。
 * - modal.confirm（antd）→ confirmSubmit 回调（调用方用 AlertDialog 实现）。
 * - message.success → sonner toast.success（hook 顶层）。
 * - mapCoaSetupToApplyAddPayload 已合并为 mapCoaSetupToPayload（util 层去重）。
 * - apiClient 已解包信封，去掉 res.data.code 检查。
 * - accountTypeList 提交层兜底：MMF 固定 [3]、TD 过滤 {1,2}（源为纯透传；
 *   跨类型切换残留由表单层 onTokenTypeChange 重置规则清理，语义不变）。
 * - reserveAccountId / enableReserveAssetReconciliation 与源一致透传
 *   （Stablecoin + CBDC(10/15) 均提交；不再按 mintMethod 强制清零）。
 * - keyService 失效不硬拦截（源同）：storageType 按 选中项 → 详情回填 →
 *   'key_keystore' 兜底链解析，keyServiceCode 缺失时省略键。
 *
 * @param params 见 {@link UseTokenizedDepositSubmitParams}
 */
export interface UseTokenizedDepositSubmitParams {
  /** "确认提交"确认回调（调用方实现，内部触发 onOk）。 */
  confirmSubmit: (onOk: () => Promise<void> | void) => void;
  /** 成功后回调（通常 router.back()）。 */
  routerBack: () => void;
  /** 成功提示 i18n key（默认 'PUB_Success'，含 **** 占位会被清除）。 */
  successMessageKey?: string;
  /** 路由 code（存在=编辑态，走 editTDOperation 并附 code）。 */
  code?: string | number;
  /** 编辑详情（提供 keyServiceCode/storageType 兜底）。 */
  detailInfo: TDEditDetail;
  keyServiceList?: KeyServiceOption[];
  reserveAccountId?: string | number;
  tokenizedDepositCoaData: CoaSetupInfo;
  stablecoinCoaData: CoaSetupInfo;
  timezoneOptions?: CoaSetupOption[];
  stablecoinCoaReadonly: boolean;
  setTokenizedDepositCoaErrors: (
    errors: ReturnType<typeof validateCoaSetup>,
  ) => void;
  setStablecoinCoaErrors: (errors: ReturnType<typeof validateCoaSetup>) => void;
  /**
   * 提交成功附加回调（可选，在 toast + routerBack 前调用）。
   * add 模式用于 clearDraft（避免成功后草稿残留，下次进入误弹恢复横幅）。
   */
  onSubmitSuccess?: () => void;
}

export interface UseTokenizedDepositSubmitReturn {
  loading: boolean;
  /** 提交入口（传给 form.handleSubmit）。 */
  onSubmit: (values: TDEditFormValues) => void;
}

export function useTokenizedDepositSubmit({
  confirmSubmit,
  routerBack,
  successMessageKey = 'PUB_Success',
  code,
  detailInfo,
  keyServiceList,
  reserveAccountId,
  tokenizedDepositCoaData,
  stablecoinCoaData,
  timezoneOptions,
  stablecoinCoaReadonly,
  setTokenizedDepositCoaErrors,
  setStablecoinCoaErrors,
  onSubmitSuccess,
}: UseTokenizedDepositSubmitParams): UseTokenizedDepositSubmitReturn {
  const [loading, setLoading] = useState(false);
  const createMutation = useCreateTDApplyMutation();
  const editMutation = useEditTDOperationMutation();
  const t = useTranslations('modules.tokenized-deposit');
  const globalT = useTranslations();

  const successCallBack = useCallback(() => {
    onSubmitSuccess?.();
    toast.success(globalT(successMessageKey).replace('****', ''));
    routerBack();
  }, [globalT, routerBack, successMessageKey, onSubmitSuccess]);

  const onSubmit = useCallback(
    (values: TDEditFormValues) => {
      confirmSubmit(async () => {
        setLoading(true);

        const {
          name,
          symbol,
          usPrice,
          currencySymbol,
          blockchainId,
          mintMethod,
          smartContractPackageId,
          accountTypeList,
          metaType,
          decimals,
          walletAddressContractOwner,
          walletAddressPaymentOfGasFee,
          walletAddressManagementWallet,
          keyStoreContractOwner,
          keyStorePaymentOfGasFee,
          keyStoreManagementWallet,
          // passWord 3 字段不在 TDEditFormValues 严格类型内（UI 控件 disabled，
          // 见迁移文档），用宽松 getValues 读取（保留源回填/生成的明文密码）。
          keyServiceName: keyServiceCode,
          enableTokenReconciliation,
          enableReserveAssetReconciliation,
        } = values;

        // passWord 3 字段（类型宽松读取）
        const passWordContractOwner = (
          values as TDEditFormValues & {
            passWordContractOwner?: string;
            passWordPaymentOfGasFee?: string;
            passWordManagementWallet?: string;
          }
        ).passWordContractOwner;
        const passWordPaymentOfGasFee = (
          values as TDEditFormValues & {
            passWordPaymentOfGasFee?: string;
          }
        ).passWordPaymentOfGasFee;
        const passWordManagementWallet = (
          values as TDEditFormValues & {
            passWordManagementWallet?: string;
          }
        ).passWordManagementWallet;

        // ── reserveId / reserve 对账开关：透传归一（与源一致）──
        // 源不按 mintMethod 在提交层拦截这两个字段；跨类型残留由表单层
        // onTokenTypeChange 的重置规则兜底（TD/MMF 切换清 reserve/recon）。
        // CBDC(10/15) 与 Stablecoin 同样可见并提交储备账户（VO 契约一致）。
        const reserveId =
          reserveAccountId !== undefined &&
          reserveAccountId !== null &&
          reserveAccountId !== ''
            ? Number(reserveAccountId)
            : undefined;
        // accountTypeList：MMF 固定 [3]、TD 过滤 {1,2}（提交层兜底，与源差异已记录）；
        // Stablecoin/CBDC 透传（源 accountTypeList?.map(Number)，未选时 undefined → 键省略）。
        const normalizedAccountTypeList: number[] | undefined =
          Number(mintMethod) === MINT_METHOD.MMF
            ? [3]
            : Number(mintMethod) === MINT_METHOD.TOKENIZED_DEPOSIT
              ? (() => {
                  const filtered = (accountTypeList ?? [])
                    .map((type) => Number(type))
                    .filter((type) => type === 1 || type === 2);
                  return filtered.length > 0 ? filtered : [1];
                })()
              : Array.isArray(accountTypeList)
                ? accountTypeList.map((type) => Number(type))
                : undefined;

        // ── adminWalletDTOList（含 AES password + keyStore）──
        const adminWalletDTOList = [
          {
            accountType: 1,
            keyStore: keyStoreContractOwner,
            passWord: getEncryptionData(passWordContractOwner ?? ''),
            walletAddress: walletAddressContractOwner,
          },
          {
            accountType: 2,
            keyStore: keyStorePaymentOfGasFee,
            passWord: getEncryptionData(passWordPaymentOfGasFee ?? ''),
            walletAddress: walletAddressPaymentOfGasFee,
          },
          {
            accountType: 3,
            keyStore: keyStoreManagementWallet,
            passWord: getEncryptionData(passWordManagementWallet ?? ''),
            walletAddress: walletAddressManagementWallet,
          },
        ];

        // ── roleWalletDTOList（仅 walletAddress）──
        const roleWalletDTOList = [
          { accountType: 1, walletAddress: walletAddressContractOwner },
          { accountType: 2, walletAddress: walletAddressPaymentOfGasFee },
          { accountType: 3, walletAddress: walletAddressManagementWallet },
        ];

        // storageType 解析链与源一致：选中项 → 详情回填 → 'key_keystore'。
        // 源不在提交时硬拦截 keyService 失效（编辑态列表加载失败时仍允许保存
        // 其余字段，storageType 走兜底链）；这里同样放行。
        const selectedKeyService = keyServiceList?.find(
          (item) => item.keyServiceCode === keyServiceCode,
        );
        const fallbackKeyServiceCode =
          keyServiceCode || detailInfo?.keyServiceCode;
        const storageType =
          selectedKeyService?.storageType ||
          detailInfo?.storageType ||
          'key_keystore';
        // 按 storageType 分支选 walletPayload
        const walletPayload =
          storageType === 'key_keystore'
            ? { adminWalletDTOList }
            : { roleWalletDTOList };

        // ── COA 校验（按 mintMethod）──
        if (Number(mintMethod) === MINT_METHOD.TOKENIZED_DEPOSIT) {
          const errors = validateCoaSetup(tokenizedDepositCoaData);
          setTokenizedDepositCoaErrors(errors);
          if (hasCoaSetupErrors(errors)) {
            setLoading(false);
            return;
          }
        }

        if (
          Number(mintMethod) === MINT_METHOD.STABLECOIN &&
          !stablecoinCoaReadonly
        ) {
          const errors = validateCoaSetup(stablecoinCoaData);
          setStablecoinCoaErrors(errors);
          if (hasCoaSetupErrors(errors)) {
            setLoading(false);
            return;
          }
        }

        // ── coaPayload（mapCoaSetupToPayload + mintMethod 选套）──
        const selectedCoaData =
          Number(mintMethod) === MINT_METHOD.TOKENIZED_DEPOSIT
            ? tokenizedDepositCoaData
            : Number(mintMethod) === MINT_METHOD.STABLECOIN
              ? stablecoinCoaData
              : null;
        const coaPayload = mapCoaSetupToPayload(
          selectedCoaData,
          timezoneOptions,
        );

        // ── 组装 payload（字段命名转换）──
        const payload = {
          blockchainId: Number(blockchainId),
          currencySymbol,
          name,
          symbol,
          usPrice: Number(usPrice),
          mintMethod: Number(mintMethod),
          smartContractPackageId: Number(smartContractPackageId),
          // P0-1-submit-guard：使用按 mintMethod 过滤后的 accountTypeList
          accountTypeList: normalizedAccountTypeList,
          metaType: metaType !== undefined ? Number(metaType) : undefined,
          // 字段命名转换：表单 decimals → API decimalPrecision
          decimalPrecision: Number(decimals),
          enableTokenReconciliation:
            Number(enableTokenReconciliation ?? RECON_DISABLED) ===
            RECON_ENABLED
              ? RECON_ENABLED
              : RECON_DISABLED,
          // 储备对账开关透传归一（0/1），源同
          enableReserveAssetReconciliation:
            Number(enableReserveAssetReconciliation ?? RECON_DISABLED) ===
            RECON_ENABLED
              ? RECON_ENABLED
              : RECON_DISABLED,
          ...walletPayload,
          ...coaPayload,
          ...(reserveId !== undefined ? { reserveAccountId: reserveId } : {}),
        };

        try {
          if (code) {
            await editMutation.mutateAsync({
              ...payload,
              code: String(code),
              storageType,
              ...(fallbackKeyServiceCode
                ? { keyServiceCode: fallbackKeyServiceCode }
                : {}),
            });
            successCallBack();
          } else {
            await createMutation.mutateAsync({
              ...payload,
              keyServiceCode,
              storageType,
            });
            successCallBack();
          }
        } catch (err) {
          // G2：失败反馈。区分业务错误（有 response/业务 code 非 0）与网络异常。
          const errAny = err as {
            response?: { data?: { code?: number } };
            code?: number;
          };
          const hasResponse =
            !!errAny?.response || errAny?.code !== undefined;
          if (hasResponse) {
            toast.error(t('td_toast_submit_failed'));
          } else {
            toast.error(t('td_toast_submit_network_failed'));
          }
        } finally {
          setLoading(false);
        }
      });
    },
    [
      confirmSubmit,
      createMutation,
      detailInfo?.keyServiceCode,
      detailInfo?.storageType,
      editMutation,
      keyServiceList,
      code,
      reserveAccountId,
      stablecoinCoaData,
      stablecoinCoaReadonly,
      successCallBack,
      t,
      timezoneOptions,
      tokenizedDepositCoaData,
      setStablecoinCoaErrors,
      setTokenizedDepositCoaErrors,
    ],
  );

  return {
    loading,
    onSubmit,
  };
}
