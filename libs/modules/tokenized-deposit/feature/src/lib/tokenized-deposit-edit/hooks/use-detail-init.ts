'use client';

import { useEffect } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import {
  useTDOperationEditDetailQuery,
  type BlockchainOption,
  type CoaSetupErrors,
  type CoaSetupInfo,
  type TDEditDetail,
  type TDEditFormValues,
} from '@myorg/modules/tokenized-deposit/data-access';
import {
  MINT_METHOD,
  RECON_DISABLED,
  mapDetailToCoaSetup,
} from '@myorg/modules/tokenized-deposit/util';

/**
 * useDetailInit — 编辑详情回填 hook。
 *
 * 迁移自 td-manage `edit/hooks/useDetailInit.ts`（146 行）。严格保留源时序与分支。
 *
 * ## 时序（code 存在时，detail data 到达后）
 *
 * 1. setDetailInfo(detail) / setFlag(detail.mintMethod === TD)。
 * 2. 按 mintMethod 分支回填 COA（**双套数据**）：
 *    - TD(5) → setTokenizedDepositCoaData(mapDetailToCoaSetup(detail,'setup_required')) + 清 errors。
 *    - Stablecoin(1) → setStablecoinCoaData(mapDetailToCoaSetup(detail,'configured')) + 清 errors。
 * 3. 回填表单（含**字段命名转换**）：
 *    - `decimalPrecision` → `decimals`
 *    - `keyServiceCode` → `keyServiceName`
 *    - blockchainId/currencySymbol 等（触发关联 query：keyService/reserve 由
 *      useKeyService/useBlockchainEffect 监听 form 值自动拉取，故本 hook 不再显式
 *      调用 getKeyServiceList/getReserveList）。
 *    - metaType：blockchain.virtualMachineCode === 'tron' ? 1 : detail.metaType。
 * 4. setWalletFields：按 storageType 分支取 roleWalletDTOList 或 adminWalletDTOList，
 *    includeKeyStore = (storageType !== 'key_keystore') ? false : true（即 keystore 才回填 keyStore）。
 * 5. getDeployInfo(contractLanguage, detail.mintMethod) + setTokenTypeId(detail.mintMethod)。
 *
 * ## 竞态保护
 *
 * 用 `isCurrentRequest` 守卫（源同），但 TanStack Query 已内置请求竞态处理，
 * 此处 effect 在 detail 变化时执行，query 卸载自动忽略 stale data。
 *
 * ## 与源差异
 *
 * - getDetailApi（命令式）→ useTDOperationEditDetailQuery（声明式 + enabled 守卫）。
 * - 源 `await getKeyServiceList` / `await getReserveList` 串行调用删除：关联查询
 *   改由 form 值（blockchainId/currencySymbol）驱动其他 hook 自动触发，回填不依赖
 *   它们的返回值（源 await 仅用于时序保证，非数据依赖）。
 * - antd form.setFieldsValue → react-hook-form 多次 form.setValue。
 * - apiClient 已解包信封，去掉 `res.data.code` 检查。
 */
export interface UseDetailInitParams {
  form: UseFormReturn<TDEditFormValues>;
  /** 路由 code（存在=编辑态，触发回填）。 */
  code: string | number | undefined;
  /** 当前 contractLanguage（edit 页 state，传给 getDeployInfo）。 */
  contractLanguage: string;
  blockchainList?: BlockchainOption[];
  /** 触发合约包查询。 */
  getDeployInfo: (contractLanguage: string, tokenType: number) => void;
  /** 回填管理员/角色钱包字段（来自 useWalletManagement）。 */
  setWalletFields: (
    walletList?: Array<{ accountType?: number; walletAddress?: string; keyStore?: string }>,
    includeKeyStore?: boolean,
  ) => void;
  setDetailInfo: (detailInfo: TDEditDetail) => void;
  /** setFlag(detail.mintMethod === TD)，控制显隐 reserveAccount/COA setup_required。 */
  setFlag: (flag: boolean) => void;
  setTokenTypeId: (tokenType: number) => void;
  setTokenizedDepositCoaData: (data: CoaSetupInfo | null) => void;
  setTokenizedDepositCoaErrors: (errors: CoaSetupErrors) => void;
  setStablecoinCoaData: (data: CoaSetupInfo | null) => void;
  setStablecoinCoaErrors: (errors: CoaSetupErrors) => void;
}

export function useDetailInit({
  form,
  code,
  contractLanguage,
  blockchainList,
  getDeployInfo,
  setWalletFields,
  setDetailInfo,
  setFlag,
  setTokenTypeId,
  setTokenizedDepositCoaData,
  setTokenizedDepositCoaErrors,
  setStablecoinCoaData,
  setStablecoinCoaErrors,
}: UseDetailInitParams) {
  const { data: detail } = useTDOperationEditDetailQuery(code);

  useEffect(() => {
    if (!code) return;
    if (!detail) return;

    setDetailInfo(detail);
    setFlag(detail.mintMethod === MINT_METHOD.TOKENIZED_DEPOSIT);

    // ── COA 双套数据按 mintMethod 分支回填 ──
    if (detail.mintMethod === MINT_METHOD.TOKENIZED_DEPOSIT) {
      setTokenizedDepositCoaData(
        mapDetailToCoaSetup(detail, 'setup_required'),
      );
      setTokenizedDepositCoaErrors({});
    }

    if (detail.mintMethod === MINT_METHOD.STABLECOIN) {
      setStablecoinCoaData(mapDetailToCoaSetup(detail, 'configured'));
      setStablecoinCoaErrors({});
    }

    // ── 钱包字段回填：按 storageType 分支取列表 ──
    const isRigsecOrFireblocksStorage = detail.storageType !== 'key_keystore';
    const walletList = isRigsecOrFireblocksStorage
      ? detail.roleWalletDTOList ?? []
      : detail.adminWalletDTOList ?? [];
    setWalletFields(walletList, !isRigsecOrFireblocksStorage);

    // ── 区块链（用于 metaType tron 判定）──
    const blockchain = blockchainList?.find(
      (item) => item.key === String(detail.blockchainId ?? ''),
    );

    // ── 表单回填（含字段命名转换）──
    form.setValue('decimals', detail.decimalPrecision);
    form.setValue('name', detail.name);
    form.setValue('symbol', detail.symbol);
    form.setValue('usPrice', detail.usPrice);
    form.setValue('blockchainId', String(detail.blockchainId ?? ''));
    form.setValue('currencySymbol', detail.currencySymbol);
    form.setValue('mintMethod', detail.mintMethod);
    form.setValue('accountTypeList', detail.accountTypeList);
    form.setValue(
      'metaType',
      blockchain?.virtualMachineCode === 'tron' ? 1 : detail.metaType,
    );
    form.setValue('smartContractPackageId', String(detail.smartContractPackageId ?? ''));
    form.setValue('reserveAccountId', detail.reserveAccountId);
    form.setValue('thresholdType', detail.thresholdType ?? 'volume');
    form.setValue('thresholdFrequency', detail.thresholdFrequency ?? 'daily');
    form.setValue(
      'thresholdValue',
      detail.thresholdValue !== undefined
        ? String(detail.thresholdValue)
        : undefined,
    );
    // 字段命名转换：API keyServiceCode → 表单 keyServiceName
    form.setValue('keyServiceName', detail.keyServiceCode);
    form.setValue('whitelistMode', 'full');
    // enableWhitelist 不在 TDEditFormValues 严格类型内（UI 控件 disabled 永久 true，
    // 见迁移文档第 8.18 章），用类型宽松的 setValue 回填，保留源回填行为。
    (form.setValue as (name: string, value: unknown) => void)(
      'enableWhitelist',
      true,
    );
    form.setValue(
      'enableTokenReconciliation',
      detail.enableTokenReconciliation ?? RECON_DISABLED,
    );
    form.setValue(
      'enableReserveAssetReconciliation',
      detail.enableReserveAssetReconciliation ?? RECON_DISABLED,
    );

    getDeployInfo(contractLanguage, detail.mintMethod ?? 0);
    setTokenTypeId(detail.mintMethod ?? 0);
  }, [detail, code]);
}
