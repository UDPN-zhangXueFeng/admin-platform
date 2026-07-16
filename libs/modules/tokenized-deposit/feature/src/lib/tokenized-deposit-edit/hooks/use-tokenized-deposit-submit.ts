'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import {
  useCreateTDApplyMutation,
  useEditTDOperationMutation,
  type CoaSetupInfo,
  type CoaSetupOption,
  type KeyServiceOption,
  type TDEditDetail,
  type TDEditFormValues,
} from '@myorg/modules/tokenized-deposit/data-access';
import {
  MINT_METHOD,
  RECON_DISABLED,
  RECON_ENABLED,
  getEncryptionData,
  hasCoaSetupErrors,
  mapCoaSetupToPayload,
  validateCoaSetup,
} from '@myorg/modules/tokenized-deposit/util';

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
 * 6. 组装 payload（字段命名转换：decimals→decimalPrecision、enableXxx 归一 0/1）。
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
  setTokenizedDepositCoaErrors: (errors: ReturnType<typeof validateCoaSetup>) => void;
  setStablecoinCoaErrors: (errors: ReturnType<typeof validateCoaSetup>) => void;
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
}: UseTokenizedDepositSubmitParams): UseTokenizedDepositSubmitReturn {
  const [loading, setLoading] = useState(false);
  const createMutation = useCreateTDApplyMutation();
  const editMutation = useEditTDOperationMutation();

  const successCallBack = useCallback(() => {
    toast.success(successMessageKey.replace('****', ''));
    routerBack();
  }, [routerBack, successMessageKey]);

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

        // ── reserveAccountId 归一 ──
        const reserveId =
          reserveAccountId !== undefined &&
          reserveAccountId !== null &&
          reserveAccountId !== ''
            ? Number(reserveAccountId)
            : undefined;

        // ── storageType 判定（选中 keyService 或 detail 兜底）──
        const selectedKeyService = keyServiceList?.find(
          (item) => item.keyServiceCode === keyServiceCode,
        );
        const fallbackKeyServiceCode =
          keyServiceCode || detailInfo?.keyServiceCode;
        const storageType =
          (selectedKeyService as (KeyServiceOption & { storageType?: string }) | undefined)
            ?.storageType ||
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
          accountTypeList: accountTypeList?.map((type) => Number(type)),
          metaType: metaType !== undefined ? Number(metaType) : undefined,
          // 字段命名转换：表单 decimals → API decimalPrecision
          decimalPrecision: Number(decimals),
          enableTokenReconciliation:
            Number(enableTokenReconciliation ?? RECON_DISABLED) ===
            RECON_ENABLED
              ? RECON_ENABLED
              : RECON_DISABLED,
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
