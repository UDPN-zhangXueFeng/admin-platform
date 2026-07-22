'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useRouter } from '@myorg/shared/util-i18n';
import { ColumnDef } from '@tanstack/react-table';
import { endOfDay, parseISO, startOfDay } from 'date-fns';

import {
  Button,
  CopyableEllipsisText,
  DataTable,
} from '@myorg/shared/ui';
import { FormDatePicker, FormField, FormSelect } from '@myorg/shared/ui-forms';
import { useAuth } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';

import {
  useBlockchainsQuery,
  useStablecoinsQuery,
  useTokenTypesQuery,
  useUserWalletListQuery,
  type UserWallet,
  type UserWalletFilters,
  type WalletListParams,
} from '@myorg/modules/wallet/data-access';
import { WalletStatusBadge } from '@myorg/modules/wallet/ui';
import {
  ALL_VALUE,
  custodyModelMessageKey,
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  kycMessageKey,
  toMillis,
  WALLET_PERMISSIONS,
} from '@myorg/modules/wallet/util';

import { UserWalletActionDialog } from './user-wallet-action-dialog';

/** 时间格式（与 operational-wallet 列表一致：年-月-日 时:分:秒）。 */
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/**
 * 页面侧扩展的筛选条件（含创建时间范围）。
 *
 * 源 CustomTable 筛选项含 `startCreateTime-endCreateTime` 范围，后端 list 接受
 * `startCreateTime`/`endCreateTime`。`UserWalletFilters`（data-access）未建模
 * 这两个字段，此处以交叉类型补充，传给 query hook 时窄化为基础类型（零侵入基础层）。
 */
type UserWalletListFilters = UserWalletFilters & {
  startCreateTime?: number;
  endCreateTime?: number;
  spName?: string;
  custodyModel?: number;
  kycRequired?: number;
  submissionPolicyStatic?: string;
};

/**
 * UserWalletListPage — 用户钱包列表页。
 *
 * 迁移自 td-manage `src/pages/wallet/user-wallet/index.tsx`（732 行）。
 * 保留：多维筛选（walletAddress / spName / stablecoin / tokenType / blockchain /
 * 创建时间范围 / state / custodyModel / kycRequired / submissionPolicyStatic）、
 * 服务端分页（pageNum/pageSize，列表 hook 已配 keepPreviousData 平滑翻页）、
 * 状态 badge（user-wallet 族 = commonapprovalTaskStatus {0:processing,1:active,2/3:gray}）、
 * 行操作 Detail / History 跳转 + 5 弹窗工作流（冻结资金/解冻资金/冻结钱包/解冻钱包/改类型）。
 */
export function UserWalletListPage() {
  const t = useTranslations('modules.wallet');
  const router = useRouter();
  const authPermissions = useAuth().permissions ?? new Set<string>();
  /** 权限未配置（空集）时全放开，兼容权限未接入场景（posting-engine 模式）。 */
  const canViewDetail =
    authPermissions.size === 0 ||
    authPermissions.has(WALLET_PERMISSIONS.UserWalletDetail);
  const canViewHistory =
    authPermissions.size === 0 ||
    authPermissions.has(WALLET_PERMISSIONS.UserWalletHistory);
  const canOperate =
    authPermissions.size === 0 ||
    authPermissions.has(WALLET_PERMISSIONS.UserWalletOperate);

  const { register, control, handleSubmit, reset } =
    useForm<UserWalletFilterForm>({
      defaultValues: EMPTY_FORM,
    });

  const [queryValues, setQueryValues] =
    React.useState<UserWalletFilterForm>(EMPTY_FORM);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const params = React.useMemo<WalletListParams<UserWalletListFilters>>(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      filters: formToFilters(queryValues),
    }),
    [pagination.pageNum, pagination.pageSize, queryValues]
  );

  const listResult = useUserWalletListQuery(
    params as WalletListParams<UserWalletFilters>
  );
  const rows = listResult.data?.rows ?? [];
  const total = listResult.data?.page?.total ?? 0;
  const isLoading = listResult.isLoading || listResult.isFetching;

  // common 下拉（stablecoin / blockchain / tokenType，common endpoint）。
  const stablecoinsResult = useStablecoinsQuery();
  const blockchainsResult = useBlockchainsQuery();
  const tokenTypesResult = useTokenTypesQuery();

  const stablecoinOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('common.all') },
      ...(stablecoinsResult.data ?? [])
        .filter((el) => el && el.stablecoinId != null)
        .map((el) => ({
          value: String(el.stablecoinId),
          label: el.name ?? String(el.stablecoinId),
        })),
    ],
    [stablecoinsResult.data, t]
  );

  const blockchainOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('common.all') },
      ...(blockchainsResult.data ?? [])
        .filter((el) => el && el.key != null)
        .map((el) => ({
          value: String(el.key),
          // 源 disabled when status === 1 ? false : true；目标 FormSelect 无 per-option disabled，
          // 失效链折叠为 label 标注（忠实保留语义，与 operational-wallet 一致）。
          label: el.value ?? el.label ?? String(el.key),
        })),
    ],
    [blockchainsResult.data, t]
  );

  const tokenTypeOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('common.all') },
      ...(tokenTypesResult.data ?? [])
        .filter((el) => el.key != null)
        .map((el) => {
          const key = `tokenType.${el.key}`;
          return {
            value: String(el.key),
            // 后端返回的 value 作为兜底 label（tokenType.{key} 补全后优先用 i18n）。
            label: el.value ?? key,
          };
        }),
    ],
    [tokenTypesResult.data, t]
  );

  const custodyModelOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('common.all') },
      { value: '1', label: t('custodyModel.issuerCustody') },
      { value: '2', label: t('custodyModel.spCustody') },
      { value: '3', label: t('custodyModel.selfCustody') },
    ],
    [t]
  );

  const kycOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('common.all') },
      { value: '1', label: t('kyc.yes') },
      { value: '0', label: t('kyc.no') },
    ],
    [t]
  );

  const submissionPolicyOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('common.all') },
      { value: 'sp', label: t('userWallet.submissionPolicy.sp') },
      { value: 'direct', label: t('userWallet.submissionPolicy.direct') },
    ],
    [t]
  );

  const stateOptions = React.useMemo(
    () => [
      { value: ALL_VALUE, label: t('common.all') },
      // 源 user_wallet_state_{0..3} → 0=Processing/1=Active/2=Frozen/3=Rejected，
      // 与 user-wallet 状态族 badge label 一致，复用 modules.wallet.status.*。
      { value: '0', label: t('status.processing') },
      { value: '1', label: t('status.active') },
      { value: '2', label: t('status.frozen') },
      // 源 state_3=Rejected 落在 badge 族的 default 灰（inactive），筛选仍保留原语义标签。
      { value: '3', label: t('userWallet.column.stateRejected') },
    ],
    [t]
  );

  // ── 弹窗工作流状态（modalInfo.key 驱动）──
  const [modalInfo, setModalInfo] =
    React.useState<UserWalletModalInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const openAction = React.useCallback(
    (action: UserWalletAction, row: UserWallet) => {
      setModalInfo({
        id: String(row.id ?? row.walletId ?? ''),
        action,
        walletId: Number(row.walletId),
        walletType: typeof row.walletType === 'string' ? row.walletType : '',
        tdName: typeof row.tdName === 'string' ? row.tdName : '',
        // 资金冻结/解冻弹窗 tips 文案需要可用余额 / 冻结余额回填。
        usableCount:
          row.usableCount != null
            ? String(row.usableCount)
            : row.stablecoinCount != null
            ? String(row.stablecoinCount)
            : '',
        freezeCount: row.freezeCount != null ? String(row.freezeCount) : '',
        symbol: typeof row.symbol === 'string' ? row.symbol : '',
      });
      setIsModalOpen(true);
    },
    []
  );

  const closeModal = React.useCallback(() => {
    setIsModalOpen(false);
    // 等动画收起再清空，避免表单字段闪烁。
    setModalInfo(null);
  }, []);

  const columns = React.useMemo<ColumnDef<UserWallet>[]>(
    () => [
      {
        accessorKey: 'walletAddress',
        header: t('userWallet.column.walletAddress'),
        cell: ({ row }) => (
          <CopyableEllipsisText value={row.original.walletAddress} />
        ),
      },
      {
        accessorKey: 'blockchainName',
        header: t('userWallet.column.blockchain'),
        cell: ({ row }) => (
          <span>{row.original.blockchainName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'spName',
        header: t('userWallet.column.sp'),
        cell: ({ row }) => (
          <span>{row.original.spName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'custodyModel',
        header: t('userWallet.column.custodyModel'),
        cell: ({ row }) => {
          const key = custodyModelMessageKey(
            row.original.custodyModel as number | null | undefined
          );
          return <span>{key ? t(key) : EMPTY_DISPLAY}</span>;
        },
      },
      {
        accessorKey: 'kycRequired',
        header: t('userWallet.column.kycRequired'),
        cell: ({ row }) => {
          const key = kycMessageKey(
            row.original.kycRequired as number | null | undefined
          );
          return <span>{key ? t(key) : EMPTY_DISPLAY}</span>;
        },
      },
      {
        accessorKey: 'tdName',
        header: t('userWallet.column.tokenName'),
        cell: ({ row }) => (
          <span>{row.original.tdName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'tokenType',
        header: t('userWallet.column.tokenType'),
        cell: ({ row }) => {
          const tokenType = row.original.tokenType as number | undefined;
          if (tokenType == null) {
            return <span>{EMPTY_DISPLAY}</span>;
          }
          return <span>{translateTokenType(t, tokenType)}</span>;
        },
      },
      {
        accessorKey: 'walletType',
        header: t('userWallet.column.walletType'),
        cell: ({ row }) => (
          <span>{row.original.walletType || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'stablecoinCount',
        header: t('userWallet.column.totalBalance'),
        cell: ({ row }) => {
          const { stablecoinCount, symbol } = row.original;
          return (
            <span>
              {stablecoinCount != null && stablecoinCount !== ''
                ? `${stablecoinCount}${symbol ? ' ' + symbol : ''}`
                : EMPTY_DISPLAY}
            </span>
          );
        },
      },
      {
        accessorKey: 'state',
        header: t('common.status'),
        cell: ({ row }) => (
          <WalletStatusBadge
            family="user-wallet"
            status={row.original.state}
          />
        ),
      },
      {
        accessorKey: 'createTime',
        header: t('common.createTime'),
        cell: ({ row }) => {
          // 源 `formatTimestamp(Number(createTime))`：model 中 createTime 为 number|string，
          // 先归一为 number 再经 toMillis（秒/毫秒自适应）。
          const ts = Number(row.original.createTime);
          const ms = Number.isFinite(ts) ? toMillis(ts) : undefined;
          return (
            <span>{ms ? formatDate(ms, DATETIME_FMT) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        id: 'actions',
        header: t('common.operate'),
        cell: ({ row }) => {
          const data = row.original;
          // 行操作可用性（忠实搬运源 actions[].disabled 逻辑）。
          const canFreezeWallet = canOperate && data.walletState === 1 && data.tdState !== 2;
          const canUnfreezeWallet =
            canOperate && data.walletState === 3 && data.tdState !== 2;
          const canChangeWalletType =
            canOperate &&
            data.state === 1 &&
            data.walletTypeChangeRecordId === null &&
            data.tdState !== 2;
          // 资金冻结：源 disabled = state===3 ? true : !(walletState!==0 && stablecoinFreezeRecordId===null && tdState!==2)
          const fundsFrozenBusy =
            data.state === 3 ||
            !(
              (data.walletState === 0
                ? false
                : data.stablecoinFreezeRecordId === null) &&
              data.tdState !== 2
            );
          const canFreezeFunds = canOperate && !fundsFrozenBusy;
          // 资金解冻：源 disabled = !((freezeCount==='0'?false:stablecoinUnfreezeRecordId===null) && tdState!==2)
          const canUnfreezeFunds =
            canOperate &&
            (data.freezeCount === '0'
              ? false
              : data.stablecoinUnfreezeRecordId === null) &&
            data.tdState !== 2;

          return (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {canViewDetail ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() =>
                    router.push(
                      `/wallet/user-wallet/view?walletId=${data.walletId ?? ''}`
                    )
                  }
                >
                  {t('userWallet.action.detail')}
                </Button>
              ) : null}
              {canViewHistory ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  disabled={data.state === 3 ? true : data.state === 0}
                  onClick={() =>
                    router.push(
                      `/wallet/user-wallet/history?walletId=${data.walletId ?? ''}`
                    )
                  }
                >
                  {t('userWallet.action.history')}
                </Button>
              ) : null}
              {canChangeWalletType ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => openAction('ChangeWalletType', data)}
                >
                  {t('userWallet.action.changeWalletType')}
                </Button>
              ) : null}
              {canFreezeWallet ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => openAction('FreezeWallet', data)}
                >
                  {t('userWallet.action.freezeWallet')}
                </Button>
              ) : null}
              {canUnfreezeWallet ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => openAction('UnfreezeWallet', data)}
                >
                  {t('userWallet.action.unfreezeWallet')}
                </Button>
              ) : null}
              {canFreezeFunds ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => openAction('FreezeFunds', data)}
                >
                  {t('userWallet.action.freezeFunds')}
                </Button>
              ) : null}
              {canUnfreezeFunds ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => openAction('UnfreezeFunds', data)}
                >
                  {t('userWallet.action.unfreezeFunds')}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [t, canViewDetail, canViewHistory, canOperate, router, openAction]
  );

  const onSubmit = React.useCallback((form: UserWalletFilterForm) => {
    setPagination((prev) => ({ ...prev, pageNum: 1 }));
    setQueryValues(form);
  }, []);

  const onReset = React.useCallback(() => {
    reset(EMPTY_FORM);
    setQueryValues(EMPTY_FORM);
    setPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  }, [reset]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="mb-4 text-sm font-semibold">
          {t('userWallet.filterTitle')}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            name="walletAddress"
            label={t('userWallet.column.walletAddress')}
            register={register('walletAddress')}
            placeholder={t('userWallet.placeholder.walletAddress')}
          />
          <FormField
            name="spName"
            label={t('userWallet.column.sp')}
            register={register('spName')}
            placeholder={t('userWallet.placeholder.sp')}
          />
          <FormSelect
            name="stablecoinId"
            control={control}
            label={t('userWallet.column.tokenName')}
            options={stablecoinOptions}
            placeholder={t('common.all')}
          />
          <FormSelect
            name="tokenType"
            control={control}
            label={t('userWallet.column.tokenType')}
            options={tokenTypeOptions}
            placeholder={t('common.all')}
          />
          <FormSelect
            name="blockchainKey"
            control={control}
            label={t('userWallet.column.blockchain')}
            options={blockchainOptions}
            placeholder={t('common.all')}
          />
          <FormDatePicker
            name="startCreateTime"
            control={control}
            label={t('userWallet.field.startCreateTime')}
          />
          <FormDatePicker
            name="endCreateTime"
            control={control}
            label={t('userWallet.field.endCreateTime')}
          />
          <FormSelect
            name="state"
            control={control}
            label={t('common.status')}
            options={stateOptions}
            placeholder={t('common.all')}
          />
          <FormSelect
            name="custodyModel"
            control={control}
            label={t('userWallet.column.custodyModel')}
            options={custodyModelOptions}
            placeholder={t('common.all')}
          />
          <FormSelect
            name="kycRequired"
            control={control}
            label={t('userWallet.column.kycRequired')}
            options={kycOptions}
            placeholder={t('common.all')}
          />
          <FormSelect
            name="submissionPolicyStatic"
            control={control}
            label={t('userWallet.column.submissionPolicy')}
            options={submissionPolicyOptions}
            placeholder={t('common.all')}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">{t('common.query')}</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            {t('common.reset')}
          </Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3 text-sm font-semibold">
          {t('userWallet.records')}
        </div>
        <div className="p-4">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage={t('common.noData')}
            pagination={{
              page: pagination.pageNum,
              pageSize: pagination.pageSize,
              total,
              onPageChange: (page) =>
                setPagination((prev) => ({ ...prev, pageNum: page })),
            }}
          />
        </div>
      </div>

      <UserWalletActionDialog
        modalInfo={modalInfo}
        open={isModalOpen}
        onClose={closeModal}
      />
    </div>
  );
}

// ── 弹窗工作流类型 ─────────────────────────────────────────────────────────────

/** 5 种弹窗操作 key（迁移自源 modalInfo.key）。 */
export type UserWalletAction =
  | 'FreezeFunds' // 源 modalInfo.key='Freeze'，type=6
  | 'UnfreezeFunds' // 源 modalInfo.key='UnFreeze'，type=7
  | 'FreezeWallet' // 源 modalInfo.key='Freeze1'，type=2
  | 'UnfreezeWallet' // 源 modalInfo.key='UnFreeze1'，type=3
  | 'ChangeWalletType'; // 源 modalInfo.key='Change Wallet Type'

/**
 * 弹窗上下文（由列表页 openAction 填充）。
 *
 * 与源 modalInfo 字段对应：subTitle/tips/tipss 改为在 Dialog 内按 action 派生 i18n key，
 * 不再冗余存储文案；walletInfo 的必要字段扁平进此对象。
 */
export interface UserWalletModalInfo {
  id: string;
  action: UserWalletAction;
  walletId: number;
  walletType: string;
  tdName: string;
  /** 资金冻结弹窗 tips：可用余额回填（源 usableCount，缺省回退 stablecoinCount）。 */
  usableCount: string;
  /** 资金解冻弹窗 tips：冻结余额回填（源 freezeCount）。 */
  freezeCount: string;
  symbol: string;
}

// ── 表单形状（纯类型，便于 formToFilters 推断） ────────────────────────────────

/**
 * react-hook-form 筛选表单形状。
 *
 * 文本空串 = 无筛选；下拉 `'all'` = 无筛选；日期为 `YYYY-MM-DD` 字符串。
 * 字段名对齐源 CustomTable：tokenType/stablecoinId/blockchainId→blockchainKey/
 * custodyModel/kycRequired/submissionPolicyStatic/state + 时间范围。
 */
interface UserWalletFilterForm {
  walletAddress: string;
  spName: string;
  stablecoinId: string;
  tokenType: string;
  blockchainKey: string;
  startCreateTime: string;
  endCreateTime: string;
  state: string;
  custodyModel: string;
  kycRequired: string;
  submissionPolicyStatic: string;
}

const EMPTY_FORM: UserWalletFilterForm = {
  walletAddress: '',
  spName: '',
  stablecoinId: ALL_VALUE,
  tokenType: ALL_VALUE,
  blockchainKey: ALL_VALUE,
  startCreateTime: '',
  endCreateTime: '',
  state: ALL_VALUE,
  custodyModel: ALL_VALUE,
  kycRequired: ALL_VALUE,
  submissionPolicyStatic: ALL_VALUE,
};

/** 将表单值转换为后端筛选条件（纯函数）。 */
function formToFilters(form: UserWalletFilterForm): UserWalletListFilters {
  return {
    walletAddress: form.walletAddress.trim() || undefined,
    spName: form.spName.trim() || undefined,
    stablecoinId:
      form.stablecoinId && form.stablecoinId !== ALL_VALUE
        ? Number(form.stablecoinId)
        : undefined,
    tokenType:
      form.tokenType && form.tokenType !== ALL_VALUE
        ? Number(form.tokenType)
        : undefined,
    blockchainKey:
      form.blockchainKey && form.blockchainKey !== ALL_VALUE
        ? form.blockchainKey
        : undefined,
    startCreateTime: form.startCreateTime
      ? startOfDay(parseISO(form.startCreateTime)).getTime()
      : undefined,
    endCreateTime: form.endCreateTime
      ? endOfDay(parseISO(form.endCreateTime)).getTime()
      : undefined,
    state:
      form.state && form.state !== ALL_VALUE ? Number(form.state) : undefined,
    custodyModel:
      form.custodyModel && form.custodyModel !== ALL_VALUE
        ? Number(form.custodyModel)
        : undefined,
    kycRequired:
      form.kycRequired && form.kycRequired !== ALL_VALUE
        ? Number(form.kycRequired)
        : undefined,
    submissionPolicyStatic:
      form.submissionPolicyStatic && form.submissionPolicyStatic !== ALL_VALUE
        ? form.submissionPolicyStatic
        : undefined,
  };
}

/**
 * 安全翻译 tokenType 枚举值。
 *
 * 源 `t(\`token_type_${Number(tokenType)}\`)`（router/common 命名空间，仅含 1/5/20）。
 * 目标收敛到 `modules.wallet.tokenType.{key}`。next-intl 对缺失 key 会抛 MISSING_MESSAGE，
 * 此处 try/catch 降级为原始数值（tokenType 集合随业务扩展，i18n 未补齐时不崩）。
 */
function translateTokenType(
  t: (key: string) => string,
  tokenType: number
): string {
  try {
    return t(`tokenType.${tokenType}`);
  } catch {
    return String(tokenType);
  }
}
