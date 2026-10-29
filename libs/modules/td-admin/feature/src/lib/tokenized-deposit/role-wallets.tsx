'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import {
  Button,
  DataTable,
  Input,
  Label,
} from '@myorg/shared/ui';
import {
  useRoleWalletDetailQuery,
  useRoleWalletsListQuery,
  type RoleWalletItem,
  type RoleWalletListParams,
} from '@myorg/modules/td-admin/data-access';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
} from '@myorg/modules/td-admin/data-access';
import { roleWalletColumns } from './role-wallets-columns';
import { RoleWalletConfigureModal } from './role-wallets-configure-modal';
import { RoleWalletDetailModal } from './role-wallets-detail-modal';



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


/** Read-only upstream role-wallet demonstration; no backend configuration contract exists. */
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

  // 钱包属性翻译：mock walletAttribute 'Cold Wallet'/'Hot Wallet' →
  // 'cold_wallet'/'hot_wallet' → 现有文案键 wallet_attr_cold / wallet_attr_hot
  // （键无 _wallet 尾缀；缺失键会被 next-intl 回显为完整路径，见 round-02 ISSUE-4）。
  const translateWalletAttribute = React.useCallback(
    (attribute?: string): string => {
      if (!attribute) return EMPTY_DISPLAY;
      const attrKey = attribute
        .replace(/\s+/g, '_')
        .toLowerCase()
        .replace(/_wallet$/, '');
      return t(`wallet_attr_${attrKey}`);
    },
    [t],
  );

  // ── 选中行 + Modal 状态 ──
  const [selectedWallet, setSelectedWallet] =
    React.useState<RoleWalletItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  // Configure Wallet Modal（源 Configure 按钮，仅 Unconfigured 行可达）。
  const [isConfigModalOpen, setIsConfigModalOpen] = React.useState(false);

  // 详情查询（含 operations）：仅打开详情 Modal 时按 roleWalletId 发起。
  const detailQuery = useRoleWalletDetailQuery(
    isDetailModalOpen ? selectedWallet?.roleWalletId : undefined,
  );
  const walletOperations = detailQuery.data?.operations ?? [];

  const openDetails = React.useCallback((row: RoleWalletItem) => {
    setSelectedWallet(row);
    setIsDetailModalOpen(true);
  }, []);

  const openConfigure = React.useCallback((row: RoleWalletItem) => {
    setSelectedWallet(row);
    setIsConfigModalOpen(true);
  }, []);

  // ── 列表列 ──
  const columns = React.useMemo(
    () =>
      roleWalletColumns(t, translateWalletAttribute, openDetails, openConfigure),
    [t, translateWalletAttribute, openDetails, openConfigure],
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
      <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        {t('td_legacy_demo_notice')}
      </p>
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


      {/* Configure Wallet Modal（源 222-290，仅 Unconfigured 行可达；NF-3） */}
      <RoleWalletConfigureModal
        open={isConfigModalOpen}
        selectedWallet={selectedWallet}
        onOpenChange={(open) => {
          setIsConfigModalOpen(open);
          if (!open) {
            setSelectedWallet(null);
          }
        }}
        onConfigured={() => {
          // 源 mutate() 重建表：关窗 + 刷新列表。
          setIsConfigModalOpen(false);
          setSelectedWallet(null);
          void listQuery.refetch();
        }}
      />

      {/* 钱包详情 Modal */}
      <RoleWalletDetailModal
        open={isDetailModalOpen}
        selectedWallet={selectedWallet}
        walletOperations={walletOperations}
        translateWalletAttribute={translateWalletAttribute}
        onOpenChange={(open) => {
          setIsDetailModalOpen(open);
          if (!open) {
            setSelectedWallet(null);
          }
        }}
      />

    </div>
  );
}
