/**
 * OverviewWalletsTab — 运营总览页 Tab3 钱包。
 *
 * 迁移自 td-manage src/pages/tokenized-deposit/index.tsx 的 customTable2
 * （active==='3'，tokenized_deposit_0054「Wallets」）+ Additional Wallets 静态 mock 表。
 *
 * ## 双 URL 切换（文档 8.6，对齐源 678-747 行）—— 核心难点
 *
 * 钱包列表有 2 个 endpoint：
 * - `useWalletQuery`（listPage）：默认场景（isOnclick=false）。
 * - `useWalletBalanceQuery`（balance）：刷新按钮触发场景（isOnclick=true）。
 *
 * 两个 hook 按 `isOnclick` 在调用方切换（同一组件内条件渲染不同的子表组件，
 * 避免在同一 hook 间动态切 URL 导致 query key 错乱）。
 *
 * 时序（对齐源 735-744 行刷新按钮 onClick）：
 * 1. 点刷新按钮 → setDoRe(true) + setIsOnclick(true) + mutate balance query。
 * 2. 3s 后 setDoRe(false) 复位旋转动画。
 * 3. 切 TD（td.code 变化）→ useEffect 复位 isOnclick=false（走回 listPage）。
 *
 * 源 useEffect 1764-1767：`setIsOnclick(false)` 在 `[active, activeKey]` 变化时触发，
 * 即切 TD 时复位。这里等价：td.code 变化时复位。
 *
 * ## 钱包表列（对齐源 694-725 行，逐列）
 *
 * - tokenized_deposit_0176：type → admin_wallet_type_${type}（纯文案）
 * - tokenized_deposit_0049：blockchainName
 * - tokenized_deposit_0053：walletAddress（源无 Copy，但地址长，加 Copy + ellipsis 提升可读性）
 * - tokenized_deposit_0051：balance → '∞' 或 balance + ' ' + unit
 * - tokenized_deposit_0052：updateTime → formatDate
 *
 * 源 walletAddress 列无 render（纯文本），但钱包地址普遍超长，迁移时统一用
 * TokenizedDepositCopy ellipsis（与 SP 记录表 walletAddress 列保持一致）。
 *
 * ## 行操作（对齐源 748-774 行 actions，逐项）
 *
 * - Edit（权限 EDIT_WALLET）：disabled = !(approvalStatus===0 && operateStatus===35)。
 *   回调 → onOpenAdminWalletModal(type='Update', row)。
 * - View（权限 VIEW_WALLET）：disabled: false。
 *   回调 → onOpenAdminWalletModal(type='Details', row)。
 * - History（权限 HISTORY）：disabled: false。
 *   回调 → onOpenAdminWalletModal(type='History', row)。
 *
 * 死代码 `Examine` action（源 750-755 注释）不迁移，但权限码 EXAMINE 保留勿删。
 * Modal 实际渲染在 td-18 的 admin-wallet-modal.tsx，本 tab 只负责通过回调上报打开意图。
 *
 * ## Additional Wallets 静态 mock 表（对齐源 1451-1635 行）
 *
 * 9 行角色钱包（Force Transfer 第 10 行注释，不迁移）。blockchain 取当前 TD 的
 * blockchainName，fallback 'Hyperledger Besu'。status 恒 'Unconfigured'，
 * Badge dimension="roleWallet"。updatedTime 恒 null → '--'。
 *
 * 列：role_name / wallet_address / Chain Name（英文硬编码标题，源 t('role_name') 等
 * i18n key 在 tokenized-deposit 命名空间；'Chain Name' 源直接传英文字符串给 t() ——
 * 无对应 i18n key 时 next-intl 会回落显示 key 本身，故保持英文 key 一致）。
 *
 * ## 死代码（不迁移）
 *
 * - customTable2 `Examine` action 注释（TD_PERMISSIONS.EXAMINE 权限码保留）
 * - Additional Wallets Force Transfer 第 10 行注释
 * - Additional Wallets `Actions` 列注释（源 1622-1631，无入口）
 *
 * i18n namespace: `modules.tokenized-deposit`。
 */
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { Button, DataTable } from '@myorg/shared/ui';
import { PermissionGuard } from '@myorg/shared/util-auth';
import { formatDate } from '@myorg/shared/util-dates';
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  TD_PERMISSIONS,
} from '@myorg/modules/tokenized-deposit/util';
import {
  useWalletBalanceQuery,
  useWalletQuery,
  type ApplyListItem,
  type WalletItem,
} from '@myorg/modules/tokenized-deposit/data-access';
import {
  TokenizedDepositCopy,
  TokenizedDepositStatusBadge,
} from '@myorg/modules/tokenized-deposit/ui';

/** 时间戳格式（对齐源 formatTimestamp → 'YYYY-MM-DD HH:mm:ss'）。 */
const DATETIME_FMT = 'YYYY-MM-DD HH:mm:ss';

/** 刷新按钮旋转动画复位延迟（源 3000ms）。 */
const REFRESH_SPIN_DURATION_MS = 3000;

/**
 * AdminWalletModal 打开意图类型（对齐源 adminWalletModalInfo.type）。
 *
 * 源 actionClick 按分支设置 type 字段：
 * - 'Update'：Edit action（源 type: 'Update'）
 * - t('PUB_Detail')：View action（源 type: t('PUB_Detail')）
 * - t('tokenized_deposit_0077')：History action（源 type: t('tokenized_deposit_0077')）
 *
 * td-18 的 admin-wallet-modal.tsx 按此 type 渲染 4 态（Update/Approval/Details/History）。
 * 这里用语义常量 'Update' | 'Details' | 'History'（Approval 态由 td-18 死代码
 * Examine 触发，本 tab 不上报）。
 */
export type AdminWalletModalActionType = 'Update' | 'Details' | 'History';

/**
 * AdminWalletModal 打开上下文（对齐源 adminWalletModalInfo 关键字段）。
 *
 * td-18 消费：按 action 渲染对应 Modal 态，并预填 formAdminWallet。
 * 此处只传 row 原始数据 + 语义 action，Modal 内部按需取字段（accountId/walletAddress/
 * storageType/chainType/virtualMachineCode/blockchainCode/tdName/type 等），
 * 避免在 tab 层复制源 adminWalletModalInfo 的 13 字段手动组装（td-18 自行组装更内聚）。
 */
export interface AdminWalletModalActionContext {
  /** 打开态（对齐源 adminWalletModalInfo.type 的语义子集）。 */
  action: AdminWalletModalActionType;
  /** 触发行原始数据（源 actionClick 的 data）。 */
  row: WalletItem;
}

export interface OverviewWalletsTabProps {
  /** 当前选中 TD（源 getUsablePrice）。提供 code（注入 stablecoinCode 过滤）+ blockchainName。 */
  td: ApplyListItem;
  /**
   * 打开管理钱包 Modal 回调（td-18 实现）。
   * 传入打开意图（Update/Details/History）+ 触发行数据。
   */
  onOpenAdminWalletModal: (ctx: AdminWalletModalActionContext) => void;
}

/**
 * 渲染 Tab3 钱包（双 URL 钱包表 + Additional Wallets 静态 mock 表）。
 *
 * 用法（在 OverviewShell TabsContent value="3" 内）：
 * ```tsx
 * <OverviewWalletsTab
 *   td={currentTd}
 *   onOpenAdminWalletModal={({ action, row }) => {
 *     setAdminWalletModalAction(action);
 *     setAdminWalletModalRow(row);
 *     setAdminWalletModalOpen(true);
 *   }}
 * />
 * ```
 */
export function OverviewWalletsTab({
  td,
  onOpenAdminWalletModal,
}: OverviewWalletsTabProps): React.JSX.Element {
  // ── 双 URL 切换 state ──
  // isOnclick：false→listPage，true→balance（刷新按钮触发）。
  // 源 useState(false) + useEffect [active, activeKey] 复位。
  const [isOnclick, setIsOnclick] = React.useState(false);
  // doRe：刷新按钮旋转动画标志（源 useState(false)）。
  const [doRe, setDoRe] = React.useState(false);

  // 切 TD（td.code 变化）复位 isOnclick=false（源 useEffect 1764-1767 等价）。
  React.useEffect(() => {
    setIsOnclick(false);
  }, [td?.code]);

  // 刷新按钮 onClick（对齐源 735-744）：
  // setDoRe(true) + setIsOnclick(true) + balance query refetch + 3s 后 setDoRe(false)。
  const handleRefresh = React.useCallback(
    (refetchBalance: () => void) => {
      setDoRe(true);
      setIsOnclick(true);
      void refetchBalance();
      window.setTimeout(() => setDoRe(false), REFRESH_SPIN_DURATION_MS);
    },
    [],
  );

  return (
    <div className="space-y-8">
      {isOnclick ? (
        <WalletsTableInner
          td={td}
          variant="balance"
          doRe={doRe}
          onRefresh={handleRefresh}
          onOpenAdminWalletModal={onOpenAdminWalletModal}
        />
      ) : (
        <WalletsTableInner
          td={td}
          variant="listPage"
          doRe={doRe}
          onRefresh={handleRefresh}
          onOpenAdminWalletModal={onOpenAdminWalletModal}
        />
      )}

      {/* Additional Wallets 静态 mock 表 */}
      <AdditionalWalletsTable td={td} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 钱包表（双 URL 共用列定义，仅 query hook 不同）
// ═══════════════════════════════════════════════════════════════════

interface WalletsTableInnerProps extends OverviewWalletsTabProps {
  /** 当前走哪个 endpoint（isOnclick 对应）。 */
  variant: 'listPage' | 'balance';
  /** 刷新按钮旋转动画标志。 */
  doRe: boolean;
  /** 刷新回调（由父层传入，内部对接 balance query refetch）。 */
  onRefresh: (refetchBalance: () => void) => void;
}

/**
 * 钱包表内部组件（listPage / balance 共用，按 variant 选 query hook）。
 *
 * endpoint：
 * - listPage → POST /api/manage/v1/td/wallet/listPage
 * - balance → POST /api/manage/v1/td/wallet/balance
 * rowKey: accountId。
 */
function WalletsTableInner({
  td,
  variant,
  doRe,
  onRefresh,
  onOpenAdminWalletModal,
}: WalletsTableInnerProps): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const [pagination, setPagination] = React.useState({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // stablecoinCode 注入（源 initialValues.stablecoinCode = getUsablePrice.code）。
  const params = React.useMemo(
    () => ({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      stablecoinCode: td?.code ?? '',
    }),
    [pagination.pageNum, pagination.pageSize, td?.code],
  );

  // 双 URL：variant 决定走哪个 hook（query key 不同，缓存不污染）。
  const listQuery = useWalletQuery(params);
  const balanceQuery = useWalletBalanceQuery(params);
  const query = variant === 'balance' ? balanceQuery : listQuery;

  const rows = query.data?.rows ?? [];
  const total = query.data?.page?.total ?? 0;
  const isLoading = query.isLoading || query.isFetching;

  // 行操作 Edit（源 actionClick 'Edit' → type 'Update'）。
  const handleEdit = React.useCallback(
    (row: WalletItem) => {
      onOpenAdminWalletModal({ action: 'Update', row });
    },
    [onOpenAdminWalletModal],
  );
  // 行操作 View（源 actionClick 'View' → type t('PUB_Detail') → 语义 'Details'）。
  const handleView = React.useCallback(
    (row: WalletItem) => {
      onOpenAdminWalletModal({ action: 'Details', row });
    },
    [onOpenAdminWalletModal],
  );
  // 行操作 History（源 actionClick 'History' → type t('tokenized_deposit_0077') → 语义 'History'）。
  const handleHistory = React.useCallback(
    (row: WalletItem) => {
      onOpenAdminWalletModal({ action: 'History', row });
    },
    [onOpenAdminWalletModal],
  );

  const columns = React.useMemo<ColumnDef<WalletItem>[]>(
    () => [
      {
        // tokenized_deposit_0176：admin_wallet_type_{type}（纯文案）
        accessorKey: 'type',
        header: t('tokenized_deposit_0176'),
        cell: ({ getValue }) => {
          const type = getValue<number>();
          if (type == null) return <span>{EMPTY_DISPLAY}</span>;
          // 源 t(`admin_wallet_type_${type}`)，常量前缀 ADMIN_WALLET_TYPE_KEY_PREFIX。
          // 直接拼 key（与 tab-records recordType 列同模式），避免再 import 前缀常量。
          return <span>{t(`admin_wallet_type_${type}`)}</span>;
        },
      },
      {
        // tokenized_deposit_0049：blockchainName（源无 render）
        accessorKey: 'blockchainName',
        header: t('tokenized_deposit_0049'),
        cell: ({ getValue }) => (
          <span>{getValue<string>() || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // tokenized_deposit_0053：walletAddress
        // 源无 render（纯文本），地址超长 → 统一 Copy + ellipsis（与 SP 表一致）。
        accessorKey: 'walletAddress',
        header: t('tokenized_deposit_0053'),
        cell: ({ row }) => (
          <TokenizedDepositCopy
            text={row.original.walletAddress}
            ellipsis
          />
        ),
      },
      {
        // tokenized_deposit_0051：balance → '∞' 或 balance + ' ' + unit
        // 源 render: balance === '∞' ? balance : balance + ' ' + data.unit
        accessorKey: 'balance',
        header: t('tokenized_deposit_0051'),
        cell: ({ row }) => {
          const balance = row.original.balance;
          const unit = row.original.unit ?? '';
          if (balance == null || balance === '') {
            return <span>{EMPTY_DISPLAY}</span>;
          }
          return (
            <span>
              {balance === '∞' ? balance : `${balance} ${unit}`}
            </span>
          );
        },
      },
      {
        // tokenized_deposit_0052：updateTime → formatDate
        accessorKey: 'updateTime',
        header: t('tokenized_deposit_0052'),
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return (
            <span>{val ? formatDate(val, DATETIME_FMT) : EMPTY_DISPLAY}</span>
          );
        },
      },
      {
        id: 'actions',
        header: t('PUB_Action'),
        cell: ({ row }) => {
          const r = row.original;
          // Edit disabled（源 760）：!(approvalStatus === 0 && operateStatus === 35)
          const editDisabled = !(
            r.approvalStatus === 0 && r.operateStatus === 35
          );
          return (
            <div className="flex items-center gap-3">
              <PermissionGuard permission={TD_PERMISSIONS.EDIT_WALLET}>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  disabled={editDisabled}
                  onClick={() => handleEdit(r)}
                >
                  {t('tokenized_deposit_0122')}
                </Button>
              </PermissionGuard>
              <PermissionGuard permission={TD_PERMISSIONS.VIEW_WALLET}>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => handleView(r)}
                >
                  {t('PUB_Detail')}
                </Button>
              </PermissionGuard>
              <PermissionGuard permission={TD_PERMISSIONS.HISTORY}>
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => handleHistory(r)}
                >
                  {t('Router_0003_19')}
                </Button>
              </PermissionGuard>
            </div>
          );
        },
      },
    ],
    [t, handleEdit, handleView, handleHistory],
  );

  // 刷新按钮（对齐源 727-746 CustomTableTitle 内的刷新 span）。
  // 仅在 balance 态可触发（listPage 态点击会切到 balance 并 refetch）。
  const refreshButton = React.useMemo(
    () => (
      <div className="flex items-center">
        <span>{t('tokenized_deposit_0054')}</span>
        <button
          type="button"
          aria-label="refresh"
          onClick={() => onRefresh(() => balanceQuery.refetch())}
          className={`ml-2 inline-flex h-4 w-4 cursor-pointer items-center justify-center text-muted-foreground transition-transform hover:text-foreground ${
            doRe ? 'animate-spin' : ''
          }`}
        >
          {/* Refresh icon (heroicons arrow-path) */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        </button>
      </div>
    ),
    [t, onRefresh, doRe, balanceQuery],
  );

  return (
    <div className="space-y-3">
      {/* 标题区（对齐源 CustomTableTitle，含刷新按钮，源 727-746） */}
      {refreshButton}
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
  );
}

// ═══════════════════════════════════════════════════════════════════
// Additional Wallets 静态 mock 表（9 行角色钱包）
// ═══════════════════════════════════════════════════════════════════

/** Additional Wallets 行数据（源 1458-1567 静态 mock，无 API）。 */
interface AdditionalWalletRow {
  /** DataTable 契约 id（= key）。 */
  id: string;
  key: string;
  roleName: string;
  walletAddress: string;
  blockchain: string;
  description: string;
  updatedTime: number | null;
  status: 'Unconfigured' | 'Processing' | 'Active';
}

/**
 * Additional Wallets 静态 mock 表（对齐源 1451-1635）。
 *
 * 9 行角色钱包（Force Transfer 第 10 行源注释，不迁移）。
 * blockchain 取当前 TD blockchainName，fallback 'Hyperledger Besu'。
 * status 恒 'Unconfigured'，Badge dimension="roleWallet"。
 */
function AdditionalWalletsTable({
  td,
}: {
  td: ApplyListItem;
}): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const rows = React.useMemo<AdditionalWalletRow[]>(
    () =>
      buildAdditionalWalletRows(td?.blockchainName).map((row) => ({
        ...row,
        id: row.key,
      })),
    [td?.blockchainName],
  );

  const columns = React.useMemo<ColumnDef<AdditionalWalletRow>[]>(
    () => [
      {
        // role_name（源 dataIndex 'roleName'，width 180）
        accessorKey: 'roleName',
        header: t('role_name'),
        cell: ({ getValue }) => (
          <span>{getValue<string>() || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // wallet_address（源 dataIndex 'walletAddress'，恒 '--'）
        accessorKey: 'walletAddress',
        header: t('wallet_address'),
        cell: ({ getValue }) => (
          <span>{getValue<string>() || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // Chain Name（源直接传 'Chain Name' 给 t()，无 i18n key → 回落显示 key 本身）
        accessorKey: 'blockchain',
        header: 'Chain Name',
        cell: ({ getValue }) => (
          <span>{getValue<string>() || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // tokenized_deposit_0050：description（源 ellipsis）
        accessorKey: 'description',
        header: t('tokenized_deposit_0050'),
        cell: ({ getValue }) => (
          <span className="line-clamp-1">{getValue<string>() || EMPTY_DISPLAY}</span>
        ),
      },
      {
        // tokenized_deposit_0052：updatedTime → formatDate，null → '--'
        accessorKey: 'updatedTime',
        header: t('tokenized_deposit_0052'),
        cell: ({ getValue }) => {
          const val = getValue<number | null>();
          return (
            <span>
              {val ? formatDate(val, DATETIME_FMT) : EMPTY_DISPLAY}
            </span>
          );
        },
      },
      {
        // PUB_Status：status → Badge roleWallet
        // 源 Tag color 映射 Unconfigured→default / Processing→processing / Active→success，
        // 文案 role_wallet_status_{lowercase}。TokenizedDepositStatusBadge roleWallet 维度等价。
        accessorKey: 'status',
        header: t('PUB_Status'),
        cell: ({ getValue }) => (
          <TokenizedDepositStatusBadge
            dimension="roleWallet"
            status={getValue<AdditionalWalletRow['status']>()}
          />
        ),
      },
    ],
    [t],
  );

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold">Additional Wallets</h3>
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage={t('empty')}
        pagination={{
          page: 1,
          pageSize: DEFAULT_PAGE_SIZE,
          total: rows.length,
          onPageChange: () => {
            /* 源 pageSize: 10，静态数据无需翻页回调 */
          },
        }}
      />
    </div>
  );
}

/**
 * 构造 Additional Wallets 9 行 mock 数据（对齐源 1458-1567）。
 *
 * Force Transfer 第 10 行源注释（1556-1566），不迁移。
 * blockchain fallback 'Hyperledger Besu'（源 getUsablePrice?.blockchainName || 'Hyperledger Besu'）。
 */
function buildAdditionalWalletRows(
  blockchainName?: string,
): Omit<AdditionalWalletRow, 'id'>[] {
  const blockchain = blockchainName || 'Hyperledger Besu';
  const base = {
    walletAddress: '--',
    blockchain,
    updatedTime: null,
    status: 'Unconfigured' as const,
  };
  return [
    {
      key: '1',
      roleName: 'Wallet Configurator',
      description: 'Configures wallet types and attributes.',
      ...base,
    },
    {
      key: '2',
      roleName: 'Service Provider',
      description:
        'Authorized account for SP operations, designated during SP registration.',
      ...base,
    },
    {
      key: '3',
      roleName: 'Register Controller',
      description:
        'Manages SP and wallet registration, wallet limits, and whitelist.',
      ...base,
    },
    {
      key: '4',
      roleName: 'Cold Burner',
      description:
        'Handles burn operations exceeding the threshold using cold wallet.',
      ...base,
    },
    {
      key: '5',
      roleName: 'Hot Burner',
      description:
        'Handles burn operations within the threshold using hot wallet.',
      ...base,
    },
    {
      key: '6',
      roleName: 'Cold Minter',
      description:
        'Handles mint operations exceeding the threshold using cold wallet.',
      ...base,
    },
    {
      key: '7',
      roleName: 'Hot Minter',
      description:
        'Handles mint operations within the threshold using hot wallet.',
      ...base,
    },
    {
      key: '8',
      roleName: 'Freeze Controller',
      description: 'Freezes/unfreezes wallets and wallet funds.',
      ...base,
    },
    {
      key: '9',
      roleName: 'Pause Controller',
      description: 'Pauses/unpauses contract operations.',
      ...base,
    },
    // Force Transfer（源 1556-1566 注释）— 不迁移。
  ];
}
