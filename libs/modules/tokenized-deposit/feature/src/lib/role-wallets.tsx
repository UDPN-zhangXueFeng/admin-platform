'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import {
  Button,
  CopyableEllipsisText,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@myorg/shared/ui';
import { formatDate } from '@myorg/shared/util-dates';
import {
  TokenizedDepositStatusBadge,
} from '@myorg/modules/tokenized-deposit/ui';
import {
  useConfigureRoleWalletMutation,
  useRoleWalletDetailQuery,
  useRoleWalletsListQuery,
  type RoleWalletItem,
  type RoleWalletListParams,
} from '@myorg/modules/tokenized-deposit/data-access';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
} from '@myorg/modules/tokenized-deposit/util';

const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/** 0x 开头 + 40 位十六进制（源码 /0x[a-fA-F0-9]{40}/ 校验）。 */
const ETHEREUM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/**
 * 筛选表单（react-hook-form）。源码 useCustomTable form.items：
 * roleName / walletAddress 两个 Input。
 */
interface RoleWalletFilterForm {
  roleName: string;
  walletAddress: string;
}

const EMPTY_FILTER: RoleWalletFilterForm = {
  roleName: '',
  walletAddress: '',
};

/** 配置 Modal 表单值。roleName 只读回填，walletAddress 必填 + 地址校验。 */
interface ConfigureWalletFormValues {
  roleName: string;
  walletAddress: string;
}

/**
 * RoleWallets — 角色钱包组件（100% mock，后端未实装）。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/role-wallets.tsx（405 行）。
 * useCustomTable + CustomForms/CustomModal → react-hook-form + DataTable + Dialog。
 *
 * 三个数据通道全 mock（td-6 api.ts 已迁入并标注 // MOCK，本组件正常消费 query hooks）：
 *  - useRoleWalletsListQuery（getRoleWalletsList：setTimeout 300ms + generateMockRoleWallets）
 *  - useRoleWalletDetailQuery（getRoleWalletDetail：含 operations 操作历史）
 *  - useConfigureRoleWalletMutation（configureRoleWallet：setTimeout 500ms）
 *
 * 列表 8 列：roleName / walletAddress(ellipsis) / blockchain / walletAttribute /
 * description / status(roleWallet badge) / createdTime / updatedTime。
 *
 * 行操作：Details（始终）+ Configure（仅 status==='Unconfigured'）。
 *
 * 被 view.tsx Tab3 引用（td-20）。
 */
export function RoleWallets({
  tokenId: propTokenId,
}: {
  tokenId?: string;
}): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  // 源码：propTokenId || query.current || 'TOKEN-001'。迁移后无 router query，回落 'TOKEN-001'。
  const tokenId = propTokenId || 'TOKEN-001';

  // ── 筛选表单 ──
  const { register, handleSubmit, reset } = useForm<RoleWalletFilterForm>({
    defaultValues: EMPTY_FILTER,
  });
  const [queryValues, setQueryValues] =
    React.useState<RoleWalletFilterForm>(EMPTY_FILTER);
  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const listParams: RoleWalletListParams = React.useMemo(
    () => ({
      tokenId,
      roleName: queryValues.roleName || undefined,
      walletAddress: queryValues.walletAddress || undefined,
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
    }),
    [tokenId, queryValues, pagination.pageNum, pagination.pageSize],
  );
  const listQuery = useRoleWalletsListQuery(listParams);
  const rows = listQuery.data?.rows ?? [];
  const total = listQuery.data?.page?.total ?? 0;
  const isLoading = listQuery.isLoading || listQuery.isFetching;

  // 钱包属性翻译：attribute.replace(/\s+/g,'_').toLowerCase() → t('wallet_attr_'+key)。
  // 与源码一致（mock walletAttribute 'Hot Wallet'/'Cold Wallet'，key 拼接原样保留）。
  const translateWalletAttribute = React.useCallback(
    (attribute?: string): string => {
      if (!attribute) return EMPTY_DISPLAY;
      const attrKey = attribute.replace(/\s+/g, '_').toLowerCase();
      return t(`wallet_attr_${attrKey}`);
    },
    [t],
  );

  // ── 选中行 + Modal 状态 ──
  const [selectedWallet, setSelectedWallet] =
    React.useState<RoleWalletItem | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = React.useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);

  // 详情查询（含 operations）：仅打开详情 Modal 时按 roleWalletId 发起。
  const detailQuery = useRoleWalletDetailQuery(
    isDetailModalOpen ? selectedWallet?.roleWalletId : undefined,
  );
  const walletOperations = detailQuery.data?.operations ?? [];

  // ── 配置 Modal 表单 ──
  const {
    register: registerConfig,
    handleSubmit: handleSubmitConfig,
    reset: resetConfig,
    setValue: setConfigValue,
    formState: { errors: configErrors },
  } = useForm<ConfigureWalletFormValues>({
    defaultValues: { roleName: '', walletAddress: '' },
  });

  // 选中行变化时回填配置表单（源码 CustomForms initialValue）。
  React.useEffect(() => {
    if (isConfigModalOpen && selectedWallet) {
      setConfigValue('roleName', selectedWallet.roleName ?? '');
      setConfigValue('walletAddress', '');
    }
  }, [isConfigModalOpen, selectedWallet, setConfigValue]);

  const configureMutation = useConfigureRoleWalletMutation();

  // 行操作 → 打开 Modal。
  const onActionClick = React.useCallback(
    (row: RoleWalletItem, key: 'Details' | 'Configure') => {
      setSelectedWallet(row);
      if (key === 'Configure') {
        resetConfig({ roleName: row.roleName ?? '', walletAddress: '' });
        setIsConfigModalOpen(true);
      } else {
        setIsDetailModalOpen(true);
      }
    },
    [resetConfig],
  );

  // 提交配置钱包（源码 handleConfigureWallet）。
  const onConfigureSubmit = React.useCallback(
    (values: ConfigureWalletFormValues) => {
      if (!selectedWallet?.roleWalletId) return;
      configureMutation.mutate(
        {
          roleWalletId: selectedWallet.roleWalletId,
          walletAddress: values.walletAddress,
          additionalParams: values,
        },
        {
          onSuccess: () => {
            toast.success(t('configure_wallet_title'));
            setIsConfigModalOpen(false);
            resetConfig({ roleName: '', walletAddress: '' });
          },
        },
      );
    },
    [selectedWallet, configureMutation, t, resetConfig],
  );

  // ── 列表列 ──
  const columns = React.useMemo<ColumnDef<RoleWalletItem>[]>(
    () => [
      {
        accessorKey: 'roleName',
        header: t('role_name'),
        cell: ({ row }) => (
          <span>{row.original.roleName || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'walletAddress',
        header: t('wallet_address'),
        cell: ({ row }) => (
          <CopyableEllipsisText
            value={row.original.walletAddress}
            maxWidth={180}
          />
        ),
      },
      {
        accessorKey: 'blockchain',
        header: t('tokenized_deposit_0007'),
        cell: ({ row }) => (
          <span>{row.original.blockchain || EMPTY_DISPLAY}</span>
        ),
      },
      {
        accessorKey: 'walletAttribute',
        header: t('wallet_attribute'),
        cell: ({ row }) => (
          <span>{translateWalletAttribute(row.original.walletAttribute)}</span>
        ),
      },
      {
        accessorKey: 'description',
        header: t('tokenized_deposit_0050'),
        cell: ({ row }) => (
          <span
            className="block max-w-[300px] truncate"
            title={row.original.description ?? ''}
          >
            {row.original.description || EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('PUB_Status'),
        cell: ({ row }) => (
          <TokenizedDepositStatusBadge
            dimension="roleWallet"
            status={row.original.status}
          />
        ),
      },
      {
        accessorKey: 'createdTime',
        header: t('PUB_CreatedTime'),
        cell: ({ row }) => (
          <span>
            {row.original.createdTime
              ? formatDate(Number(row.original.createdTime), DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        accessorKey: 'updatedTime',
        header: t('tokenized_deposit_0052'),
        cell: ({ row }) => (
          <span>
            {row.original.updatedTime
              ? formatDate(Number(row.original.updatedTime), DATETIME_FMT)
              : EMPTY_DISPLAY}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('PUB_Action'),
        cell: ({ row }) => {
          const r = row.original;
          const isUnconfigured = r.status === 'Unconfigured';
          return (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() => onActionClick(r, 'Details')}
              >
                {t('wallet_details')}
              </Button>
              {isUnconfigured ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => onActionClick(r, 'Configure')}
                >
                  {t('configure_wallet')}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [t, translateWalletAttribute, onActionClick],
  );

  const onSubmit = React.useCallback((f: RoleWalletFilterForm) => {
    setPagination((p) => ({ ...p, pageNum: 1 }));
    setQueryValues(f);
  }, []);
  const onReset = React.useCallback(() => {
    reset(EMPTY_FILTER);
    setQueryValues(EMPTY_FILTER);
    setPagination({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE });
  }, [reset]);

  return (
    <div className="space-y-4">
      {/* 筛选区 */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-lg border bg-card p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <Label
              htmlFor="role-wallets-roleName"
              className="mb-1.5 block text-sm font-medium"
            >
              {t('role_name')}
            </Label>
            <Input
              id="role-wallets-roleName"
              placeholder={t('role_name')}
              {...register('roleName')}
            />
          </div>
          <div>
            <Label
              htmlFor="role-wallets-walletAddress"
              className="mb-1.5 block text-sm font-medium"
            >
              {t('wallet_address')}
            </Label>
            <Input
              id="role-wallets-walletAddress"
              placeholder={t('enter_wallet_address')}
              {...register('walletAddress')}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">{t('PUB_Query')}</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            {t('PUB_Reset')}
          </Button>
        </div>
      </form>

      {/* 列表 */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-6 py-3">
          <div className="text-sm font-semibold">{t('role_wallets_list')}</div>
        </div>
        <div className="p-4">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage={t('empty')}
            pagination={{
              page: pagination.pageNum,
              pageSize: pagination.pageSize,
              total,
              onPageChange: (p) =>
                setPagination((prev) => ({ ...prev, pageNum: p })),
            }}
          />
        </div>
      </div>

      {/* 配置钱包 Modal */}
      <Dialog
        open={isConfigModalOpen}
        onOpenChange={(open) => {
          setIsConfigModalOpen(open);
          if (!open) {
            resetConfig({ roleName: '', walletAddress: '' });
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('configure_wallet_title')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmitConfig(onConfigureSubmit)}
            className="space-y-4"
          >
            <div>
              <Label
                htmlFor="role-wallets-config-roleName"
                className="mb-1.5 block text-sm font-medium"
              >
                {t('role_name')}
              </Label>
              <Input
                id="role-wallets-config-roleName"
                disabled
                {...registerConfig('roleName')}
              />
            </div>
            <div>
              <Label
                htmlFor="role-wallets-config-walletAddress"
                className="mb-1.5 block text-sm font-medium"
              >
                {t('wallet_address')}
                <span className="ml-0.5 text-destructive" aria-hidden="true">
                  *
                </span>
              </Label>
              <Input
                id="role-wallets-config-walletAddress"
                placeholder={t('enter_wallet_address')}
                {...registerConfig('walletAddress', {
                  required: true,
                  pattern: ETHEREUM_ADDRESS_PATTERN,
                })}
              />
              {configErrors.walletAddress ? (
                <p className="mt-1 text-sm text-destructive" role="alert">
                  {configErrors.walletAddress.type === 'required'
                    ? t('PUB_Pleased', { field: t('wallet_address') })
                    : t('wallet_address_invalid')}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsConfigModalOpen(false);
                  resetConfig({ roleName: '', walletAddress: '' });
                }}
              >
                {t('PUB_Cancel')}
              </Button>
              <Button type="submit" disabled={configureMutation.isPending}>
                {t('PUB_Submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 钱包详情 Modal */}
      <Dialog
        open={isDetailModalOpen}
        onOpenChange={(open) => {
          setIsDetailModalOpen(open);
          if (!open) {
            setSelectedWallet(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t('wallet_details_title')}</DialogTitle>
          </DialogHeader>
          {selectedWallet ? (
            <div className="space-y-6 py-2">
              {/* 钱包信息 */}
              <div>
                <h3 className="mb-3 text-base font-semibold">
                  {t('tokenized_deposit_0115')}
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">{t('role_name')}:</span>{' '}
                    {selectedWallet.roleName || EMPTY_DISPLAY}
                  </div>
                  <div>
                    <span className="font-medium">{t('PUB_Status')}:</span>{' '}
                    <TokenizedDepositStatusBadge
                      dimension="roleWallet"
                      status={selectedWallet.status}
                    />
                  </div>
                  <div className="col-span-2 break-all">
                    <span className="font-medium">
                      {t('wallet_address')}:
                    </span>{' '}
                    {selectedWallet.walletAddress || EMPTY_DISPLAY}
                  </div>
                  <div>
                    <span className="font-medium">
                      {t('tokenized_deposit_0007')}:
                    </span>{' '}
                    {selectedWallet.blockchain || EMPTY_DISPLAY}
                  </div>
                  <div>
                    <span className="font-medium">
                      {t('wallet_attribute')}:
                    </span>{' '}
                    {translateWalletAttribute(selectedWallet.walletAttribute)}
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium">
                      {t('tokenized_deposit_0050')}:
                    </span>{' '}
                    {selectedWallet.description || EMPTY_DISPLAY}
                  </div>
                  <div>
                    <span className="font-medium">
                      {t('PUB_CreatedTime')}:
                    </span>{' '}
                    {selectedWallet.createdTime
                      ? formatDate(
                          Number(selectedWallet.createdTime),
                          DATETIME_FMT,
                        )
                      : EMPTY_DISPLAY}
                  </div>
                  <div>
                    <span className="font-medium">
                      {t('tokenized_deposit_0052')}:
                    </span>{' '}
                    {selectedWallet.updatedTime
                      ? formatDate(
                          Number(selectedWallet.updatedTime),
                          DATETIME_FMT,
                        )
                      : EMPTY_DISPLAY}
                  </div>
                </div>
              </div>

              {/* 操作历史 */}
              <div>
                <h3 className="mb-3 text-base font-semibold">
                  {t('operation_history')}
                </h3>
                <DataTable
                  columns={operationHistoryColumns(t)}
                  data={walletOperations}
                  emptyMessage={t('empty')}
                />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── 操作历史 Table 列 ──

/**
 * 操作历史列定义（详情 Modal 内嵌 Table）。
 * 源码 6 列：operationType(operation_文案) / description / txHash / operator / timestamp / status。
 */
function operationHistoryColumns(
  t: ReturnType<typeof useTranslations>,
): ColumnDef<NonNullable<RoleWalletItem['operations']>[number]>[] {
  return [
    {
      accessorKey: 'operationType',
      header: t('operation_type'),
      cell: ({ row }) => {
        const type = row.original.operationType;
        if (!type) return <span>{EMPTY_DISPLAY}</span>;
        return <span>{t(`operation_${type.toLowerCase()}`)}</span>;
      },
    },
    {
      accessorKey: 'description',
      header: t('tokenized_deposit_0050'),
      cell: ({ row }) => (
        <span>{row.original.description || EMPTY_DISPLAY}</span>
      ),
    },
    {
      accessorKey: 'txHash',
      header: t('operation_tx_hash'),
      cell: ({ row }) => (
        <span
          className="block max-w-[220px] truncate"
          title={row.original.txHash ?? ''}
        >
          {row.original.txHash || EMPTY_DISPLAY}
        </span>
      ),
    },
    {
      accessorKey: 'operator',
      header: t('operation_operator'),
      cell: ({ row }) => (
        <span>{row.original.operator || EMPTY_DISPLAY}</span>
      ),
    },
    {
      accessorKey: 'timestamp',
      header: t('operation_time'),
      cell: ({ row }) => (
        <span>
          {row.original.timestamp
            ? formatDate(Number(row.original.timestamp), DATETIME_FMT)
            : EMPTY_DISPLAY}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('PUB_Status'),
      cell: ({ row }) => (
        <span>{row.original.status || EMPTY_DISPLAY}</span>
      ),
    },
  ];
}
